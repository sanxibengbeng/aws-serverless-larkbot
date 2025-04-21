// 导入模块
const { AIModelFactory } = require('./src/lambda/factories/AIModelFactory.js');
const { debugLog } = require('./src/lambda/utils.js');

/**
 * Test script for the MockStreamService implementation
 */
async function testMockStream() {
  // Enable debug logging
  process.env.DEBUG_MODE = 1;
  
  // Example messages for the AI model
  const messages = [
    {
      role: 'user',
      content: '请给我介绍一下依赖倒置原则'
    }
  ];
  
  // System prompt to guide the model's behavior
  const systemPrompt = '你是一个有用的助手，能够清晰简洁地解释软件工程原则。';
  
  // Callback function to handle streaming responses
  const handleStreamingResponse = async (content, endMsg, isComplete) => {
    console.log('\n--- 流式响应更新 ---');
    console.log(`内容: ${content}`);
    console.log(`是否完成: ${isComplete}`);
    if (endMsg) {
      console.log(`结束消息: ${endMsg}`);
    }
  };
  
  try {
    console.log('创建 Mock 服务...');
    // Create a mock model service using the factory
    const modelService = AIModelFactory.createModelService('mock', {
      delay: 300,
      responseText: '依赖倒置原则（Dependency Inversion Principle，DIP）是面向对象设计的SOLID原则之一。它指出高层模块不应该依赖于低层模块，两者都应该依赖于抽象。此外，抽象不应该依赖于细节，细节应该依赖于抽象。这个原则通过减少组件之间的耦合，帮助创建更灵活、可维护和可测试的代码。在实践中，这通常意味着使用接口或抽象类来定义高层模块和低层模块之间的契约，而不是直接依赖具体实现。'
    });
    
    console.log('开始调用 Mock 流式服务...');
    // Invoke the model with streaming
    const response = await modelService.invokeModelStream(
      messages,
      systemPrompt,
      handleStreamingResponse
    );
    
    // Log the complete response
    console.log('\n--- 完整响应 ---');
    console.log(`内容: ${response.content[0].text}`);
    console.log(`输入令牌: ${response.usage.input_tokens}`);
    console.log(`输出令牌: ${response.usage.output_tokens}`);
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// Run the test
testMockStream().catch(console.error);
