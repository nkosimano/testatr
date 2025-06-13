@echo off
setlocal

REM --- AWS & Project Configuration ---
REM The AWS region where you want to deploy your resources (e.g., us-east-1, eu-west-2)
set "AWS_REGION=us-east-1"

REM A globally unique name for the S3 bucket to store deployment artifacts
set "S3_BUCKET_NAME=africa-tennis-artifacts-nathi-2025"

REM The name for the CloudFormation stack that will be created
set "STACK_NAME=africa-tennis-platform-stack"

REM -- Supabase & Frontend URLs --
REM Found in your Supabase project under Project Settings > API
set "SUPABASE_URL=https://ppuqbimzeplznqdchvve.supabase.co"

REM The URL of your hosted frontend application
set "FRONTEND_URL=http://localhost:5173"

REM -- Supabase Secret Key --
REM Found in your Supabase project under Project Settings > API > Project API Keys
REM IMPORTANT: Use the 'service_role' key.
set "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzNzI2MSwiZXhwIjoyMDY1MjEzMjYxfQ.NEfWLgVkb98xlApZ1T6ZeDkh5stIH1rnfs_-bJwYx0U"

echo [INFO] Configuration loaded successfully.
echo.

REM --- Step 1: Build the Lambda functions ---
echo [INFO] Installing dependencies and compiling TypeScript...
call npm install
call npm run build
echo [SUCCESS] Build complete.
echo.

REM --- Step 2: Create S3 bucket if it doesn't exist ---
echo [INFO] Checking for S3 bucket: %S3_BUCKET_NAME%...
aws s3api head-bucket --bucket "%S3_BUCKET_NAME%" --region "%AWS_REGION%" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Bucket not found. Creating new S3 bucket: %S3_BUCKET_NAME%...
    aws s3 mb "s3://%S3_BUCKET_NAME%" --region "%AWS_REGION%"
    echo [SUCCESS] S3 bucket created.
) else (
    echo [SUCCESS] S3 bucket already exists.
)
echo.

REM --- Step 3: Package the application using AWS SAM ---
echo [INFO] Packaging SAM application...
call sam package ^
  --template-file template.yaml ^
  --output-template-file packaged.yaml ^
  --s3-bucket "%S3_BUCKET_NAME%"
echo [SUCCESS] Application packaged.
echo.

REM --- Step 4: Deploy the application using AWS SAM ---
echo [INFO] Deploying stack: %STACK_NAME%...
call sam deploy ^
  --template-file packaged.yaml ^
  --stack-name "%STACK_NAME%" ^
  --capabilities CAPABILITY_IAM ^
  --region "%AWS_REGION%" ^
  --parameter-overrides ^
    SupabaseUrl="%SUPABASE_URL%" ^
    SupabaseServiceRoleKey="%SUPABASE_SERVICE_ROLE_KEY%" ^
    FrontendUrl="%FRONTEND_URL%" ^
    SesEmailSource="noreply@africatennis.com"
    
echo [SUCCESS] Deployment complete! Check your AWS CloudFormation console for status.
echo.

endlocal
pause
