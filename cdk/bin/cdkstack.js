#!/usr/bin/env node

import {App}  from 'aws-cdk-lib';
import  { CdkstackStack }  from '../lib/cdkstack-stack.js';
import * as dotenv from 'dotenv' 
dotenv.config()

const app = new App();

// Get deployment name from context or use default
const deploymentName = app.node.tryGetContext('deploymentName') || 'larkbot';

// Create stack with unique ID based on deployment name
new CdkstackStack(app, `LarkBotStack-${deploymentName}`, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  
  // Pass deployment name as a context property to the stack
  deploymentName: deploymentName,
});
