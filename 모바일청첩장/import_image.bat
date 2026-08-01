@echo off
chcp 65001 > nul
setlocal

rem ============================================================
rem  사진 채우기
rem
rem  사용법 1) 사진이 든 폴더를 이 파일 위로 끌어다 놓으세요.
rem  사용법 2) 사진 여러 장을 골라 이 파일 위로 끌어다 놓으세요.
rem  사용법 3) 그냥 더블클릭하면 폴더 경로를 물어봅니다.
rem
rem  첫 번째 사진이 표지가 됩니다.
rem  순서를 정하고 싶으면 원본 파일 이름 앞에 01_, 02_ 를 붙이세요.
rem ============================================================

cd /d "%~dp0"

where python > nul 2>&1
if errorlevel 1 (
  echo.
  echo [오류] 파이썬을 찾을 수 없습니다.
  echo        https://www.python.org 에서 설치한 뒤 다시 실행하세요.
  echo        설치할 때 "Add Python to PATH" 를 꼭 체크하세요.
  echo.
  pause
  exit /b 1
)

python "tools\import_photos.py" %*

echo.
pause
