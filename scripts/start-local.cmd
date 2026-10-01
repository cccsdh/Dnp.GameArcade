@echo off
rem Double-click to play the arcade locally. Passes any arguments through (e.g. -Preview).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %*
if errorlevel 1 pause
