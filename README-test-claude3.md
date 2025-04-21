# 测试 Claude3 流式服务

这个测试脚本 `test-claude3-stream.js` 用于测试 Claude3 在 AWS Bedrock 上的流式响应功能，使用工厂模式创建服务实例。

## 前提条件

在运行测试脚本之前，您需要设置以下环境变量：

```bash
export AWS_REGION_CODE=your-region           # 例如 us-east-1
export AWS_AK=your-access-key                # AWS 访问密钥
export AWS_SK=your-secret-key                # AWS 秘密访问密钥
export AWS_BEDROCK_CLAUDE_SONNET=anthropic.claude-3-sonnet-20240229-v1:0  # Claude 模型 ID
```

## 运行测试

设置环境变量后，您可以使用以下命令运行测试：

```bash
node test-claude3-stream.js
```

## 测试内容

测试脚本会：

1. 使用 AIModelFactory 创建一个 Claude3StreamService 实例
2. 发送一个关于"依赖倒置原则"的问题，并要求提供代码示例
3. 使用流式响应接收 Claude 的回答
4. 打印完整的响应和令牌使用情况

## 注意事项

- 确保您的 AWS 账户有权限访问 Bedrock 和 Claude 模型
- 流式响应会实时显示在控制台上
- 如果遇到权限错误，请检查您的 IAM 权限设置

## 依赖倒置原则的应用

这个测试脚本本身就是依赖倒置原则的一个应用示例：

1. 高层模块（测试脚本）不直接依赖低层模块（Claude3StreamService）
2. 两者都依赖于抽象（AIModelStreamInterface）
3. 通过工厂模式（AIModelFactory）创建具体实现

这种设计使得测试脚本可以轻松切换不同的 AI 模型实现，而不需要修改测试代码本身。
