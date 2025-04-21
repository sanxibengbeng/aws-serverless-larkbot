import { AIModelFactory } from '../factories/AIModelFactory.js';
import { debugLog } from '../utils.js';

/**
 * Example usage of the AI model streaming interface
 */
async function main() {
  // Enable debug logging
  process.env.DEBUG_MODE = '1';
  
  // Example messages for the AI model
  const messages = [
    {
      role: 'user',
      content: 'Hello, can you tell me about dependency inversion principle?'
    }
  ];
  
  // System prompt to guide the model's behavior
  const systemPrompt = 'You are a helpful assistant that provides clear and concise explanations about software engineering principles.';
  
  // Callback function to handle streaming responses
  const handleStreamingResponse = async (content, endMsg, isComplete) => {
    console.log('\n--- Streaming Update ---');
    console.log(`Content length: ${content.length} characters`);
    console.log(`Is complete: ${isComplete}`);
    if (endMsg) {
      console.log(`End message: ${endMsg}`);
    }
    // In a real application, you might update a UI or send updates to a client
  };
  
  try {
    // Create a model service using the factory
    // For production, use 'claude3' with appropriate config
    // const modelService = AIModelFactory.createModelService('claude3', {
    //   region: process.env.AWS_REGION_CODE,
    //   accessKeyId: process.env.AWS_AK,
    //   secretAccessKey: process.env.AWS_SK,
    //   modelId: process.env.AWS_BEDROCK_CLAUDE_SONNET
    // });
    
    // For testing, use the mock service
    const modelService = AIModelFactory.createModelService('mock', {
      delay: 200,
      responseText: 'The Dependency Inversion Principle (DIP) is one of the SOLID principles of object-oriented design. It states that high-level modules should not depend on low-level modules. Both should depend on abstractions. Additionally, abstractions should not depend on details; details should depend on abstractions. This principle helps create more flexible, maintainable, and testable code by reducing coupling between components.'
    });
    
    // Invoke the model with streaming
    debugLog('Starting model invocation', null, 'INFO');
    const response = await modelService.invokeModelStream(
      messages,
      systemPrompt,
      handleStreamingResponse
    );
    
    // Log the complete response
    debugLog('Complete response', {
      content: response.content[0].text.substring(0, 100) + '...',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    }, 'INFO');
    
  } catch (error) {
    debugLog('Error in example', error, 'ERROR');
    console.error('Error:', error.message);
  }
}

// Run the example
main().catch(console.error);
