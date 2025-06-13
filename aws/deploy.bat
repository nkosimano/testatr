@echo off
setlocal

REM --- Set your configuration variables here ---
set "AWS_REGION=us-east-1"
set "STACK_NAME=africa-tennis-platform-stack"
set "SUPABASE_URL=https://ppuqbimzeplznqdchvve.supabase.co"
set "FRONTEND_URL=https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--858c0e43.local-credentialless.webcontainer-api.io"
set "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzNzI2MSwiZXhwIjoyMDY1MjEzMjYxfQ.NEfWLgVkb98xlApZ1T6ZeDkh5stIH1rnfs_-bJwYx0U"
set "SES_EMAIL_SOURCE=noreply@africatennis.com"

echo [INFO] Building the SAM application. This may take a moment...
REM The --use-container flag ensures a clean, consistent build environment.
call sam build --use-container

echo.
echo [INFO] Deploying the built application to AWS...
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
echo [SUCCESS] Deployment complete! Your changes should be live.

endlocal
pause
