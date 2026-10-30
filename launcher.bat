@echo off
if /I "%~1"=="shell" (
  call "%~dp0backend\scripts\dev-shell.cmd"
  exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\launch.ps1"
if errorlevel 1 pause
