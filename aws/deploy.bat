@echo off
setlocal

<<<<<<< HEAD
REM --- Configuration ---
=======
REM --- Set your configuration variables here ---
>>>>>>> 7d5af029c88a1d75cf93638b63301c1d40e42906
set "AWS_REGION=us-east-1"
set "STACK_NAME=africa-tennis-platform-stack"
set "SUPABASE_URL=https://ppuqbimzeplznqdchvve.supabase.co"
set "FRONTEND_URL=https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--858c0e43.local-credentialless.webcontainer-api.io"
set "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzNzI2MSwiZXhwIjoyMDY1MjEzMjYxfQ.NEfWLgVkb98xlApZ1T6ZeDkh5stIH1rnfs_-bJwYx0U"
set "SES_EMAIL_SOURCE=noreply@africatennis.com"
<<<<<<< HEAD

echo [STEP 1/4] Cleaning up previous build artifacts...
if exist dist rmdir /s /q dist
if exist .aws-sam rmdir /s /q .aws-sam
echo.

echo [STEP 2/4] Installing dependencies and compiling TypeScript...
call npm install
call tsc
echo [SUCCESS] Build complete.
echo.

echo [STEP 3/4] Copying dependencies to each Lambda function directory...
REM This loop copies the node_modules folder into each function's dist folder.
FOR /d %%d IN (dist\lambdas\*) DO (
    echo Copying node_modules to %%d...
    xcopy node_modules %%d\node_modules\ /s /e /i /q /y
)
echo [SUCCESS] Dependencies copied.
echo.

echo [STEP 4/4] Packaging and deploying the application...
call sam package ^
  --template-file template.yaml ^
  --output-template-file packaged.yaml ^
  --s3-bucket "%S3_BUCKET_NAME%"

=======

echo [INFO] Building the SAM application. This may take a moment...
REM The --use-container flag ensures a clean, consistent build environment.
call sam build --use-container

echo.
echo [INFO] Deploying the built application to AWS...
>>>>>>> 7d5af029c88a1d75cf93638b63301c1d40e42906
call sam deploy ^
  --stack-name "%STACK_NAME%" ^
  --capabilities CAPABILITY_IAM ^
  --region "%AWS_REGION%" ^
  --parameter-overrides ^
    SupabaseUrl="%SUPABASE_URL%" ^
    SupabaseServiceRoleKey="%SUPABASE_SERVICE_ROLE_KEY%" ^
    FrontendUrl="%FRONTEND_URL%" ^
    SesEmailSource="%SES_EMAIL_SOURCE%" ^
  --no-confirm-changeset

echo.
<<<<<<< HEAD
echo [SUCCESS] Deployment is complete! Your application should now be working.
=======
echo [SUCCESS] Deployment complete! Your changes should be live.
>>>>>>> 7d5af029c88a1d75cf93638b63301c1d40e42906

endlocal
pause
