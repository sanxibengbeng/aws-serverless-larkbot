/**
 * Interface for AI model streaming capabilities
 * This interface defines the contract for streaming AI model responses
 */
class AIModelStreamInterface {
  /**
   * Invoke the AI model with streaming response
   * @param {Array} messages - The conversation messages to send to the model
   * @param {string} systemPrompt - The system prompt to guide the model's behavior
   * @param {Function} callback - Callback function to handle streaming responses
   * @returns {Promise<Object>} - The complete response with content and usage statistics
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    throw new Error('Method not implemented: invokeModelStream must be implemented by concrete classes');
  }
}

module.exports = { AIModelStreamInterface };
