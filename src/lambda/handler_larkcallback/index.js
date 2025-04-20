// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as lark from '@larksuiteoapi/node-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { DynamoDBClient,
    UpdateCommand,
    GetItemCommand, 
    PutItemCommand } from "@aws-sdk/client-dynamodb";

const { debugLog } = require('../utils');

const snsclient = new SNSClient();
const topicArn = process.env.SNS_TOPIC_ARN;
const lark_token = process.env.LARK_TOKEN;
// Generate UUID for message tracking
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const lark_encrypt_key = process.env.LARK_ENCRYPT_KEY

const dynamodb_tb_events = 'lark_events';
const dbclient = new DynamoDBClient();

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

const larkclient = new lark.Client({
    appId: process.env.LARK_APPID,
    appSecret: process.env.LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
});

const replayLarkMessage = async(message_id, card, msg_type) => {
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
            uuid: generateUUID(),
        },
        },
    ).then(res => {
        debugLog("Lark message reply response:", res);
        return res;
    });
}

const _queryDynamoDb = async (table_name, key) => {
    const params = {
      Key: key,
      TableName: table_name,
    };
    const command = new GetItemCommand(params);
    debugLog("Querying DynamoDB with params:", params);
    try {
      const results = await dbclient.send(command);
      debugLog("DynamoDB query results:", results);
      if (results==null || !results.Item) {
        debugLog("No item found in DynamoDB");
        return null;
      } 
      return results;
    } catch (err) {
      console.error("DynamoDB query error:", err);
      return null;
    }
  };
  
  const _saveDynamoDb = async (table_name,item) =>{
    const params = {
        TableName:table_name,
        Item:item
    }
    const command = new PutItemCommand(params);
    try {
        const results = await dbclient.send(command);
        debugLog("Items saved successfully to DynamoDB:", results);
    } catch (err) {
        console.error("Error saving to DynamoDB:", err);
    }
  };
  
// system table api
const queryEventsDDB = async (key) => {
    debugLog("Querying events from DynamoDB with key:", key);
    const queryKey = { event_id: { S: key } };
    const results = await _queryDynamoDb(dynamodb_tb_events, queryKey);
    if (results!=null &&  'header_data' in results.Item){
        const headerData = JSON.parse(results.Item.header.S);
        debugLog("Retrieved header data:", headerData);
        return headerData;
    }
    debugLog("No header data found for key:", key);
    return null;
};

const saveEventsDDB = async (event_id, header) =>{
    debugLog("Saving event to DynamoDB:", { event_id, header });
    const oneDayLater = Math.floor(Date.now()/1000) + (24 * 60 * 60 );
    const item = {
        event_id: { S: event_id }, 
        header_data: {S: JSON.stringify(header)},
        expire_at:{N: oneDayLater.toString()}
    };
    debugLog("DynamoDB item to save:", item);
    _saveDynamoDb(dynamodb_tb_events, item);
}

// 解密飞书消息
function decryptData(encrypt, key) {
    debugLog("Decrypting Lark message");
    try {
        const crypto = require('crypto');
        const keyBuffer = Buffer.from(key, 'utf8');
        const keyHash = crypto.createHash('sha256').update(keyBuffer).digest();
        
        const encryptBuffer = Buffer.from(encrypt, 'base64');
        const iv = encryptBuffer.slice(0, 16);
        const encryptedData = encryptBuffer.slice(16);
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const decryptedData = JSON.parse(decrypted.toString('utf8'));
        debugLog("Successfully decrypted data");
        return decryptedData;
    } catch (err) {
        console.error('Decrypt error:', err);
        return null;
    }
}

export const handler = async(event) => {
    debugLog("Received event:", event);
    
    // 确保event.body存在
    if (!event.body) {
        debugLog("No event body found");
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No event body found" })
        };
    }
    
    let rawData = JSON.parse(event.body);
    debugLog("Raw data:", rawData);
    
    // 处理加密数据
    let data = rawData;
    if (rawData.encrypt && lark_encrypt_key) {
        debugLog("Encrypted data detected, attempting to decrypt");
        const decryptedData = decryptData(rawData.encrypt, lark_encrypt_key);
        if (decryptedData) {
            debugLog("Decrypted data:", decryptedData);
            data = decryptedData;
        } else {
            console.error("Failed to decrypt data");
        }
    }
    
    // 处理URL验证请求 - 支持多种可能的格式
    if (data.type === 'url_verification' || 
        (data.challenge && typeof data.challenge === 'string') || 
        (data.schema && data.header && data.header.event_type === 'url_verification')) {
        
        const challenge = data.challenge || (data.event && data.event.challenge);
        debugLog("URL verification detected, challenge:", challenge);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                challenge: challenge
            })
        };
    } else if (data.header && data.header.token === lark_token){
        if (data.header.event_type === 'im.message.receive_v1') {
            debugLog("Received message event:", data);
            const message = data.event.message;
            const message_id = message.message_id;
            const msg_type = message.message_type;
            const open_chat_id = message.chat_id;
            const event_id = data.header.event_id;

            try{
                debugLog("Checking for duplicate event:", event_id);
                let event = await queryEventsDDB(event_id);
                if (!isEmpty(event)){
                    console.error("!!!DUPLICATE EVENT!!!");
                    debugLog("Duplicate event detected, ignoring");
                    return { statusCode: 200, }
                }

                await saveEventsDDB(event_id, data.header);
                let msg
                if (msg_type == 'text'){
                    msg = JSON.parse(message.content).text;
                    debugLog("Received text message:", msg);
                }else if (msg_type == 'image'){
                    msg = JSON.parse(message.content).image_key;
                }else {

                }
               

                try{
                    // 构造首次响应卡片
                    console.log("========5. buildCard=========");
                    let card_content;
                    let msg_body;
                    card_content = utils.buildCard("Pending", utils.getCurrentTime(), "...", "", false, true);
                    console.log("========6. replayLarkMessage=========");
                    msg_body = await replayLarkMessage(message_id, card_content, "interactive");

                     // const msg = JSON.parse(message.content).text;
                    const command = new PublishCommand({
                        TopicArn:topicArn,
                        Message:JSON.stringify({
                            msg_type: msg_type,
                            msg: msg,
                            open_chat_id: open_chat_id,
                            message_id: message_id,
                            msg_body: msg_body,
                        })
                    });

                    await snsclient.send(command);

                }catch(err){
                    console.error("!!!ERR2!!!");
                    console.log(JSON.stringify(err));
                    await larkclient.im.message.create({
                        params: {
                            receive_id_type: 'chat_id',
                        },
                        data: {
                            receive_id: open_chat_id,
                            content: JSON.stringify({text:"!!something error"}),
                            msg_type: 'text',
                        },
                    });
                }

                return { statusCode: 200, }
            }catch(err){
                console.error("!!!ERR1!!!");
                console.log(JSON.stringify(err));
            } finally {
                
            }
        }
    }else{
        console.log("Invalid token or unrecognized request type:", JSON.stringify(data));
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request" })
        }
    }
};
