# Lark Bot CDK Deployment

This directory contains the AWS CDK code for deploying the Lark Bot serverless application.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK installed (`npm install -g aws-cdk`)

## Configuration

1. Create a `.env` file based on the `.env.tpl` template:
   ```
   cp .env.tpl .env
   ```

2. Edit the `.env` file and fill in all required values:
   ```
   # Project settings
   DB_TABLE=lark_messages
   START_CMD=/rs
   DEBUG_MODE=0  # Set to 1 to enable debug logging

   # Lark settings
   LARK_APPID=your_lark_app_id
   LARK_APP_SECRET=your_lark_app_secret
   LARK_TOKEN=your_lark_token
   LARK_ENCRYPT_KEY=your_lark_encrypt_key

   # AWS settings
   AWS_AK=your_aws_access_key
   AWS_SK=your_aws_secret_key
   AWS_REGION_CODE=your_aws_region
   AWS_BEDROCK_CLAUDE_SONNET=anthropic.claude-3-sonnet-20240229-v1:0
   AWS_CLAUDE_MAX_SEQ=10
   AWS_CLAUDE_SYSTEM_PROMPT=your_system_prompt
   AWS_CLAUDE_IMG_DESC_PROMPT=your_image_description_prompt
   AWS_CLAUDE_MAX_CHAT_QUOTA_PER_USER=1000
   ```

## Deployment

### Using the deployment script

The easiest way to deploy is using the provided script:

```bash
./deploy.sh --name your-deployment-name
```

If you don't specify a name, it will use the default name "larkbot".

### Manual deployment

If you prefer to run the CDK commands manually:

1. Bootstrap your AWS environment (if not already done):
   ```
   cdk bootstrap
   ```

2. Synthesize the CloudFormation template:
   ```
   cdk synth --context deploymentName=your-deployment-name
   ```

3. Deploy the stack:
   ```
   cdk deploy --context deploymentName=your-deployment-name
   ```

## Multiple Deployments

You can deploy multiple instances of the Lark Bot in the same AWS account by using different deployment names:

```bash
./deploy.sh --name dev-bot
./deploy.sh --name prod-bot
./deploy.sh --name test-bot
```

Each deployment will have its own set of resources with unique names, preventing conflicts.

## Destroying a Deployment

To remove a deployed stack:

```bash
./destroy.sh --name your-deployment-name
```

This will prompt for confirmation before destroying the resources.

## Output Values

After deployment, the CDK will output several important values:

- **LarkCallbackURL**: The URL to configure in your Lark application for event callbacks
- **SNS Topic Arn**: The ARN of the SNS topic used for message processing
- **DeploymentName**: The name of this deployment
- **DynamoDBMessagesTable**: The name of the DynamoDB table for storing messages
- **DynamoDBStatsTable**: The name of the DynamoDB table for storing statistics
- **DynamoDBEventsTable**: The name of the DynamoDB table for storing events
