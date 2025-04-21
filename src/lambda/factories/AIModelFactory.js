import { Claude3StreamService } from '../implementations/Claude3StreamService.js';
import { MockStreamService } from '../implementations/MockStreamService.js';
import { debugLog } from '../utils.js';

/**
 * Factory for creating AI model service instances
 */
export class AIModelFactory {
  /**
   * Create an instance of an AI model service
   * @param {string} modelType - The type of model service to create ('claude3', 'mock', etc.)
   * @param {Object} config - Configuration options for the model service
   * @returns {AIModelStreamInterface} - An instance of the requested model service
   */
  static createModelService(modelType, config = {}) {
    debugLog('Creating model service', { modelType, config }, 'INFO');
    
    switch (modelType.toLowerCase()) {
      case 'claude3':
        return new Claude3StreamService(config);
      case 'mock':
        return new MockStreamService(config);
      default:
        debugLog(`Unknown model type: ${modelType}`, null, 'ERROR');
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }
}
