const { BedrockAgentRuntimeClient, RetrieveAndGenerateStreamCommand } = require("@aws-sdk/client-bedrock-agent-runtime");
const { AIModelStreamInterface } = require("../interfaces/AIModelStreamInterface");

/**
 * Implementation of the AIModelStreamInterface for Amazon Bedrock Knowledge Base streaming
 */
class BedrockRAGStreamService extends AIModelStreamInterface {
  /**
   * Creates a new BedrockRAGStreamService instance
   * 
   * @param {Object} config Configuration object
   * @param {string} config.region AWS region
   * @param {string} config.accessKeyId AWS access key ID
   * @param {string} config.secretAccessKey AWS secret access key
   * @param {string} config.knowledgeBaseId ID of the knowledge base to query
   * @param {string} config.modelArn ARN of the model to use for RAG
   */
  constructor(config) {
    super();
    
    if (!config.region) throw new Error("Region is required");
    if (!config.accessKeyId) throw new Error("Access key ID is required");
    if (!config.secretAccessKey) throw new Error("Secret access key is required");
    if (!config.knowledgeBaseId) throw new Error("Knowledge base ID is required");
    if (!config.modelArn) throw new Error("Model ARN is required");
    
    this.config = config;
    
    this.bedrockAgentRuntime = new BedrockAgentRuntimeClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  /**
   * Invokes the Bedrock Knowledge Base with streaming response
   * 
   * @param {Array} messages The messages to send (for RAG, we use only the last message as the question)
   * @param {string} systemPrompt The system prompt (not used for RAG but required by interface)
   * @param {Function} callback Callback function to handle streaming responses
   * @returns {Promise<Object>} The complete response including text, citations, and session ID
   */
  async invokeModelStream(messages, systemPrompt, callback) {
    // For RAG, we extract the question from the last message
    const question = messages[messages.length - 1].content;
    
    const input = {
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: this.config.knowledgeBaseId,
          modelArn: this.config.modelArn,
          orchestrationConfiguration: {
              inferenceConfig: {
                  textInferenceConfig: {
                      maxTokens: 4096,
                      stopSequences: [
                          "\nObservation"
                      ],
                      temperature: 0,
                      topP: 1
                  }
              }
          },
          retrievalConfiguration: {
              vectorSearchConfiguration: {
                  numberOfResults: 10,
                  overrideSearchType: "HYBRID"
              }
          },
          generationConfiguration: {
              inferenceConfig: {
                  textInferenceConfig: {
                      maxTokens: 4096,
                      stopSequences: [
                          "\nObservation"
                      ],
                      temperature: 0,
                      topP: 1
                  }
              }
          }
        }
      }
    };

    console.log("Stream RAG input:", JSON.stringify(input, null, 2));

    try {
      const command = new RetrieveAndGenerateStreamCommand(input);
      const response = await this.bedrockAgentRuntime.send(command);

      let fullText = '';
      let citations = [];
      let responseSessionId = null;
      let hasChunks = false;
      let inputTokenCount = 0;
      let outputTokenCount = 0;

      for await (const event of response.stream) {
        // Handle text chunks
        if (event?.output) {
          hasChunks = true;
          const textChunk = event.output?.text;
          
          // Append to full text
          fullText += textChunk;
          
          // Call the callback with the chunk
          if (callback) {
            await callback(fullText, "", false);
          }
        } 
        // Handle citation information
        else if (event?.citation) {
          // Get all references
          const references = event.citation?.retrievedReferences;
          let s3Uri = "";

          // Process references
          if (references && references.length > 0) {
            references.forEach(reference => {
              // Get s3Location.uri (if exists)
              if (reference.location && reference.location.s3Location) {
                s3Uri = reference.location.s3Location.uri;
              }
            });
            
            citations.push(s3Uri);
          }
        }
        // Handle metadata (session ID)
        else if (event.metadata) {
          console.log("Received metadata:", JSON.stringify(event.metadata, null, 2));
          
          try {
            if (event.metadata.sessionId) {
              responseSessionId = event.metadata.sessionId;
            }
          } catch (error) {
            console.error("Error processing metadata:", error);
          }
        }
        // Log any unexpected event types
        else {
          console.log("Unhandled event type:", Object.keys(event));
        }
      }

      // If no chunks were received, send an error
      if (!hasChunks) {
        console.warn("No text chunks received from the stream");
        return {
          content: [{ type: 'text', text: 'No response generated. Please try again.' }],
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }
      
      // Estimate token counts (rough estimate)
      inputTokenCount = Math.ceil(question.length / 4);
      outputTokenCount = Math.ceil(fullText.length / 4);
      
      // Send final callback with complete message
      if (callback) {
        let endmsg = `input:${inputTokenCount} output:${outputTokenCount} `;
        await callback(fullText, endmsg, true);
      }
      
      // Format response to match the interface contract
      return { 
        content: [{ type: 'text', text: fullText }],
        usage: { 
          input_tokens: inputTokenCount, 
          output_tokens: outputTokenCount 
        },
        // Additional RAG-specific data
        rag_data: {
          citations: citations,
          sessionId: responseSessionId
        }
      };
    } catch (error) {
      console.error('Error in streaming RAG:', error);
      throw error;
    }
  }
}

module.exports = BedrockRAGStreamService;
