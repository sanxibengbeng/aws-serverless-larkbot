/**
 * Example usage of DifyStreamService
 */
const DifyStreamService = require('../implementations/DifyStreamService');

// Create a Dify service instance with custom variable names
const difyService = new DifyStreamService({
  apiKey: process.env.DIFY_API_KEY || '',
  baseUrl: process.env.DIFY_BASE_URL || '',
  userId: 'example-user-123',
  inputVarName: 'user_question',               // Custom input variable name
});

// Example messages array (similar to OpenAI format)
const messages = [
  { role: 'user', content: '你好，请介绍一下自己' }
];

// Optional system prompt
const systemPrompt = '你是一个有用的AI助手，请用中文回答问题。';

// Define a callback to handle streaming responses
const handleStreamingResponse = async (content, endMsg, isComplete) => {
  console.log(`Received content (${isComplete ? 'complete' : 'partial'}):`);
  console.log(content);
  
  if (isComplete) {
    console.log('Stream completed');
  }
};

// Main function to demonstrate usage
async function runExample() {
  console.log('Starting Dify stream example...');
  
  try {
    // Invoke the model with streaming
    const response = await difyService.invokeModelStream(
      messages,
      systemPrompt,
      handleStreamingResponse
    );
    
    console.log('Final response:', response);
    
    // Example of stopping a stream (would need a valid task ID)
    // if (response.metadata && response.metadata.task_id) {
    //   const stopResult = await difyService.stopStream(response.metadata.task_id);
    //   console.log('Stream stopped:', stopResult);
    // }
  } catch (error) {
    console.error('Error in Dify stream example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

module.exports = { runExample };
