# AI 模型配置指南

本项目支持通过配置选择不同的 AI 模型实现，并可以自定义模型参数。所有配置都通过环境变量进行管理。

## 基本配置

在 `.env` 文件中，设置以下环境变量：

```
# AI model implementation to use (mock or claude3)
AI_MODEL_TYPE=mock

# AI model parameters
AI_MODEL_TEMPERATURE=0.7
AI_MODEL_TOP_P=0.9
AI_MODEL_MAX_TOKENS=2048
```

### 模型类型选项

- `claude3` - 使用真实的 Claude3 模型（需要 AWS 凭证和权限）
- `mock` - 使用模拟实现（适用于开发和测试）

### 通用模型参数

- `AI_MODEL_TEMPERATURE` - 控制响应的创造性和随机性（0.0-1.0）
- `AI_MODEL_TOP_P` - 控制词汇选择的多样性（0.0-1.0）
- `AI_MODEL_MAX_TOKENS` - 控制响应的最大长度

## 模型特定配置

### Claude3 配置

使用 Claude3 模型需要以下环境变量：

```
AWS_REGION_CODE=us-east-1
AWS_AK=your-access-key
AWS_SK=your-secret-key
AWS_BEDROCK_CLAUDE_SONNET=anthropic.claude-3-sonnet-20240229-v1:0
```

### Mock 模型配置

Mock 模型可以通过以下环境变量进行自定义：

```
MOCK_MODEL_DELAY=300
MOCK_MODEL_DEFAULT_RESPONSE=收到，这是一个模拟响应。
```

- `MOCK_MODEL_DELAY` - 模拟流式响应的延迟（毫秒）
- `MOCK_MODEL_DEFAULT_RESPONSE` - 模拟响应的默认文本

## 配置验证

`AIModelFactory` 类会在创建模型服务实例时验证配置：

1. 检查所需的环境变量是否存在
2. 验证参数值的有效性
3. 应用默认值（如果未指定）

如果缺少必要的配置，系统会抛出明确的错误消息。

## 本地测试

可以使用以下命令测试不同的配置：

```bash
# 测试 Mock 实现
AI_MODEL_TYPE=mock node test-mock-stream-cjs.js

# 测试 Claude3 实现（需要设置 AWS 环境变量）
AI_MODEL_TYPE=claude3 node test-claude3-stream.js

# 自定义参数
AI_MODEL_TEMPERATURE=0.5 AI_MODEL_MAX_TOKENS=1024 node test-mock-stream-cjs.js
```

## 依赖倒置原则的应用

本项目应用了依赖倒置原则 (DIP)，通过以下组件实现：

1. **接口**: `AIModelStreamInterface` - 定义了 AI 模型流式服务的契约
2. **具体实现**:
   - `Claude3StreamService` - 实现了 Claude3 在 AWS Bedrock 上的流式服务
   - `MockStreamService` - 提供了用于测试的模拟实现
3. **工厂**: `AIModelFactory` - 创建适当的实现实例并处理配置验证

这种设计使得应用程序可以轻松切换不同的 AI 模型实现，而不需要修改核心业务逻辑。
