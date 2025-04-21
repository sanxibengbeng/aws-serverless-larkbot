/**
 * Test script for the MockStreamService implementation using CommonJS
 * This script demonstrates how to use the mock implementation for testing
 */

// 模拟消息和系统提示
const messages = [
  {
    role: 'user',
    content: '请给我介绍一下依赖倒置原则'
  }
];

const systemPrompt = '你是一个有用的助手，能够清晰简洁地解释软件工程原则。';

// 创建一个简单的 MockStreamService 实现
class MockStreamService {
  constructor(config = {}) {
    this.delay = config.delay || 100;
    this.responseText = config.responseText || "这是一个模拟响应";
    console.log('MockStreamService 已初始化');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async invokeModelStream(messages, systemPrompt, callback) {
    console.log('调用 MockStreamService.invokeModelStream');
    console.log(`收到 ${messages.length} 条消息`);
    console.log(`系统提示长度: ${systemPrompt.length} 字符`);

    try {
      // 将响应分成多个块来模拟流式传输
      const chunks = this.responseText.split(' ');
      let completeMessage = "";
      
      // 每个块之间添加延迟
      for (let i = 0; i < chunks.length; i++) {
        await this._sleep(this.delay);
        
        completeMessage += (i > 0 ? ' ' : '') + chunks[i];
        
        // 每隔几个块调用一次回调
        if (i % 3 === 0 || i === chunks.length - 1) {
          await callback(completeMessage, "", i === chunks.length - 1);
        }
      }
      
      // 计算令牌数量（简单估算）
      const inputTokenCount = messages.reduce((acc, msg) => acc + msg.content.length / 4, 0);
      const outputTokenCount = completeMessage.length / 4;
      
      console.log('模拟流式传输完成');
      
      // 返回完整响应
      return {
        content: [{ type: 'text', text: completeMessage }],
        usage: { 
          input_tokens: Math.round(inputTokenCount), 
          output_tokens: Math.round(outputTokenCount) 
        },
      };
    } catch (err) {
      console.error('模拟流式传输出错:', err);
      throw err;
    }
  }
}

// 回调函数处理流式响应
const handleStreamingResponse = async (content, endMsg, isComplete) => {
  console.log('\n--- 流式响应更新 ---');
  console.log(`内容: ${content}`);
  console.log(`是否完成: ${isComplete}`);
  if (endMsg) {
    console.log(`结束消息: ${endMsg}`);
  }
};

// 主测试函数
async function testMockStream() {
  try {
    console.log('创建 Mock 服务...');
    // 创建 mock 服务实例
    const modelService = new MockStreamService({
      delay: 300,
      responseText: '依赖倒置原则（Dependency Inversion Principle，DIP）是面向对象设计的SOLID原则之一。它指出高层模块不应该依赖于低层模块，两者都应该依赖于抽象。此外，抽象不应该依赖于细节，细节应该依赖于抽象。这个原则通过减少组件之间的耦合，帮助创建更灵活、可维护和可测试的代码。在实践中，这通常意味着使用接口或抽象类来定义高层模块和低层模块之间的契约，而不是直接依赖具体实现。'
    });
    
    console.log('开始调用 Mock 流式服务...');
    // 调用模型进行流式传输
    const response = await modelService.invokeModelStream(
      messages,
      systemPrompt,
      handleStreamingResponse
    );
    
    // 记录完整响应
    console.log('\n--- 完整响应 ---');
    console.log(`内容: ${response.content[0].text}`);
    console.log(`输入令牌: ${response.usage.input_tokens}`);
    console.log(`输出令牌: ${response.usage.output_tokens}`);
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// 运行测试
testMockStream().catch(console.error);
