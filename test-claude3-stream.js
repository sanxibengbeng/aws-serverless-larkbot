/**
 * Test script for the Claude3StreamService implementation using factory pattern
 */

// 导入工厂和调试日志功能
const { AIModelFactory } = require('./src/lambda/factories/AIModelFactory.js');
const { debugLog } = require('./src/lambda/utils.js');

/**
 * Test script for the Claude3StreamService implementation
 */
async function testClaude3Stream() {
  // 启用调试日志
  process.env.DEBUG_MODE = 1;
  
  // 示例消息
  const messages = [
    {
      role: 'user',
      content: '请给我介绍一下依赖倒置原则，并举一个简单的例子'
    }
  ];
  
  // 系统提示
  const systemPrompt = '你是一个有用的助手，能够清晰简洁地解释软件工程原则。请提供具体的代码示例来说明概念。';
  
  // 处理流式响应的回调函数
  const handleStreamingResponse = async (content, endMsg, isComplete) => {
    console.log('\n--- 流式响应更新 ---');
    console.log(`是否完成: ${isComplete}`);
    if (endMsg) {
      console.log(`结束消息: ${endMsg}`);
    }
  };
  
  try {
    // 检查环境变量
    if (!process.env.AWS_REGION_CODE || !process.env.AWS_AK || !process.env.AWS_SK || !process.env.AWS_BEDROCK_CLAUDE_SONNET) {
      console.log('请设置必要的环境变量:');
      console.log('- AWS_REGION_CODE: AWS 区域代码');
      console.log('- AWS_AK: AWS 访问密钥');
      console.log('- AWS_SK: AWS 秘密访问密钥');
      console.log('- AWS_BEDROCK_CLAUDE_SONNET: Claude 模型 ID');
      
      console.log('\n示例:');
      console.log('export AWS_REGION_CODE=your-region');
      console.log('export AWS_AK=your-access-key');
      console.log('export AWS_SK=your-secret-key');
      console.log('export AWS_BEDROCK_CLAUDE_SONNET=anthropic.claude-3-sonnet-20240229-v1:0');
      
      return;
    }
    
    console.log('创建 Claude3 服务...');
    // 使用工厂方法创建 Claude3 服务实例
    const modelService = AIModelFactory.createModelService('claude3', {
      region: process.env.AWS_REGION_CODE,
      accessKeyId: process.env.AWS_AK,
      secretAccessKey: process.env.AWS_SK,
      modelId: process.env.AWS_BEDROCK_CLAUDE_SONNET,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048
    });
    
    console.log('开始调用 Claude3 流式服务...');
    // 调用模型进行流式传输
    const response = await modelService.invokeModelStream(
      messages,
      systemPrompt,
      handleStreamingResponse
    );
    
    // 记录完整响应
    console.log('\n--- 完整响应 ---');
    console.log(`内容: ${response.content[0].text.substring(0, 100)}...`);
    console.log(`输入令牌: ${response.usage.input_tokens}`);
    console.log(`输出令牌: ${response.usage.output_tokens}`);
    
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testClaude3Stream().catch(console.error);
