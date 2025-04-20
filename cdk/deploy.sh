#!/bin/bash

# Default deployment name if not provided
DEFAULT_NAME="larkbot"

# Help function
show_help() {
  echo "Usage: ./deploy.sh [OPTIONS]"
  echo ""
  echo "Deploy the Lark Bot CDK stack with customizable deployment name"
  echo ""
  echo "Options:"
  echo "  -n, --name NAME    Specify a deployment name (default: $DEFAULT_NAME)"
  echo "  -h, --help         Show this help message"
  echo ""
  echo "Example:"
  echo "  ./deploy.sh --name dev-bot"
}

# Parse command line arguments
DEPLOYMENT_NAME=$DEFAULT_NAME

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -n|--name)
      DEPLOYMENT_NAME="$2"
      shift # past argument
      shift # past value
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

echo "Deploying with name: $DEPLOYMENT_NAME"

# Validate deployment name (only allow alphanumeric characters and hyphens)
if ! [[ $DEPLOYMENT_NAME =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "Error: Deployment name can only contain alphanumeric characters and hyphens"
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one based on .env.tpl"
  exit 1
fi

# Run CDK deploy with the specified deployment name
echo "Starting CDK deployment..."
npx cdk deploy --context deploymentName=$DEPLOYMENT_NAME

# Check if deployment was successful
if [ $? -eq 0 ]; then
  echo ""
  echo "Deployment successful!"
  echo "Stack name: LarkBotStack-$DEPLOYMENT_NAME"
  echo ""
  echo "To update this deployment in the future, run:"
  echo "./deploy.sh --name $DEPLOYMENT_NAME"
else
  echo ""
  echo "Deployment failed. Please check the error messages above."
fi
