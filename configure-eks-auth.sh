#!/bin/bash

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="869620365293"
CLUSTER_NAME="query-profiler-dashboard"

echo "Configuring EKS authentication..."

# Update kubeconfig
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Create IAM identity mapping for CodeBuild kubectl role
eksctl create iamidentitymapping \
    --cluster $CLUSTER_NAME \
    --region $AWS_REGION \
    --arn arn:aws:iam::$AWS_ACCOUNT_ID:role/CodeBuildKubectlRole \
    --group system:masters \
    --username codebuild

echo "EKS authentication configured successfully!"
echo "You can now use kubectl to interact with your cluster:"
echo "kubectl get nodes"