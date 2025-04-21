import { AIModelStreamInterface } from '../interfaces/AIModelStreamInterface.js';
import { debugLog } from '../utils.js';

/**
 * Mock implementation of the AI model streaming interface for testing
 */
export class MockStreamService extends AIModelStreamInterface {
  constructor(config = {}) {
    super();
    this.delay = config.delay || 100; // Milliseconds between chunks
    this.responseText = config.responseText || "This is a mock response from the AI model. It will be streamed in chunks to simulate a real streaming response.";
    
    debugLog('MockStreamService initialized', {
      delay: this.delay,
      responseLength: this.responseText.length
    }, 'CONFIG');
  }

  /**
   * Helper method to simulate delay
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Implementation of the invokeModelStream method for testing
   * @param {Array} messages - The conversation messages to send to the model
   * @param {string} systemPrompt - The system prompt to guide the model's behavior
   * @param {Function} callback - Callback function to handle streaming responses
   * @returns {Promise<Object>} - The complete response with content and usage statistics
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    debugLog('Invoking Mock Stream', {
      messagesCount: messages.length,
      systemPromptLength: systemPrompt.length
    }, 'INFO');

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
      
      debugLog('Mock stream completed', {
        responseLength: completeMessage.length,
        inputTokens: Math.round(inputTokenCount),
        outputTokens: Math.round(outputTokenCount)
      }, 'INFO');
      
      // Return the complete response
      return {
        content: [{ type: 'text', text: completeMessage }],
        usage: { 
          input_tokens: Math.round(inputTokenCount), 
          output_tokens: Math.round(outputTokenCount) 
        },
      };
    } catch (err) {
      debugLog('Error in mock stream', err, 'ERROR');
      throw err;
    }
  }
}
