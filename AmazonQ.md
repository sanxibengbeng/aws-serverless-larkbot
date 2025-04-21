# Dependency Inversion for Claude3 Streaming Implementation

## Overview

This implementation applies the Dependency Inversion Principle (DIP) to the `invokeClaude3stream` method from the original codebase. The DIP states that:

1. High-level modules should not depend on low-level modules. Both should depend on abstractions.
2. Abstractions should not depend on details. Details should depend on abstractions.

## Implementation Structure

The implementation consists of:

1. **Interface**: `AIModelStreamInterface` - Defines the contract for AI model streaming services
2. **Concrete Implementations**:
   - `Claude3StreamService` - Implements the interface for Claude3 on AWS Bedrock
   - `MockStreamService` - Provides a mock implementation for testing
3. **Factory**: `AIModelFactory` - Creates instances of the appropriate implementation
4. **Example**: `streamExample.js` - Demonstrates usage of the interface and implementations

## Benefits of This Approach

- **Decoupling**: Business logic is decoupled from specific AI model implementations
- **Testability**: Easy to create mock implementations for testing
- **Flexibility**: New AI model implementations can be added without changing client code
- **Maintainability**: Clear separation of concerns makes the code easier to maintain

## Usage Example

```javascript
// Create a model service using the factory
const modelService = AIModelFactory.createModelService('claude3', {
  region: process.env.AWS_REGION_CODE,
  accessKeyId: process.env.AWS_AK,
  secretAccessKey: process.env.AWS_SK,
  modelId: process.env.AWS_BEDROCK_CLAUDE_SONNET
});

// Define a callback to handle streaming responses
const handleStreamingResponse = async (content, endMsg, isComplete) => {
  // Update UI or process partial responses
};

// Invoke the model with streaming
const response = await modelService.invokeModelStream(
  messages,
  systemPrompt,
  handleStreamingResponse
);
```

## Files Created

1. `/src/lambda/interfaces/AIModelStreamInterface.js` - The interface definition
2. `/src/lambda/implementations/Claude3StreamService.js` - Claude3 implementation
3. `/src/lambda/implementations/MockStreamService.js` - Mock implementation for testing
4. `/src/lambda/factories/AIModelFactory.js` - Factory for creating service instances
5. `/src/lambda/examples/streamExample.js` - Example usage
