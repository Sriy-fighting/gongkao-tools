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

## 下一阶段：智能学习计划与专注游历

本阶段将在既有工具箱中新增两项相互协同的能力：由 AI 辅助生成并落地的学习计划，以及以「专注—游历—成长」为主线的专注计时体验。实施时应先从用户的实际目标、时间与反馈出发，再决定页面与数据结构；避免为了展示技术概念而增加无效层级或术语。

### 目标一：AI 学习计划

- 支持用户接入自己的 DeepSeek API，由 AI 根据考试目标、可用时间、科目基础、截止日期和偏好提出计划建议。
- AI 输出须能转化为可编辑、可确认的日计划与周计划；用户确认后才写入计划，且可随时手动调整、重新生成或撤销。
- 页面优先呈现「今天该做什么」「本周进度」「下一步」，不展示对用户没有直接操作价值的“执行层”“规划层”等内部概念。
- 优化学习计划的排版：移动端优先、信息层级清晰、今日任务可快速完成或跳过、周视图便于了解负荷与调整。
- 计划应考虑已完成情况、跳过记录、专注时长和临近考试日期，并在下一次生成时给出合理调整，而非机械重复原计划。

### 目标二：专注游历

参考 `https://www.anshang.site/?view=travel` 的「专注计时」与「游历殿堂」体验，但不把两者拆成独立模块。用户完成一次专注，即推进同一段游历剧情、获得旅途记录或解锁场景；从剧情入口也能回到下一次专注。

建议原创主题为 **《长安题途》**：考生化身“巡策使”，在一百日备考旅程中穿行“晨读驿”“申论渡”“数理关”“行测坊”“金榜台”等场景。每次专注都是一段行程；按累计时长、连续天数和计划完成度推进地图与故事。剧情与视觉资产必须原创，不复刻参考站点的文案、角色、图片或界面。

核心体验要求：

- 支持开始、暂停、继续、结束专注，以及常用时长预设与自定义时长。
- 结束后可关联学习计划任务、记录科目与简短复盘；数据反馈到日计划和周计划完成度。
- 在一个连贯页面/流程内展示计时状态、当前旅程、已解锁内容与下一目标，避免成为两个互不关联的入口。
- 具备刷新恢复、防误触结束、无障碍键盘操作与移动端适配；计时逻辑以本地可信时间为准，不能因切换标签页而失真。

### DeepSeek 接入与安全

不得将 API Key 写进 HTML、JavaScript、Git 历史、README 或任何公开 GitHub Pages 静态资源。由于 GitHub Pages 无法安全保存私钥，接入方案必须二选一：

1. 由用户在浏览器中临时输入并仅保存在其本机（明确告知风险与清除方式）；或
2. 使用受认证、限流的服务端/边缘函数代理，由服务端读取密钥。

默认优先采用第二种方案。AI 请求应设置超时、错误提示、重试边界与输入长度限制；只发送制定计划所必需的信息，并在提交前让用户知情。仓库中仅保留 `.env.example`，不提交真实凭据。

> 安全提示：任何已在聊天、截图或代码中暴露过的真实 API Key 都应尽快在服务商控制台撤销并重新生成。

### 验收标准

1. 用户能完成资料填写、获取 AI 计划草案、编辑确认，并在日/周计划看到实际任务。
2. 用户完成一段专注后，关联任务的进度与游历剧情均会更新；二者从同一流程可达。
3. 未配置 AI 或请求失败时，计划和专注功能仍可正常使用，并给出可理解的降级提示。
4. 手机与桌面端的核心流程均可用；刷新页面后进行中的专注和已保存记录不会丢失或产生错误时长。
5. 不存在硬编码密钥、私钥文件或会将用户密钥上传到非必要第三方的实现。
6. 完成开发后进行对抗式审查，至少覆盖：提示词注入与异常 AI 输出、密钥泄露、跨站脚本、计时篡改与重复结算、刷新/断网恢复、数据迁移、移动端交互和无障碍。

### 交付流程

1. 盘点现有学习计划工具与数据结构，确定最小可用版本和迁移方案。
2. 实现并手动验证两项功能及其联动。
3. 进行对抗式代码与体验审查，修复发现的问题，并记录结果。
4. 更新本 README、必要的配置示例与部署说明。
5. 在确认无真实凭据、测试通过且 Git 工作区变更明确后，提交并推送到配置好的 GitHub 仓库。

### 视觉资产

如需新增位图插画或场景图，使用 `gpt-image-2` 生成原创素材并保存到本地资源目录；生成参数和 API 凭据通过本地环境变量或安全配置传入，绝不写入源码或文档。

## 部署 AI 学习计划（Supabase Edge Function）

“AI 制定 30 天计划”只对已登录用户开放。浏览器把请求发送给 Supabase Edge Function；函数验证登录身份、按用户限流（每小时 5 次），再从 Supabase Secret 中读取 DeepSeek 密钥。因此，真实密钥不会进入 GitHub Pages 或本仓库。

首次部署由 Supabase 项目管理员执行：

```bash
supabase login
supabase link --project-ref srevbdznsrvpwivvdfla
supabase db push
supabase secrets set DEEPSEEK_API_KEY="你的 DeepSeek API Key"
supabase secrets set DEEPSEEK_MODEL="deepseek-chat"
supabase secrets set ALLOWED_ORIGINS="https://sriy-fighting.github.io,http://localhost:8080"
supabase functions deploy ai-study-plan
```

部署前请核对 `supabase/.env.example`，并在 Supabase 控制台确认 Email/Password 登录已启用。不要把 `.env`、终端历史、截图或真实 Key 提交到 Git。函数部署后，登录用户可从“学习计划 → AI 制定 30 天计划”生成、编辑并确认草案；未登录用户仍可使用手动计划和《长安题途》专注功能。

## 《长安题途》数据说明

首页“今日行程”将专注倒计时、当天任务和地图收集合并为一个流程。状态保存在 `gk-focus-journey`，并会随登录同步、导入和导出：

- 满 5 分钟的已结算专注获得一枚行程印记；累计 0 / 300 / 900 / 1800 / 3000 分钟依次解锁晨读驿、申论渡、数理关、行测坊、金榜台。
- 关联任务会累计专注分钟；是否完成任务始终由用户在保存行程时确认。
- 刷新或切换标签页后按保存的开始时间重算；同一会话 ID 只结算一次。该数据是个人学习记录，不用于任何高价值积分或排名。
