@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Music Player - Generate Music Library
echo ============================================
echo.

set PY=
if exist "C:\Users\33736\AppData\Local\Doubao\User Data\sandbox_runtime\bases\d0ace100fdff5b2d247847aca1e3d83b\python\python.exe" (
  set PY="C:\Users\33736\AppData\Local\Doubao\User Data\sandbox_runtime\bases\d0ace100fdff5b2d247847aca1e3d83b\python\python.exe"
)
if not defined PY ( where py >nul 2>nul && set PY=py -3 )
if not defined PY ( where python >nul 2>nul && set PY=python )

if not defined PY (
  echo [ERROR] Python not found. Please install Python 3 from https://www.python.org/
  pause
  exit /b 1
)

echo [1/2] Scanning Music folder, generating music.json and music.js ...
%PY% make_music_json.py > gen_log.txt 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Generation failed. Details:
  echo -------------------------------------------------
  type gen_log.txt
  echo -------------------------------------------------
  echo Please send the above error message for help.
  if /i not "%~1"=="test" pause
  exit /b 1
)

echo.
echo [2/2] Done!
echo Now open index.html (or refresh with Ctrl+F5) to see the library.
echo.
if /i not "%~1"=="test" pause
