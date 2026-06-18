# 公考工具箱 (Civil Service Exam Toolbox)

公考备考一站式工具集，集成四大备考工具：

## 工具列表

| 工具 | 说明 |
|------|------|
| **套卷分数计算** | 模拟考场环境，计时提醒，自定义科目与评分 |
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

## 账号登录与云端同步

站点已预留 Supabase Auth + Postgres 个人数据同步能力。默认未配置时，所有工具仍使用浏览器本地存储。

启用步骤：

1. 在 Supabase 创建项目，并启用 Email/Password 登录。
2. 在 Supabase SQL Editor 执行：

```sql
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_key text not null,
  data_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, data_key)
);

alter table public.user_data enable row level security;

create policy "Users can read own data"
on public.user_data for select
using (auth.uid() = user_id);

create policy "Users can insert own data"
on public.user_data for insert
with check (auth.uid() = user_id);

create policy "Users can update own data"
on public.user_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own data"
on public.user_data for delete
using (auth.uid() = user_id);
```

3. 打开 `tools/公考工具箱/assets/js/sync.js`，填写：

```js
var SUPABASE_URL = "你的 Project URL";
var SUPABASE_ANON_KEY = "你的 anon public key";
```

不要填写或提交 service role key。首次登录后，本地数据会优先合并上传到当前账号。
