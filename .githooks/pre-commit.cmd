@echo off
pwsh -NoLogo -NoProfile -File "%~dp0pre-commit.ps1"
exit /b %ERRORLEVEL%
