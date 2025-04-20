// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as lark from '@larksuiteoapi/node-sdk';
import {
  DynamoDBClient,
  UpdateCommand,
  GetItemCommand,
  PutItemCommand
} from "@aws-sdk/client-dynamodb";

import fs from 'fs';

const { debugLog, buildCard, getCurrentTime, invokeClaude3Stream, invokeClaude3 } = require('../utils');

// DynamoDB table names from environment variables
const dynamodb_tb_messages = process.env.DB_TABLE;
const dynamodb_tb_stats = process.env.DB_STATS_TABLE;
const dbclient = new DynamoDBClient();

const start_command = process.env.START_CMD;
const token_count_command = '/tc';
const prompt_template_command = '/sp';
const debug_command = '/debug';

const MAX_SEQ = parseInt(process.env.AWS_CLAUDE_MAX_SEQ) * 2 + 1;
// const aws_ak = process.env.AWS_AK
// const aws_sk = process.env.AWS_SK
// const aws_region_code = process.env.AWS_REGION_CODE
// const aws_llm = process.env.AWS_BEDROCK_CLAUDE_SONNET
const aws_claude_img_desc_prompt = process.env.AWS_CLAUDE_IMG_DESC_PROMPT
const aws_claude_system_prompt = process.env.AWS_CLAUDE_SYSTEM_PROMPT
const aws_claude_max_chat_quota_per_user = process.env.AWS_CLAUDE_MAX_CHAT_QUOTA_PER_USER

const larkclient = new lark.Client({
  appId: process.env.LARK_APPID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
});

function toBase64(filePath) {
  debugLog("Converting file to base64:", filePath);
  const img = fs.readFileSync(filePath);
  return Buffer.from(img).toString('base64');
}

function isEmpty(value) {
  if (value === null) {
    return true;
  }
  if (typeof value === 'undefined') {
    return true;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

const _queryDynamoDb = async (table_name, key) => {
  const params = {
    Key: key,
    TableName: table_name,
  };
  const command = new GetItemCommand(params);
  debugLog("Querying DynamoDB with params", { tableName: table_name, key }, 'DEBUG');
  try {
    const results = await dbclient.send(command);
    if (results == null || !results.Item) {
      debugLog("No item found in DynamoDB", { tableName: table_name }, 'INFO');
      return null;
    }
    debugLog("DynamoDB query successful", { tableName: table_name }, 'DEBUG');
    return results;
  } catch (err) {
    debugLog("DynamoDB query error", { tableName: table_name, error: err }, 'ERROR');
    return null;
  }
};

const _saveDynamoDb = async (table_name, item) => {
  const params = {
    TableName: table_name,
    Item: item
  }
  const command = new PutItemCommand(params);
  debugLog("Saving to DynamoDB", { tableName: table_name }, 'DEBUG');
  try {
    const results = await dbclient.send(command);
    debugLog("Items saved successfully to DynamoDB", { tableName: table_name }, 'INFO');
  } catch (err) {
    debugLog("Error saving to DynamoDB", { tableName: table_name, error: err }, 'ERROR');
  }
};

// message table api
const queryDynamoDb = async (key, target) => {
  const queryKey = { chat_id: { S: key } };
  const results = await _queryDynamoDb(dynamodb_tb_messages, queryKey);
  if (results != null && target in results.Item) {
    return JSON.parse(results.Item[target].S);
  }
  return null;
};

const saveDynamoDb = async (chat_id, messages, system_prompt) => {
  debugLog("Saving conversation data to DynamoDB", { chat_id }, 'INFO');
  const oneDayLater = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  const item = {
    chat_id: { S: chat_id },
    messages: { S: JSON.stringify(messages) },
    system_prompt: { S: JSON.stringify(system_prompt) },
    expire_at: { N: oneDayLater.toString() }
  }
  debugLog("DynamoDB item to save", { chat_id, messagesCount: messages?.length }, 'DEBUG');
  _saveDynamoDb(dynamodb_tb_messages, item);
}

// Stats table API for token usage tracking
const queryStatsDDB = async (key) => {
  const queryKey = { app_id: { S: key } };
  const results = await _queryDynamoDb(dynamodb_tb_stats, queryKey);
  if (results != null && 'tokens' in results.Item) {
    return JSON.parse(results.Item.tokens.S);
  }
  debugLog("No token stats found for app", { appId: key }, 'INFO');
  return null;
};

const saveStatsDDB = async (key, input_tokens, output_tokens) => {
  debugLog("Saving token stats to DynamoDB", { appId: key, input_tokens, output_tokens }, 'INFO');
  const token_counter = { input_tokens: input_tokens, output_tokens: output_tokens };
  const item = {
    app_id: { S: key },
    tokens: { S: JSON.stringify(token_counter) }
  };
  _saveDynamoDb(dynamodb_tb_stats, item);
}

const sendLarkMessage = async (open_chat_id, msg) => {
  await larkclient.im.message.create({
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: open_chat_id,
      content: JSON.stringify({ text: msg }),
      msg_type: 'text',
    },
  });
}

const streamLarkMessage = async (message_id, card) => {
  //console.log("=====streamLarkMessage=====");
  return await larkclient.im.message.patch({
    path: {
      message_id: message_id,
    },
    data: {
      content: card,
    },
  }
  );
}

const replayLarkMessage = async (message_id, card, msg_type) => {
  console.log("=====replayLarkMessage=====");
  console.log(card);
  return await larkclient.im.message.reply({
    path: {
      message_id: message_id,
    },
    data: {
      content: card,
      msg_type: msg_type,
      reply_in_thread: false,
      uuid: utils.generateUUID(),
    },
  },
  ).then(res => {
    return res;
  });
}

const getLarkfile = async (message_id, filekey, type, desc) => {
  let resp;
  const tempFileName = `/tmp/${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}.png`
  try {
    resp = await larkclient.im.messageResource.get({
      path: {
        message_id: message_id,
        file_key: filekey,
      },
      params: {
        type: type,
      },
    });

    await resp.writeFile(tempFileName)
    const base64String = toBase64(tempFileName);
    const contents = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: base64String,
        }
      },
      { type: "text", text: desc }];
    debugLog("Created image content for Claude:", { imageIncluded: true, textLength: desc.length });
    return { role: 'user', content: contents };

  } catch (err) {
    console.error("Error processing image:", err);
  } finally {
    fs.unlinkSync(tempFileName);
    debugLog("Temporary image file deleted");
  }
}

export const handler = async (event) => {
  debugLog("Handler started with event:", event);
  const body = JSON.parse(event.Records[0].Sns.Message);

  const open_chat_id = body.open_chat_id;
  const msg_type = body.msg_type;
  const message_id = body.message_id;
  debugLog("Processing message parameters:", body);

  let msg;
  let current_msg;
  let system_prompt;
  if (msg_type == 'text') {
    msg = body.msg;
    debugLog("Processing text message:", msg);
    current_msg = { role: 'user', content: msg }
  } else if (msg_type == 'image') {
    debugLog("Processing image message");
    const mage_key = body.msg;
    let desc = aws_claude_img_desc_prompt;
    system_prompt = await queryDynamoDb(open_chat_id, "system_prompt");
    if (!isEmpty(system_prompt)) {
      desc = system_prompt;
      debugLog("Using custom system prompt for image description");
    }
    current_msg = await getLarkfile(message_id, mage_key, msg_type, desc);
  } else {
    debugLog("Unsupported message format:", msg_type);
    await sendLarkMessage(open_chat_id, "'${msg_type}' format is unsupported.");
    return { statusCode: 200, }
  }
  debugLog("Current message processed:", current_msg);

  let messages;
  let prev_msgs;
  //send command to clear the messages
  if (msg === start_command) { // /rs
    debugLog("Reset command received, clearing conversation history");
    await saveDynamoDb(open_chat_id, null, null);
    await sendLarkMessage(open_chat_id, "Flushed! Let's chat!");
    return { statusCode: 200 }
  } else if (msg === debug_command) { // /debug
    debugLog("Debug command received");
    const currentDebugMode = process.env.DEBUG_MODE === '1' ? 'enabled' : 'disabled';
    await sendLarkMessage(open_chat_id, `Debug mode is currently ${currentDebugMode}. Set DEBUG_MODE=1 in .env to enable detailed logging.`);
    return { statusCode: 200 }
  } else if (msg === token_count_command) { // /tc
    debugLog("Token count command received");
    const tokens = await queryStatsDDB(process.env.LARK_APPID);
    await sendLarkMessage(open_chat_id, JSON.stringify(tokens));
    return { statusCode: 200 }
  } else if (!isEmpty(msg) && msg.startsWith('/sp ')) { // /sp
    debugLog("System prompt update command received");
    const match = msg.match(/\/sp \s*(.*)/);
    if (match) {
      prev_msgs = await queryDynamoDb(open_chat_id, "messages");

      const sytem_prompt = match[1];
      debugLog("Updating system prompt to:", sytem_prompt.trim());
      await saveDynamoDb(open_chat_id, prev_msgs, sytem_prompt.trim());
      await sendLarkMessage(open_chat_id, "System prompt updated! Let's chat!");
    }
    return { statusCode: 200 }
  } else {
    debugLog("Regular message, retrieving conversation history");
    prev_msgs = await queryDynamoDb(open_chat_id, "messages");
    system_prompt = await queryDynamoDb(open_chat_id, "system_prompt");
  }
  //append the previous msgs
  if (prev_msgs) {
    debugLog("Previous messages found, count:", prev_msgs.length);
    if (prev_msgs.length > aws_claude_max_chat_quota_per_user) {
      debugLog("Max chat quota reached for user");
      await sendLarkMessage(open_chat_id, "max chat quota reached!");
      return { statusCode: 200 }
    }
    messages = [...prev_msgs, current_msg];
    if (messages.length > MAX_SEQ) {
      debugLog(`Message count (${messages.length}) exceeds MAX_SEQ (${MAX_SEQ}), trimming conversation history`);
      messages = messages.slice(messages.length - MAX_SEQ,)
    }
  } else {
    debugLog("No previous messages found, starting new conversation");
    messages = [current_msg];
  }
  debugLog("Final message array length:", messages.length);

  let text;
  let message;
  let response;
  try {
    let sp = aws_claude_system_prompt;
    if (!isEmpty(system_prompt)) {
      sp = system_prompt;
      debugLog("Using custom system prompt:", sp);
    } else {
      debugLog("Using default system prompt");
    }
    
    // 构造首次响应卡片
    debugLog("Building response card");
    let card_content;
    let msg_body = body.msg_body;
    // Initial card can be enabled for immediate feedback
    // debugLog("Sending initial 'thinking' response card");
    // card_content = buildCard("Pending", getCurrentTime(), "...", "", false, true);
    // msg_body = await replayLarkMessage(message_id, card_content, "interactive");
    
    if (msg_body.msg == 'success') {
      debugLog("Starting Claude3 streaming invocation");
      response = await invokeClaude3Stream(messages, sp, async function (msg, endmsg, end) {
        debugLog("Streaming update received", { messageLength: msg.length, isEnd: end });
        card_content = buildCard("Result", getCurrentTime(), msg, endmsg, end, true);
        await streamLarkMessage(msg_body.data.message_id, card_content);
      });

      text = response.content[0];
      message = { role: 'assistant', content: text.text.trimStart() }
      debugLog("Claude3 response complete", { responseLength: message.content.length });

      messages = [...messages, message];
      await saveDynamoDb(open_chat_id, messages, sp)
      debugLog("Conversation history saved to DynamoDB");

      debugLog("Updating token statistics");
      const input_tokens = response.usage.input_tokens;
      const output_tokens = response.usage.output_tokens;
      let tokens = await queryStatsDDB(process.env.LARK_APPID);
      if (!isEmpty(tokens)) {
        debugLog("Existing token stats:", tokens);
        tokens.input_tokens += input_tokens;
        tokens.output_tokens += output_tokens;
        debugLog("Updated token stats:", tokens);
      }
      await saveStatsDDB(process.env.LARK_APPID, tokens.input_tokens, tokens.output_tokens);
      debugLog("Token statistics saved to DynamoDB");
    }

    return {
      statusCode: 200,
    };

  } catch (error) {
    debugLog("Error in handler:", { 
      message: error.message, 
      stack: error.stack,
      name: error.name
    }, 'ERROR');
    
    try {
      await sendLarkMessage(open_chat_id, "An error occurred while processing your request. Please try again later.");
    } catch (sendError) {
      debugLog("Failed to send error message to Lark:", sendError, 'ERROR');
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

