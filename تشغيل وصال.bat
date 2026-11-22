@echo off
cd /d "%USERPROFILE%\Desktop\WESAL"
start "" "http://localhost:3000"
npx.cmd serve . -l 3000
pause