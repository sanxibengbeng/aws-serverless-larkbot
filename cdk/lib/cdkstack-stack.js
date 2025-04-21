// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Topic } from 'aws-cdk-lib/aws-sns';
import subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv' 
dotenv.config()

// const sqs = require('aws-cdk-lib/aws-sqs');
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class CdkstackStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Get deployment name from props
    const deploymentName = props.deploymentName || 'default';
    
    // Create unique resource names using the deployment name
    const tableNamePrefix = `${deploymentName}-`;

    // Create DynamoDB tables with unique names
    const messagesTableName = `${tableNamePrefix}lark_messages`;
    const statsTableName = `${tableNamePrefix}lark_stats`;
    const eventsTableName = `${tableNamePrefix}lark_events`;
    
    const dynamoTable = new Table(this, 'items', {
      partitionKey: {
        name: 'chat_id',
        type: AttributeType.STRING
      },
      tableName: messagesTableName,
      timeToLiveAttribute: 'expire_at',
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const dynamoStatsable = new Table(this, 'stats', {
      partitionKey: {
        name: 'app_id',
        type: AttributeType.STRING
      },
      tableName: statsTableName,
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const dynamoEventable = new Table(this, 'events', {
      partitionKey: {
        name: 'event_id',
        type: AttributeType.STRING
      },
      tableName: eventsTableName,
      timeToLiveAttribute: 'expire_at',
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // Create sns Topic with unique name
    const snsTopic = new Topic(this, 'Topic', {
      displayName: `${deploymentName}-chat-messages-topic`,
      topicName: `${deploymentName}-lark-chat-topic`
    });

    const NodejsFunctionProps = {
      bundling: {
        externalModules: [
          '@aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
        ],
      },
      environment: {
        DB_TABLE: messagesTableName,
        DB_STATS_TABLE: statsTableName,
        DB_EVENTS_TABLE: eventsTableName,
        LARK_APPID: process.env.LARK_APPID,
        LARK_APP_SECRET: process.env.LARK_APP_SECRET,
        LARK_TOKEN: process.env.LARK_TOKEN,
        LARK_ENCRYPT_KEY: process.env.LARK_ENCRYPT_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        AWS_AK: process.env.AWS_AK,
        AWS_SK: process.env.AWS_SK,
        AWS_REGION_CODE: process.env.AWS_REGION_CODE,
        AWS_BEDROCK_CLAUDE_SONNET: process.env.AWS_BEDROCK_CLAUDE_SONNET,
        AWS_CLAUDE_MAX_SEQ: process.env.AWS_CLAUDE_MAX_SEQ,
        AWS_CLAUDE_IMG_DESC_PROMPT: process.env.AWS_CLAUDE_IMG_DESC_PROMPT,
        AWS_CLAUDE_SYSTEM_PROMPT: process.env.AWS_CLAUDE_SYSTEM_PROMPT,
        AWS_CLAUDE_MAX_CHAT_QUOTA_PER_USER: process.env.AWS_CLAUDE_MAX_CHAT_QUOTA_PER_USER,
        START_CMD: process.env.START_CMD,
        SNS_TOPIC_ARN: snsTopic.topicArn,
        DEBUG_MODE: process.env.DEBUG_MODE || '0',
        AI_MODEL_TYPE: process.env.AI_MODEL_TYPE || 'claude3',
        AI_MODEL_TEMPERATURE: process.env.AI_MODEL_TEMPERATURE || '0.7',
        AI_MODEL_TOP_P: process.env.AI_MODEL_TOP_P || '0.9',
        AI_MODEL_MAX_TOKENS: process.env.AI_MODEL_MAX_TOKENS || '2048',
        MOCK_MODEL_DELAY: process.env.MOCK_MODEL_DELAY || '300',
        MOCK_MODEL_DEFAULT_RESPONSE: process.env.MOCK_MODEL_DEFAULT_RESPONSE || '',
      },
      runtime: Runtime.NODEJS_18_X,
    }
    
    // Create Lambda functions with unique names
    const lambda_larkcallback = new NodejsFunction(this, 'larkcallback', {
      entry: join(__dirname, '../../src/lambda/handler_larkcallback', 'index.js'),
      depsLockFilePath: join(__dirname, '../../src/lambda/handler_larkcallback', 'package-lock.json'),
      bundling: {
        nodeModules: ['openai', '@larksuiteoapi/node-sdk'],
        externalModules: ['@aws-sdk'],
        forceDockerBundling: false,
        esbuildArgs: {
          '--packages': 'bundle'  // Fix for esbuild 0.22.0+ compatibility
        }
      },
      functionName: `${deploymentName}-lark-callback`,
      timeout: Duration.minutes(1),
      ...NodejsFunctionProps,
    })

    const lambda_larkchat = new NodejsFunction(this, 'larkchat', {
      entry: join(__dirname, '../../src/lambda/handler_larkchat', 'index.js'),
      depsLockFilePath: join(__dirname, '../../src/lambda/handler_larkchat', 'package-lock.json'),
      bundling: {
        nodeModules: ['openai', '@larksuiteoapi/node-sdk'],
        externalModules: ['@aws-sdk'],
        forceDockerBundling: false,
        esbuildArgs: {
          '--packages': 'bundle'  // Fix for esbuild 0.22.0+ compatibility
        }
      },
      functionName: `${deploymentName}-lark-chat`,
      timeout: Duration.minutes(5),
      ...NodejsFunctionProps,
    })

    // Grant the Lambda function read access to the DynamoDB table
    dynamoEventable.grantReadWriteData(lambda_larkcallback);
    dynamoTable.grantReadWriteData(lambda_larkchat);
    dynamoStatsable.grantReadWriteData(lambda_larkchat);

    //Add the lambda subscription
    snsTopic.addSubscription(new subscriptions.LambdaSubscription(lambda_larkchat));
    // Grant the Lambda function publish data
    snsTopic.grantPublish(lambda_larkcallback);

    // Create an API Gateway resource with unique name
    const api = new RestApi(this, 'LarkchatApi', {
      restApiName: `${deploymentName}-LarkChatbot`,
      deployOptions: {
        stageName: deploymentName,
      },
      endpointConfiguration: {
        types: ['REGIONAL']  // Use REGIONAL endpoint type for China regions
      }
    });
    api.root.addMethod('POST', new LambdaIntegration(lambda_larkcallback));

    // Output the API endpoint URL with the custom stage name
    new CfnOutput(this, 'LarkCallbackURL', {
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/${deploymentName}/`,
      description: 'URL for Lark callback endpoint',
    });

    new CfnOutput(this, 'SNS Topic Arn', {
      value: snsTopic.topicArn,
      description: 'ARN of the SNS topic',
    });
    
    new CfnOutput(this, 'DeploymentName', {
      value: deploymentName,
      description: 'Name of this deployment',
    });
    
    new CfnOutput(this, 'DynamoDBMessagesTable', {
      value: dynamoTable.tableName,
      description: 'Name of the DynamoDB messages table',
    });
    
    new CfnOutput(this, 'DynamoDBStatsTable', {
      value: dynamoStatsable.tableName,
      description: 'Name of the DynamoDB stats table',
    });
    
    new CfnOutput(this, 'DynamoDBEventsTable', {
      value: dynamoEventable.tableName,
      description: 'Name of the DynamoDB events table',
    });
  }
}
