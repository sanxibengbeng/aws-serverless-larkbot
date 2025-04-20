import { randomBytes } from 'crypto';
import {
  AccessDeniedException,
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Debug logging function with timestamp and optional log level
// Only logs if DEBUG_MODE environment variable is set to '1'
export const debugLog = (message, data = null, level = 'INFO') => {
  // Check if DEBUG_MODE is enabled (value is '1')
  const debugMode = process.env.DEBUG_MODE == 1;

  // If debug mode is not enabled, return early without logging
  if (!debugMode) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  // For ERROR level, capture and include stack trace
  if (level === 'ERROR') {
    // Create an Error object to capture the current stack trace
    const stackTrace = new Error().stack
      .split('\n')
      .slice(2) // Skip the Error constructor and this function call
      .join('\n');
    
    if (data) {
      if (typeof data === 'object') {
        // If data is an error object, include its message and stack if available
        if (data instanceof Error) {
          console.log(`${prefix} ${message}`, JSON.stringify({
            errorMessage: data.message,
            errorName: data.name,
            errorStack: data.stack || 'No stack trace available',
            callStack: stackTrace
          }, null, 2));
        } else {
          console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
          console.log(`${prefix} STACK TRACE:\n${stackTrace}`);
        }
      } else {
        console.log(`${prefix} ${message}`, data);
        console.log(`${prefix} STACK TRACE:\n${stackTrace}`);
      }
    } else {
      console.log(`${prefix} ${message}`);
      console.log(`${prefix} STACK TRACE:\n${stackTrace}`);
    }
  } else {
    // For non-ERROR levels, use the original logging logic
    if (data) {
      if (typeof data === 'object') {
        console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
      } else {
        console.log(`${prefix} ${message}`, data);
      }
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

const aws_ak = process.env.AWS_AK
const aws_sk = process.env.AWS_SK
const aws_region_code = process.env.AWS_REGION_CODE
const aws_llm = process.env.AWS_BEDROCK_CLAUDE_SONNET

// Log configuration only if debug mode is enabled
debugLog('Environment variables loaded', {
  region: aws_region_code,
  model: aws_llm
}, 'CONFIG');

function getRandomInt(min, max) {
  // 确保 min 小于 max
  if (min >= max) {
    debugLog('Invalid random range', { min, max }, 'ERROR');
    throw new Error('min 必须小于 max');
  }

  // 生成一个介于 min 和 max 之间的随机整数
  const result = Math.floor(Math.random() * (max - min + 1)) + min;
  debugLog('Generated random integer', { min, max, result }, 'DEBUG');
  return result;
}

export function generateUUID() {
  const uuid = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ (randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
  );
  debugLog('Generated UUID', uuid, 'DEBUG');
  return uuid;
}

export const getCurrentTime = function () {
  const now = new Date();
  const time = now.toISOString().replace('T', ' ').slice(0, 19);
  debugLog('Current time', time, 'DEBUG');
  return time;
}

export const buildCard = function (header, time, content, endmsg, end, robot) {
  debugLog('Building card', { header, time, contentLength: content?.length, endmsg, end, robot }, 'DEBUG');

  let endMsg = "正在思考，请稍等..."
  if (end) {
    if (endmsg) {
      endMsg = endmsg;
    }
    endMsg += time
  }
  const card = {
    elements: [
      {
        tag: 'markdown',
        content: content,
        text_align: 'left'
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: endMsg
          }
        ]
      }
    ]
  };

  debugLog('Card built successfully', { endMsg }, 'DEBUG');
  return JSON.stringify(card);
}

export const invokeClaude3Stream = async (messages, system_prompt, callback) => {
  debugLog('Invoking Claude3 Stream', {
    messagesCount: messages.length,
    systemPromptLength: system_prompt.length
  }, 'INFO');

  const client = new BedrockRuntimeClient({
    region: aws_region_code,
    credentials: {
      accessKeyId: aws_ak,
      secretAccessKey: aws_sk,
    },
  });

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    system: system_prompt,
    messages: messages,
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: 2048,
  };

  debugLog('Claude3 Stream payload prepared', {
    anthropic_version: payload.anthropic_version,
    temperature: payload.temperature,
    top_p: payload.top_p,
    max_tokens: payload.max_tokens
  }, 'DEBUG');

  const command = new InvokeModelWithResponseStreamCommand({
    body: JSON.stringify(payload),
    contentType: "application/json",
    accept: "application/json",
    modelId: aws_llm,
  });

  try {
    debugLog('Sending stream request to Bedrock', { modelId: aws_llm }, 'INFO');
    const apiResponse = await client.send(command);
    let completeMessage = "";
    let inputTokenCount = 0;
    let outputTokenCount = 0;

    let idx = 0
    for await (const item of apiResponse.body) {
      // Decode each chunk
      const chunk = JSON.parse(new TextDecoder().decode(item.chunk.bytes));

      // Get its type
      const chunk_type = chunk.type;

      // Process the chunk depending on its type
      if (chunk_type === "message_start") {
        // The "message_start" chunk contains the message's role
        debugLog(`Message start received with role: ${chunk.message.role}`, null, 'DEBUG');
      } else if (chunk_type === "content_block_delta") {
        // The "content_block_delta" chunks contain the actual response text

        // Print each individual chunk in real-time
        process.stdout.write(chunk.delta.text);

        // ... and add it to the complete message
        completeMessage = completeMessage + chunk.delta.text;

        if (idx % getRandomInt(10, 20) == 0) {
          debugLog('Sending partial response to callback', {
            messageLength: completeMessage.length,
            chunkIndex: idx
          }, 'DEBUG');
          await callback(completeMessage, "", false)
        }
        idx++;
      } else if (chunk_type === "message_stop") {
        // The "message_stop" chunk contains some metrics
        const metrics = chunk["amazon-bedrock-invocationMetrics"];
        inputTokenCount = metrics.inputTokenCount;
        outputTokenCount = metrics.outputTokenCount;

        debugLog('Stream completed', {
          inputTokenCount: metrics.inputTokenCount,
          outputTokenCount: metrics.outputTokenCount,
          invocationLatency: metrics.invocationLatency,
          firstByteLatency: metrics.firstByteLatency
        }, 'INFO');

        let endmsg = "input:" + inputTokenCount + " output:" + outputTokenCount + " ";
        await callback(completeMessage, endmsg, true)
      }
    }
    // Print the complete message.
    debugLog('Complete response received', {
      responseLength: completeMessage.length,
      inputTokens: inputTokenCount,
      outputTokens: outputTokenCount
    }, 'INFO');

    const response = {
      content: [{ type: 'text', text: completeMessage }],
      usage: { input_tokens: inputTokenCount, output_tokens: outputTokenCount },
    }

    return response;

  } catch (err) {
    if (err instanceof AccessDeniedException) {
      debugLog(`Access denied error when invoking ${aws_llm}`, err, 'ERROR');
      console.error(
        `Access denied. Ensure you have the correct permissions to invoke ${aws_llm}.`,
      );
    } else {
      debugLog('Error invoking Claude3 Stream', err, 'ERROR');
      throw err;
    }
  } finally {
    debugLog('Claude3 Stream invocation completed', null, 'DEBUG');
  }
}

export const invokeClaude3 = async (messages, system_prompt) => {
  debugLog('Invoking Claude3', {
    messagesCount: messages.length,
    systemPromptLength: system_prompt.length
  }, 'INFO');

  const client = new BedrockRuntimeClient({
    region: aws_region_code,
    credentials: {
      accessKeyId: aws_ak,
      secretAccessKey: aws_sk,
    },
  });

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    system: system_prompt,
    messages: messages,
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: 2048,
  };

  debugLog('Claude3 payload prepared', {
    anthropic_version: payload.anthropic_version,
    temperature: payload.temperature,
    top_p: payload.top_p,
    max_tokens: payload.max_tokens
  }, 'DEBUG');

  const command = new InvokeModelCommand({
    body: JSON.stringify(payload),
    contentType: "application/json",
    accept: "application/json",
    modelId: aws_llm,
  });

  try {
    debugLog('Sending request to Bedrock', { modelId: aws_llm }, 'INFO');
    const response = await client.send(command);
    const decodedResponseBody = new TextDecoder().decode(response.body);
    const responseBody = JSON.parse(decodedResponseBody);

    debugLog('Response received from Claude3', {
      contentLength: responseBody.content?.length,
      type: responseBody.type
    }, 'INFO');

    return responseBody;
  } catch (err) {
    if (err instanceof AccessDeniedException) {
      debugLog(`Access denied error when invoking ${aws_llm}`, err, 'ERROR');
      console.error(
        `Access denied. Ensure you have the correct permissions to invoke ${aws_llm}.`,
      );
    } else {
      debugLog('Error invoking Claude3', err, 'ERROR');
      throw err;
    }
  } finally {
    debugLog('Claude3 invocation completed', null, 'DEBUG');
  }
};


export const buildCardTest = (header, time, content, end, robot) => {
  debugLog('Building test card', {
    header,
    time,
    contentLength: content?.length,
    end,
    robot
  }, 'DEBUG');

  if (content) {
    content = content.replace(/^(.*)/gm, '**\$1**');
    debugLog('Content formatted for card', { contentLength: content.length }, 'DEBUG');
  } else if (robot) {
    const card = {
      elements: [
        {
          tag: 'markdown',
          content: content,
          text_align: 'left',
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '正在思考，请稍等...',
            },
          ],
        },
      ],
    };

    debugLog('Robot thinking card created', null, 'DEBUG');
    return JSON.stringify(card);
  }

  if (robot) {
    let note;
    if (end) {
      note = '🤖温馨提示✨✨：输入<帮助> 或 /help 即可获取帮助菜单';
    } else {
      note = '正在处理中，请稍等...';
    }

    const card = {
      elements: [
        {
          tag: 'markdown',
          content: content,
          text_align: 'left',
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: note,
            },
          ],
        },
      ],
    };

    debugLog('Robot card created', { end, note }, 'DEBUG');
    return JSON.stringify(card);
  }

  if (end) {
    debugLog('Creating end card', { header, time }, 'DEBUG');
    const card = {
      elements: [
        {
          tag: 'column_set',
          flex_mode: 'none',
          background_style: 'default',
          columns: [
            {
              tag: 'column',
              width: 'weighted',
              weight: 1,
              vertical_align: 'top',
              elements: [
                {
                  tag: 'div',
                  text: {
                    content: '**🕐 完成时间：**\n${time}',
                    tag: 'lark_md',
                  },
                },
                {
                  tag: 'markdown',
                  content: content,
                  text_align: 'left',
                },
              ],
            },
          ],
        },
        {
          tag: 'column_set',
          flex_mode: 'none',
          background_style: 'default',
          columns: [],
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: '**📝祝您生活愉快**',
              },
            },
          ],
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '🤖温馨提示✨✨：输入<帮助> 或 /help 即可获取帮助菜单',
            },
          ],
        },
      ],
      header: {
        template: 'violet',
        title: {
          content: header,
          tag: 'plain_text',
        },
      },
    };

    return JSON.stringify(card);
  }

  debugLog('Creating standard card', { header, time }, 'DEBUG');
  const card = {
    elements: [
      {
        tag: 'column_set',
        flex_mode: 'none',
        background_style: 'default',
        columns: [
          {
            tag: 'column',
            width: 'weighted',
            weight: 1,
            vertical_align: 'top',
            elements: [
              {
                tag: 'div',
                text: {
                  content: `**🕐 响应时间：**\n${time}`,
                  tag: 'lark_md',
                },
              },
              {
                tag: 'markdown',
                content: content,
                text_align: 'left',
              },
            ],
          },
        ],
      },
      {
        tag: 'column_set',
        flex_mode: 'none',
        background_style: 'default',
        columns: [],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '赞一下',
            },
            type: 'primary',
            value: {
              success: true,
              text: 'praise',
            },
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '踩一下',
            },
            type: 'danger',
            value: {
              success: false,
              text: 'praise',
            },
          },
        ],
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: '🤖温馨提示✨✨：输入<帮助> 或 /help 即可获取帮助菜单',
          },
        ],
      },
    ],
    header: {
      template: 'violet',
      title: {
        content: header,
        tag: 'plain_text',
      },
    },
  };

  return JSON.stringify(card);
};
