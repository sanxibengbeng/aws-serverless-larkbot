const { AIModelStreamInterface } = require('../interfaces/AIModelStreamInterface');
const {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} = require("@aws-sdk/client-bedrock-runtime");

/**
 * Claude3 implementation of the AI model streaming interface
 */
class Claude3StreamService extends AIModelStreamInterface {
  constructor(config) {
    super();
    this.region = config.region || process.env.AWS_REGION_CODE;
    this.accessKeyId = config.accessKeyId || process.env.AWS_AK;
    this.secretAccessKey = config.secretAccessKey || process.env.AWS_SK;
    this.modelId = config.modelId || process.env.AWS_BEDROCK_CLAUDE_SONNET;
    this.temperature = config.temperature || 0.8;
    this.topP = config.topP || 0.9;
    this.maxTokens = config.maxTokens || 2048;
    
    console.log('Claude3StreamService initialized', {
      region: this.region,
      modelId: this.modelId,
      temperature: this.temperature,
      topP: this.topP,
      maxTokens: this.maxTokens
    });
  }

  /**
   * Helper method to get a random integer between min and max (inclusive)
   * @private
   */
  _getRandomInt(min, max) {
    if (min >= max) {
      console.error('Invalid random range', { min, max });
      throw new Error('min must be less than max');
    }
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    return result;
  }

  /**
   * Implementation of the invokeModelStream method for Claude3
   * @param {Array} messages - The conversation messages to send to the model
   * @param {string} systemPrompt - The system prompt to guide the model's behavior
   * @param {Function} callback - Callback function to handle streaming responses
   * @returns {Promise<Object>} - The complete response with content and usage statistics
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    console.log('Invoking Claude3 Stream', {
      messagesCount: messages.length,
      systemPromptLength: systemPrompt.length
    });

    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      system: systemPrompt,
      messages: messages,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
    };

    console.log('Claude3 Stream payload prepared', {
      anthropic_version: payload.anthropic_version,
      temperature: payload.temperature,
      top_p: payload.top_p,
      max_tokens: payload.max_tokens
    });

    const command = new InvokeModelWithResponseStreamCommand({
      body: JSON.stringify(payload),
      contentType: "application/json",
      accept: "application/json",
      modelId: this.modelId,
    });

    try {
      console.log('Sending stream request to Bedrock', { modelId: this.modelId });
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
          console.log(`Message start received with role: ${chunk.message.role}`);
        } else if (chunk_type === "content_block_delta") {
          // The "content_block_delta" chunks contain the actual response text

          // Print each individual chunk in real-time
          process.stdout.write(chunk.delta.text);

          // ... and add it to the complete message
          completeMessage = completeMessage + chunk.delta.text;

          if (idx % this._getRandomInt(10, 20) == 0) {
            console.log('Sending partial response to callback', {
              messageLength: completeMessage.length,
              chunkIndex: idx
            });
            await callback(completeMessage, "", false)
          }
          idx++;
        } else if (chunk_type === "message_stop") {
          // The "message_stop" chunk contains some metrics
          const metrics = chunk["amazon-bedrock-invocationMetrics"];
          inputTokenCount = metrics.inputTokenCount;
          outputTokenCount = metrics.outputTokenCount;

          console.log('Stream completed', {
            inputTokenCount: metrics.inputTokenCount,
            outputTokenCount: metrics.outputTokenCount,
            invocationLatency: metrics.invocationLatency,
            firstByteLatency: metrics.firstByteLatency
          });

          let endmsg = "input:" + inputTokenCount + " output:" + outputTokenCount + " ";
          await callback(completeMessage, endmsg, true)
        }
      }
      // Print the complete message.
      console.log('Complete response received', {
        responseLength: completeMessage.length,
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount
      });

      const response = {
        content: [{ type: 'text', text: completeMessage }],
        usage: { input_tokens: inputTokenCount, output_tokens: outputTokenCount },
      }

      return response;

    } catch (err) {
      if (err.name === 'AccessDeniedException') {
        console.error(`Access denied. Ensure you have the correct permissions to invoke ${this.modelId}.`);
        console.error(err);
      } else {
        console.error('Error invoking Claude3 Stream', err);
        throw err;
      }
    } finally {
      console.log('Claude3 Stream invocation completed');
    }
  }
}

module.exports = Claude3StreamService;
