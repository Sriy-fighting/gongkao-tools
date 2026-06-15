@echo off
title 公考工具箱 - 部署到GitHub
cd /d "%~dp0"

echo.
echo  正在部署到 GitHub Pages...
echo.

git remote add origin https://github.com/s17350196982-max/gongkao-tools.git 2>nul
git branch -M master
git push -u origin master

echo.
echo  部署完成！
echo.
echo  打开浏览器访问：
echo  https://s17350196982-max.github.io/gongkao-tools/
echo.
pause
