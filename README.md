# 公考工具箱 (Civil Service Exam Toolbox)

公考备考一站式工具集，集成四大备考工具：

## 工具列表

| 工具 | 说明 |
|------|------|
| **公考助手** | 模拟考场环境，计时提醒，自定义科目与评分 |
| **申论方格纸** | 方格纸写作，字数统计，计时器，模板插入 |
| **资料速算** | 乘法百化分速算训练，练习与复习双模式，错题自动重做 |
| **遗忘曲线** | 艾宾浩斯复习计划，学习项目记录，自动排期，导入导出 |

## 目录结构

```
.
├── tools/
│   ├── 公考工具箱/      ← 门户入口（Dashboard + 工具导航）
│   │   ├── index.html
│   │   └── assets/
│   ├── 公考助手/        ← 模考计时工具
│   ├── 申论方格纸/      ← 申论写作练习
│   ├── 资料训练/        ← 资料分析速算训练
│   └── 遗忘曲线/        ← 艾宾浩斯复习计划
├── index.html           ← 自动重定向到公考工具箱
├── deploy.bat           ← GitHub Pages 部署脚本
├── README.md
└── .gitignore
```

## 部署到 GitHub Pages

直接运行 `deploy.bat`，或手动执行：

```bash
git remote add origin https://github.com/YOUR_USERNAME/gongkao-tools.git
git branch -M master
git push -u origin master
```

部署完成后访问 `https://YOUR_USERNAME.github.io/gongkao-tools/`

## 本地开发

使用 Python 启动 HTTP 服务器：

```bash
python -m http.server 8080
```

然后用浏览器访问 `http://localhost:8080`

## 技术栈

纯前端 · HTML + CSS + JavaScript · 无依赖 · 零配置 · 即开即用
