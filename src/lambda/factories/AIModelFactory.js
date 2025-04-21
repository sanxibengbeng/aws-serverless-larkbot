/**
 * Factory for creating AI model service instances
 * Handles configuration validation and creation of appropriate model services
 */
class AIModelFactory {
  /**
   * Get configuration for the specified model type
   * @param {string} modelType - The type of model service ('claude3', 'mock', 'rag', etc.)
   * @returns {Object} - Configuration object for the specified model type
   */
  static getModelConfig(modelType) {
    console.log(`Getting configuration for model type: ${modelType}`);
    
    // Common configuration parameters from environment variables
    const commonConfig = {
      temperature: parseFloat(process.env.AI_MODEL_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.AI_MODEL_TOP_P || '0.9'),
      maxTokens: parseInt(process.env.AI_MODEL_MAX_TOKENS || '2048'),
    };
    
    // Model-specific configuration
    switch (modelType.toLowerCase()) {
      case 'claude3':
        // Validate required environment variables for Claude3
        const requiredEnvVars = ['AWS_REGION_CODE', 'AWS_AK', 'AWS_SK', 'AWS_BEDROCK_CLAUDE_SONNET'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
          throw new Error(`Missing required environment variables for Claude3: ${missingVars.join(', ')}`);
        }
        
        return {
          ...commonConfig,
          region: process.env.AWS_REGION_CODE,
          accessKeyId: process.env.AWS_AK,
          secretAccessKey: process.env.AWS_SK,
          modelId: process.env.AWS_BEDROCK_CLAUDE_SONNET,
        };
        
      case 'rag':
        // Validate required environment variables for RAG
        const requiredRagVars = ['AWS_REGION_CODE', 'AWS_AK', 'AWS_SK', 'KNOWLEDGE_BASE_ID', 'RAG_MODEL_ARN'];
        const missingRagVars = requiredRagVars.filter(varName => !process.env[varName]);
        
        if (missingRagVars.length > 0) {
          throw new Error(`Missing required environment variables for RAG: ${missingRagVars.join(', ')}`);
        }
        
        return {
          region: process.env.AWS_REGION_CODE,
          accessKeyId: process.env.AWS_AK,
          secretAccessKey: process.env.AWS_SK,
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
          modelArn: process.env.RAG_MODEL_ARN,
        };
        
      case 'mock':
        return {
          ...commonConfig,
          delay: parseInt(process.env.MOCK_MODEL_DELAY || '300'),
          responseText: process.env.MOCK_MODEL_DEFAULT_RESPONSE || 
            '收到，这是一个模拟响应。依赖倒置原则是面向对象设计的SOLID原则之一，它指出高层模块不应该依赖于低层模块，两者都应该依赖于抽象。',
        };
        
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }

  /**
   * Create an instance of an AI model service
   * @param {string} modelType - The type of model service to create ('claude3', 'mock', 'rag', etc.)
   * @param {Object} overrideConfig - Optional configuration to override default settings
   * @returns {Object} - An instance of the requested model service
   */
  static createModelService(modelType, overrideConfig = {}) {
    try {
      // Get default configuration for the specified model type
      const defaultConfig = this.getModelConfig(modelType);
      
      // Merge default config with any overrides
      const config = { ...defaultConfig, ...overrideConfig };
      
      console.log(`Creating ${modelType} model service with config:`, 
        JSON.stringify({
          ...config,
          // Mask sensitive information
          accessKeyId: config.accessKeyId ? '***' : undefined,
          secretAccessKey: config.secretAccessKey ? '***' : undefined
        }, null, 2)
      );
      
      // Create and return the appropriate service instance
      switch (modelType.toLowerCase()) {
        case 'claude3':
          const Claude3StreamService = require('../implementations/Claude3StreamService');
          return new Claude3StreamService(config);
          
        case 'rag':
          const BedrockRAGStreamService = require('../implementations/BedrockRAGStreamService');
          return new BedrockRAGStreamService(config);
          
        case 'mock':
          const MockStreamService = require('../implementations/MockStreamService');
          return new MockStreamService(config);
          
        default:
          throw new Error(`Unknown model type: ${modelType}`);
      }
    } catch (error) {
      console.error(`Error creating model service for type ${modelType}:`, error);
      throw error;
    }
  }
}

module.exports = { AIModelFactory };
