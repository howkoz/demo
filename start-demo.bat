@echo off
REM Portal 9094 demo launcher - static server on port 9094.
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  Portal 9094 - Payment Operations Command Center (DEMO)
echo  http://localhost:9094/
echo  Ctrl+C to stop
echo ==========================================================
start "" "http://localhost:9094/"
python -m http.server 9094
endlocal
