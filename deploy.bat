@echo off
title 公考工具箱 - 部署到GitHub
cd /d "%~dp0"

echo.
echo  正在部署到 GitHub Pages...
echo.

git remote add origin https://github.com/Sriy-fighting/gongkao-tools.git 2>nul
git remote set-url origin https://github.com/Sriy-fighting/gongkao-tools.git
git branch -M main
git push -u origin main

echo.
echo  部署完成！
echo.
echo  打开浏览器访问：
echo  https://Sriy-fighting.github.io/gongkao-tools/
echo.
pause
