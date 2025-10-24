@echo off
pwsh -NoLogo -NoProfile -File "%~dp0pre-push.ps1"
exit /b %ERRORLEVEL%
