const { AIModelStreamInterface } = require('../interfaces/AIModelStreamInterface');
const axios = require('axios');

/**
 * Implementation of the AI model streaming interface for Dify API
 */
class DifyStreamService extends AIModelStreamInterface {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'http://***/v1';
    this.userId = config.userId || 'default-user';
    
    // Input variable configuration
    this.inputVarName = config.inputVarName || 'user_input';
    this.systemPromptVarName = config.systemPromptVarName || 'system_prompt';
    this.historyVarName = config.historyVarName || 'conversation_history';
    
    if (!this.apiKey) {
      throw new Error('API key is required for DifyStreamService');
    }
    
    console.log('DifyStreamService initialized', {
      baseUrl: this.baseUrl,
      userId: this.userId,
      inputVarName: this.inputVarName,
      systemPromptVarName: this.systemPromptVarName,
      historyVarName: this.historyVarName
    });
  }

  /**
   * Helper method to convert messages array to Dify inputs format
   * @private
   */
  _formatInputs(messages, systemPrompt) {
    // Extract the last user message as the main query
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    
    // Basic inputs object
    const inputs = {};
    
    // Use the configured input variable name
    if (lastUserMessage) {
      inputs[this.inputVarName] = lastUserMessage.content;
    }
    
    // Use the configured system prompt variable name if system prompt is provided
    if (systemPrompt && this.systemPromptVarName) {
      inputs[this.systemPromptVarName] = systemPrompt;
    }
    
    // Use the configured history variable name if there's conversation history
    if (messages.length > 1 && this.historyVarName) {
      inputs[this.historyVarName] = messages.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }
    
    return inputs;
  }

  /**
   * Implementation of the invokeModelStream method for Dify API
   * @param {Array} messages - The conversation messages to send to the model
   * @param {string} systemPrompt - The system prompt to guide the model's behavior
   * @param {Function} callback - Callback function to handle streaming responses
   * @returns {Promise<Object>} - The complete response with content and usage statistics
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    console.log('Invoking Dify Stream', {
      messagesCount: messages.length,
      systemPromptLength: systemPrompt?.length || 0
    });

    try {
      const inputs = this._formatInputs(messages, systemPrompt);
      
      // Prepare the request payload
      const payload = {
        inputs: inputs,
        response_mode: 'streaming',
        user: this.userId
      };
      
      // Set up headers
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      // Make the request to Dify API
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/workflows/run`,
        headers: headers,
        data: payload,
        responseType: 'stream'
      });
      
      let completeMessage = '';
      let taskId = null;
      let workflowRunId = null;
      let totalTokens = 0;
      
      // Process the stream
      return new Promise((resolve, reject) => {
        let buffer = '';
        
        response.data.on('data', async (chunk) => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // Keep the last incomplete chunk in the buffer
          
          for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;
            
            try {
              // Extract the JSON data from the SSE message
              const jsonStr = line.substring(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonStr);
              
              // Handle different event types
              switch (data.event) {
                case 'workflow_started':
                  taskId = data.task_id;
                  workflowRunId = data.workflow_run_id;
                  break;
                  
                case 'node_finished':
                  // If this is a node that generates text output
                  if (data.data.outputs && data.data.outputs.text) {
                    completeMessage = data.data.outputs.text;
                    await callback(completeMessage, '', false);
                  }
                  
                  // Track token usage if available
                  if (data.data.execution_metadata && data.data.execution_metadata.total_tokens) {
                    totalTokens = data.data.execution_metadata.total_tokens;
                  }
                  break;
                  
                case 'workflow_finished':
                  // Final message with complete output
                  if (data.data.outputs && data.data.outputs.text) {
                    completeMessage = data.data.outputs.text;
                    await callback(completeMessage, '', true);
                  }
                  
                  // Update total tokens if available
                  if (data.data.total_tokens) {
                    totalTokens = data.data.total_tokens;
                  }
                  break;
                  
                case 'ping':
                  // Keep-alive ping, no action needed
                  break;
                  
                default:
                  // Handle any other events if needed
                  break;
              }
            } catch (err) {
              console.error('Error parsing SSE message:', err, line);
            }
          }
        });
        
        response.data.on('end', () => {
          console.log('Dify stream completed', {
            responseLength: completeMessage.length,
            totalTokens: totalTokens
          });
          
          // Return the complete response
          resolve({
            content: [{ type: 'text', text: completeMessage }],
            usage: { 
              input_tokens: Math.round(totalTokens * 0.3), // Estimate input tokens
              output_tokens: Math.round(totalTokens * 0.7)  // Estimate output tokens
            },
            metadata: {
              workflow_run_id: workflowRunId,
              task_id: taskId
            }
          });
        });
        
        response.data.on('error', (err) => {
          console.error('Error in Dify stream', err);
          reject(err);
        });
      });
    } catch (err) {
      console.error('Error initiating Dify stream', err);
      throw err;
    }
  }
  
  /**
   * Stop an ongoing streaming response
   * @param {string} taskId - The task ID to stop
   * @returns {Promise<Object>} - The response from the stop request
   */
  async stopStream(taskId) {
    if (!taskId) {
      throw new Error('Task ID is required to stop a stream');
    }
    
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/workflows/tasks/${taskId}/stop`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          user: this.userId
        }
      });
      
      return response.data;
    } catch (err) {
      console.error('Error stopping Dify stream', err);
      throw err;
    }
  }
}

module.exports = DifyStreamService;
