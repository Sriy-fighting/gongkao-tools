# 公考工具箱 (Civil Service Exam Toolbox)

公考备考一站式工具集，集成备考工具与常识学习资料：

## 工具列表

| 工具 | 说明 |
|------|------|
| **套卷分数计算** | 模拟考场环境，计时提醒，自定义科目与评分 |
| **申论方格纸** | 方格纸写作，字数统计，计时器，模板插入 |
| **速算练习** | 乘法百化分速算训练，练习与复习双模式，错题自动重做 |
| **常识30天** | 前20天新学、后10天总复习，学后第1/2/4/7/15天节点复习，遮答案自测，进度打卡 |

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
│   ├── 公考常识50天/    ← 常识30天计划（保留原链接）
├── index.html           ← 自动重定向到公考工具箱
├── deploy.bat           ← GitHub Pages 部署脚本
├── README.md
└── .gitignore
```

## 部署到 GitHub Pages

直接运行 `deploy.bat`，或手动执行：

```bash
git remote add origin https://github.com/Sriy-fighting/gongkao-tools.git
git branch -M main
git push -u origin main
```

部署完成后访问 `https://Sriy-fighting.github.io/gongkao-tools/`

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

## 专注游历

首页提供独立专注计时，支持开始、暂停、继续、结束、时长预设和简短复盘。状态保存在 `gk-focus-journey`，随账号同步和 JSON 备份迁移。刷新或切换标签页后按保存时间恢复，同一会话只结算一次。

满5分钟的已结算专注获得一枚行程印记；累计0 / 300 / 900 / 1800 / 3000分钟依次解锁晨读驿、申论渡、数理关、政治理论坊、金榜台。已保存的专注时长、印记及复盘继续保留。

## 已移除模块与数据清理

五四讲话背诵、政治常识复盘、学习计划、复习安排已移除，包括入口、页面、脚本、样式及专属音频、题库、源资料和图片。

打开任一保留工具时，自动清除该浏览器中上述模块的旧存储、同步时间戳、自定义名称、排序和专注记录中的任务关联。登录同步时，按当前账号删除对应云端数据行并清理共享设置；清理失败会在后续同步重试。导入旧备份和云端合并均过滤已删除模块，避免重新恢复。此清理不需要管理员密钥，只处理当前登录账号的数据。

验证清理及同步：`node tools/公考工具箱/tests/module-removal.test.cjs`。

## 常识30天计划

保留原有81个知识小节、494条考点和43张法律导图。前20天按原顺序合并相邻两天的新学内容，每天18–30条；第21–30天保持原有10组模块总复习。到期复习按学后第1、2、4、7、15天安排，同一天与模块总复习重叠的小节只列一次。法律导图仍在前15天按每天最多3张展示。

模块链接、内部标识和 `gk50:` 存储前缀继续沿用，原有学习勾选、考点编辑、开始日期和账号同步仍可使用。50天版本的补充内容自动按新排期迁移（第1–40天两天合并，第41–50天对应第21–30天）；已完成的补充内容仍保留勾选。复习任务使用新的打卡标识，按30天排期重新打卡。

验证排期和迁移逻辑：`node tools/公考常识50天/tests/plan.test.cjs`。
