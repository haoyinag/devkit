@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
  node "%SCRIPT_DIR%git-push.mjs" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%git-push.fallback.ps1" %*
)
exit /b %ERRORLEVEL%
