const { AIModelStreamInterface } = require('../interfaces/AIModelStreamInterface');

/**
 * Mock implementation of the AI model streaming interface for testing
 */
class MockStreamService extends AIModelStreamInterface {
  constructor(config = {}) {
    super();
    this.delay = config.delay || 100; // Milliseconds between chunks
    this.responseText = config.responseText || "收到，这是一个模拟响应，用于测试流式传输功能。";
    
    console.log('MockStreamService initialized', {
      delay: this.delay,
      responseLength: this.responseText.length
    });
  }

  /**
   * Helper method to simulate delay
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper method to get a random integer between min and max (inclusive)
   * @private
   */
  _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Implementation of the invokeModelStream method for testing
   * @param {Array} messages - The conversation messages to send to the model
   * @param {string} systemPrompt - The system prompt to guide the model's behavior
   * @param {Function} callback - Callback function to handle streaming responses
   * @returns {Promise<Object>} - The complete response with content and usage statistics
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    console.log('Invoking Mock Stream', {
      messagesCount: messages.length,
      systemPromptLength: systemPrompt.length
    });

    try {
      // Simulate streaming by breaking the response into chunks
      const chunks = this.responseText.split(' ');
      let completeMessage = "";
      
      // Stream each chunk with a delay
      for (let i = 0; i < chunks.length; i++) {
        await this._sleep(this.delay);
        
        completeMessage += (i > 0 ? ' ' : '') + chunks[i];
        
        // Call the callback every few chunks
        if (i % 3 === 0 || i === chunks.length - 1) {
          await callback(completeMessage, "", i === chunks.length - 1);
        }
      }
      
      // Final callback with token counts
      const inputTokenCount = messages.reduce((acc, msg) => acc + msg.content.length / 4, 0);
      const outputTokenCount = completeMessage.length / 4;
      
      console.log('Mock stream completed', {
        responseLength: completeMessage.length,
        inputTokens: Math.round(inputTokenCount),
        outputTokens: Math.round(outputTokenCount)
      });
      
      // Return the complete response
      return {
        content: [{ type: 'text', text: completeMessage }],
        usage: { 
          input_tokens: Math.round(inputTokenCount), 
          output_tokens: Math.round(outputTokenCount) 
        },
      };
    } catch (err) {
      console.error('Error in mock stream', err);
      throw err;
    }
  }
}

module.exports = MockStreamService;
