#!/bin/bash

# Default deployment name if not provided
DEFAULT_NAME="larkbot"

# Help function
show_help() {
  echo "Usage: ./destroy.sh [OPTIONS]"
  echo ""
  echo "Destroy a deployed Lark Bot CDK stack by name"
  echo ""
  echo "Options:"
  echo "  -n, --name NAME    Specify the deployment name to destroy (default: $DEFAULT_NAME)"
  echo "  -h, --help         Show this help message"
  echo ""
  echo "Example:"
  echo "  ./destroy.sh --name dev-bot"
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

echo "Destroying deployment with name: $DEPLOYMENT_NAME"

# Validate deployment name (only allow alphanumeric characters and hyphens)
if ! [[ $DEPLOYMENT_NAME =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "Error: Deployment name can only contain alphanumeric characters and hyphens"
  exit 1
fi

# Ask for confirmation
read -p "Are you sure you want to destroy the stack 'LarkBotStack-$DEPLOYMENT_NAME'? This action cannot be undone. (y/N): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
  echo "Destruction cancelled."
  exit 0
fi

# Run CDK destroy with the specified deployment name
echo "Starting CDK destruction..."
cdk destroy --context deploymentName=$DEPLOYMENT_NAME

# Check if destruction was successful
if [ $? -eq 0 ]; then
  echo ""
  echo "Destruction successful!"
  echo "Stack 'LarkBotStack-$DEPLOYMENT_NAME' has been removed."
else
  echo ""
  echo "Destruction failed. Please check the error messages above."
fi
