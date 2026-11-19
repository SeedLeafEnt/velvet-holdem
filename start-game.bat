@echo off
title Velvet Hold'em - local server
cd /d "%~dp0"
set PY=
where python >nul 2>nul && set PY=python
if not defined PY where py >nul 2>nul && set PY=py
if not defined PY (
  echo Python was not found. Install it from https://www.python.org/downloads/
  echo and tick "Add Python to PATH" during setup. Then run this file again.
  pause
  exit /b 1
)
echo Velvet Hold'em is running at http://localhost:8000
echo Keep this window open while you play. Close it to stop the game.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & explorer http://localhost:8000/index.html"
%PY% -m http.server 8000
