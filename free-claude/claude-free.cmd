@echo off
rem Startet Claude Code im Frei-Modus (FreeLLMAPI). Siehe claude-free.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0claude-free.ps1" %*
