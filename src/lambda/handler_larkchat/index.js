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

const { debugLog, buildCard, getCurrentTime } = require('../utils');
const { AIModelFactory } = require('../factories/AIModelFactory');

// DynamoDB table names from environment variables
const dynamodb_tb_messages = process.env.DB_TABLE;
const dynamodb_tb_stats = process.env.DB_STATS_TABLE;
const dbclient = new DynamoDBClient();

const start_command = process.env.START_CMD;
const token_count_command = '/tc';
const prompt_template_command = '/sp';
const debug_command = '/debug';

const MAX_SEQ = parseInt(process.env.AWS_CLAUDE_MAX_SEQ) * 2 + 1;
const aws_claude_img_desc_prompt = process.env.AWS_CLAUDE_IMG_DESC_PROMPT
const aws_claude_system_prompt = process.env.AWS_CLAUDE_SYSTEM_PROMPT
const aws_claude_max_chat_quota_per_user = process.env.AWS_CLAUDE_MAX_CHAT_QUOTA_PER_USER
const ai_model_type = process.env.AI_MODEL_TYPE || 'claude3';

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

  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }

  if (typeof value === 'undefined') {
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

async function sendLarkMessage(open_chat_id, content, msg_type = "text") {
  debugLog("Sending Lark message", { open_chat_id, contentLength: content.length, msg_type });
  try {
    const res = await larkclient.im.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: open_chat_id,
        content: msg_type === "text" ? JSON.stringify({ text: content }) : content,
        msg_type: msg_type,
      },
    });
    debugLog("Lark message sent successfully", res);
    return res;
  } catch (error) {
    debugLog("Error sending Lark message", error, 'ERROR');
    throw error;
  }
}

async function replayLarkMessage(message_id, content, msg_type = "text") {
  debugLog("Replying to Lark message", { message_id, contentLength: content.length, msg_type });
  try {
    const res = await larkclient.im.message.reply({
      path: {
        message_id: message_id,
      },
      data: {
        content: msg_type === "text" ? JSON.stringify({ text: content }) : content,
        msg_type: msg_type,
      },
    });
    debugLog("Lark message reply sent successfully", res);
    return res;
  } catch (error) {
    debugLog("Error replying to Lark message", error, 'ERROR');
    throw error;
  }
}

async function streamLarkMessage(message_id, content) {
  debugLog("Streaming Lark message update", { message_id, contentLength: content.length });
  try {
    const res = await larkclient.im.message.patch({
      path: {
        message_id: message_id,
      },
      data: {
        content: content,
      },
    });
    debugLog("Lark message update sent successfully", res);
    return res;
  } catch (error) {
    debugLog("Error updating Lark message", error, 'ERROR');
    throw error;
  }
}

async function queryDynamoDb(chat_id) {
  debugLog("Querying DynamoDB for chat history", { chat_id });
  try {
    const command = new GetItemCommand({
      TableName: dynamodb_tb_messages,
      Key: {
        chat_id: { S: chat_id },
      },
    });
    const response = await dbclient.send(command);
    debugLog("DynamoDB query response received", { hasItem: !!response.Item });
    return response.Item;
  } catch (error) {
    debugLog("Error querying DynamoDB", error, 'ERROR');
    throw error;
  }
}

async function saveDynamoDb(chat_id, messages, system_prompt) {
  debugLog("Saving to DynamoDB", { chat_id, messagesCount: messages.length });
  try {
    const expire_at = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
    const command = new PutItemCommand({
      TableName: dynamodb_tb_messages,
      Item: {
        chat_id: { S: chat_id },
        messages: { S: JSON.stringify(messages) },
        system_prompt: { S: system_prompt },
        expire_at: { N: expire_at.toString() },
      },
    });
    await dbclient.send(command);
    debugLog("DynamoDB save successful");
  } catch (error) {
    debugLog("Error saving to DynamoDB", error, 'ERROR');
    throw error;
  }
}

async function queryStatsDDB(app_id) {
  debugLog("Querying DynamoDB for token statistics", { app_id });
  try {
    const command = new GetItemCommand({
      TableName: dynamodb_tb_stats,
      Key: {
        app_id: { S: app_id },
      },
    });
    const response = await dbclient.send(command);
    debugLog("DynamoDB stats query response received", { hasItem: !!response.Item });
    
    if (response.Item) {
      return {
        input_tokens: parseInt(response.Item.input_tokens.N),
        output_tokens: parseInt(response.Item.output_tokens.N),
      };
    } else {
      return {
        input_tokens: 0,
        output_tokens: 0,
      };
    }
  } catch (error) {
    debugLog("Error querying DynamoDB for stats", error, 'ERROR');
    throw error;
  }
}

async function saveStatsDDB(app_id, input_tokens, output_tokens) {
  debugLog("Saving token statistics to DynamoDB", { app_id, input_tokens, output_tokens });
  try {
    const command = new PutItemCommand({
      TableName: dynamodb_tb_stats,
      Item: {
        app_id: { S: app_id },
        input_tokens: { N: input_tokens.toString() },
        output_tokens: { N: output_tokens.toString() },
      },
    });
    await dbclient.send(command);
    debugLog("DynamoDB stats save successful");
  } catch (error) {
    debugLog("Error saving stats to DynamoDB", error, 'ERROR');
    throw error;
  }
}

export const handler = async (event, context) => {
  debugLog("Event received", { event });
  let open_chat_id;
  let system_prompt = aws_claude_system_prompt;
  let messages = [];
  let current_msg;
  let body;

  try {
    body = JSON.parse(event.Records[0].Sns.Message);
    debugLog("Parsed SNS message body", { bodyType: typeof body });
    
    const message_id = body.msg_body.data.message_id;
    open_chat_id = body.msg_body.data.open_chat_id;
    debugLog("Extracted message details", { message_id, open_chat_id });

    // Check if the message is a command
    if (body.msg_body.data.text_without_at_bot) {
      const text = body.msg_body.data.text_without_at_bot.trim();
      debugLog("Processing message text", { text });

      // Handle token count command
      if (text === token_count_command) {
        debugLog("Token count command received");
        const tokens = await queryStatsDDB(process.env.LARK_APPID);
        if (isEmpty(tokens)) {
          await sendLarkMessage(open_chat_id, "No token usage data available.");
        } else {
          await sendLarkMessage(open_chat_id, `Token usage: Input: ${tokens.input_tokens}, Output: ${tokens.output_tokens}`);
        }
        return { statusCode: 200 };
      }

      // Handle system prompt command
      if (text.startsWith(prompt_template_command)) {
        debugLog("System prompt command received");
        const new_prompt = text.substring(prompt_template_command.length).trim();
        if (isEmpty(new_prompt)) {
          await sendLarkMessage(open_chat_id, `Current system prompt: ${system_prompt}`);
        } else {
          system_prompt = new_prompt;
          await saveDynamoDb(open_chat_id, [], system_prompt);
          await sendLarkMessage(open_chat_id, `System prompt updated: ${system_prompt}`);
        }
        return { statusCode: 200 };
      }

      // Handle debug command
      if (text === debug_command) {
        debugLog("Debug command received");
        const item = await queryDynamoDb(open_chat_id);
        if (isEmpty(item)) {
          await sendLarkMessage(open_chat_id, "No conversation history found.");
        } else {
          const messages = JSON.parse(item.messages.S);
          const system_prompt = item.system_prompt.S;
          await sendLarkMessage(open_chat_id, `System prompt: ${system_prompt}\nMessages: ${messages.length}`);
        }
        return { statusCode: 200 };
      }

      // Handle start command
      if (text === start_command) {
        debugLog("Start command received");
        await saveDynamoDb(open_chat_id, [], system_prompt);
        await sendLarkMessage(open_chat_id, "Conversation history cleared.");
        return { statusCode: 200 };
      }

      // Process regular message
      current_msg = { role: 'user', content: text };
      debugLog("User message processed", current_msg);
    } else if (body.msg_body.data.image_keys && body.msg_body.data.image_keys.length > 0) {
      // Handle image message
      debugLog("Image message received", { imageKeys: body.msg_body.data.image_keys });
      
      const imageKey = body.msg_body.data.image_keys[0];
      const imageInfo = await larkclient.im.file.get({
        path: {
          file_key: imageKey,
        },
      });
      
      debugLog("Image info retrieved", { imageInfo });
      
      // Create a message with image content
      current_msg = {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageInfo.data.file_type};base64,${imageInfo.data.content}`,
            }
          },
          {
            type: 'text',
            text: aws_claude_img_desc_prompt || "Describe this image"
          }
        ]
      };
      
      debugLog("Image message processed", { messageType: current_msg.role });
    } else {
      debugLog("Unsupported message type", body.msg_body.data);
      await sendLarkMessage(open_chat_id, "Unsupported message type.");
      return { statusCode: 200 };
    }

  } catch (error) {
    debugLog("Error parsing event or extracting message details", error, 'ERROR');
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  // Query DynamoDB for previous messages
  try {
    const item = await queryDynamoDb(open_chat_id);
    
    if (!isEmpty(item)) {
      const prev_msgs = JSON.parse(item.messages.S);
      if (!isEmpty(item.system_prompt)) {
        system_prompt = item.system_prompt.S;
        debugLog("Retrieved custom system prompt from DynamoDB", { systemPrompt: system_prompt });
      }
      
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
        debugLog(`Creating AI model service with type: ${ai_model_type}`);
        
        try {
          // Create AI model service using factory with default configuration
          const modelService = AIModelFactory.createModelService(ai_model_type);
          
          debugLog("Starting AI model streaming invocation");
          response = await modelService.invokeModelStream(messages, sp, async function (msg, endmsg, end) {
            debugLog("Streaming update received", { messageLength: msg.length, isEnd: end });
            card_content = buildCard("Result", getCurrentTime(), msg, endmsg, end, true);
            await streamLarkMessage(msg_body.data.message_id, card_content);
          });

          text = response.content[0];
          message = { role: 'assistant', content: text.text.trimStart() }
          debugLog("AI model response complete", { responseLength: message.content.length });

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
        } catch (modelError) {
          debugLog("Error invoking AI model", modelError, 'ERROR');
          throw modelError;
        }
      }
    } catch (processingError) {
      debugLog("Error processing message", processingError, 'ERROR');
      throw processingError;
    }

    return {
      statusCode: 200
    };
  } catch (error) {
    debugLog("Error in handler", { 
      message: error.message, 
      stack: error.stack,
      name: error.name
    }, 'ERROR');
    
    try {
      await sendLarkMessage(open_chat_id, "An error occurred while processing your request. Please try again later.");
    } catch (sendError) {
      debugLog("Failed to send error message to Lark", sendError, 'ERROR');
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
