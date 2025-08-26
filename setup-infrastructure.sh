#!/bin/bash

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="query-profiler-cluster"
ECR_REPO_NAME="query-profiler-frontend"

echo "Setting up infrastructure for Query Profiler Dashboard..."
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"

# Create ECR repository
echo "Creating ECR repository..."
aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 || echo "Repository may already exist"

# Create EKS cluster (this takes 10-15 minutes)
echo "Creating EKS cluster..."
eksctl create cluster \
    --name $CLUSTER_NAME \
    --region $AWS_REGION \
    --nodegroup-name standard-workers \
    --node-type t3.medium \
    --nodes 2 \
    --nodes-min 1 \
    --nodes-max 4 \
    --managed

# Create IAM role for CodeBuild
echo "Creating CodeBuild service role..."
aws iam create-role \
    --role-name CodeBuildServiceRole \
    --assume-role-policy-document file://aws-infrastructure/codebuild-role.json

aws iam put-role-policy \
    --role-name CodeBuildServiceRole \
    --policy-name CodeBuildServiceRolePolicy \
    --policy-document file://aws-infrastructure/codebuild-policy.json

# Create IAM role for kubectl access
echo "Creating kubectl role..."
aws iam create-role \
    --role-name CodeBuildKubectlRole \
    --assume-role-policy-document file://aws-infrastructure/kubectl-role.json

aws iam attach-role-policy \
    --role-name CodeBuildKubectlRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

# Update EKS cluster auth
echo "Updating EKS cluster authentication..."
eksctl create iamidentitymapping \
    --cluster $CLUSTER_NAME \
    --region $AWS_REGION \
    --arn arn:aws:iam::$AWS_ACCOUNT_ID:role/CodeBuildKubectlRole \
    --group system:masters \
    --username codebuild

# Create CodeBuild project
echo "Creating CodeBuild project..."
cat > codebuild-project.json << EOF
{
  "name": "query-profiler-build",
  "description": "Build and deploy Query Profiler Dashboard to EKS",
  "source": {
    "type": "GITHUB",
    "location": "https://github.com/YOUR_USERNAME/query-profile-visualizer-dashboard.git",
    "buildspec": "buildspec.yml"
  },
  "artifacts": {
    "type": "NO_ARTIFACTS"
  },
  "environment": {
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/amazonlinux2-x86_64-standard:3.0",
    "computeType": "BUILD_GENERAL1_MEDIUM",
    "privilegedMode": true,
    "environmentVariables": [
      {
        "name": "AWS_DEFAULT_REGION",
        "value": "$AWS_REGION"
      },
      {
        "name": "AWS_ACCOUNT_ID",
        "value": "$AWS_ACCOUNT_ID"
      },
      {
        "name": "IMAGE_REPO_NAME",
        "value": "$ECR_REPO_NAME"
      },
      {
        "name": "EKS_CLUSTER_NAME",
        "value": "$CLUSTER_NAME"
      },
      {
        "name": "EKS_KUBECTL_ROLE_ARN",
        "value": "arn:aws:iam::$AWS_ACCOUNT_ID:role/CodeBuildKubectlRole"
      }
    ]
  },
  "serviceRole": "arn:aws:iam::$AWS_ACCOUNT_ID:role/CodeBuildServiceRole"
}
EOF

aws codebuild create-project --cli-input-json file://codebuild-project.json

echo "Infrastructure setup complete!"
echo "ECR Repository: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
echo "EKS Cluster: $CLUSTER_NAME"
echo "CodeBuild Project: query-profiler-build"
echo ""
echo "Next steps:"
echo "1. Update your GitHub repository URL in codebuild-project.json"
echo "2. Set up GitHub webhook for automatic builds"
echo "3. Update buildspec.yml with your actual AWS account ID and region"