#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Load environment variables from the .env file
if [ -f .env ]; then
  export $(cat .env | sed 's/#.*//g' | xargs)
else
  echo "ERROR: The .env file was not found. Please create it before running this script."
  exit 1
fi

# --- Pre-flight Checks ---
# Check if required variables are set
if [ -z "$AWS_REGION" ] || [ -z "$S3_BUCKET_NAME" ] || [ -z "$STACK_NAME" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: One or more required variables are not set in the .env file."
  echo "Please check AWS_REGION, S3_BUCKET_NAME, STACK_NAME, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY."
  exit 1
fi

echo "✅ Configuration loaded successfully."

# --- Step 1: Build the Lambda functions ---
echo "⚙️  Installing dependencies and compiling TypeScript..."
npm install
npm run build
echo "✅ Build complete."

# --- Step 2: Create S3 bucket if it doesn't exist ---
echo "📦 Checking for S3 bucket: $S3_BUCKET_NAME..."
if aws s3api head-bucket --bucket "$S3_BUCKET_NAME" --region "$AWS_REGION" 2>/dev/null; then
  echo "✔️ S3 bucket already exists."
else
  echo " Bucket not found. Creating new S3 bucket: $S3_BUCKET_NAME..."
  aws s3 mb "s3://$S3_BUCKET_NAME" --region "$AWS_REGION"
  echo "✅ S3 bucket created."
fi

# --- Step 3: Package the application using AWS SAM ---
echo "📦 Packaging SAM application..."
sam package \
  --template-file template.yaml \
  --output-template-file packaged.yaml \
  --s3-bucket "$S3_BUCKET_NAME"
echo "✅ Application packaged."

# --- Step 4: Deploy the application using AWS SAM ---
echo "🚀 Deploying stack: $STACK_NAME..."
sam deploy \
  --template-file packaged.yaml \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM \
  --region "$AWS_REGION" \
  --parameter-overrides \
    SupabaseUrl="$SUPABASE_URL" \
    SupabaseServiceRoleKey="$SUPABASE_SERVICE_ROLE_KEY" \
    FrontendUrl="$FRONTEND_URL" \
    SesEmailSource="noreply@africatennis.com"
    
echo "🎉 Deployment complete! Check your AWS CloudFormation console for status."
