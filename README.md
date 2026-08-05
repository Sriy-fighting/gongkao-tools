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

## 专注游历

参考 `https://www.anshang.site/?view=travel` 的「专注计时」与「游历殿堂」体验，但不把两者拆成独立模块。用户完成一次专注，即推进同一段游历剧情、获得旅途记录或解锁场景；从剧情入口也能回到下一次专注。

建议原创主题为 **《长安题途》**：考生化身“巡策使”，在一百日备考旅程中穿行“晨读驿”“申论渡”“数理关”“政治理论坊”“金榜台”等场景。每次专注都是一段行程；按累计时长、连续天数和计划完成度推进地图与故事。剧情与视觉资产必须原创，不复刻参考站点的文案、角色、图片或界面。

核心体验要求：

- 支持开始、暂停、继续、结束专注，以及常用时长预设与自定义时长。
- 结束后可关联学习计划任务、记录科目与简短复盘；数据反馈到日计划和周计划完成度。
- 在一个连贯页面/流程内展示计时状态、当前旅程、已解锁内容与下一目标，避免成为两个互不关联的入口。
- 具备刷新恢复、防误触结束、无障碍键盘操作与移动端适配；计时逻辑以本地可信时间为准，不能因切换标签页而失真。

### 验收标准

1. 用户完成一段专注后，关联任务的进度与游历剧情均会更新；二者从同一流程可达。
2. 手机与桌面端的核心流程均可用；刷新页面后进行中的专注和已保存记录不会丢失或产生错误时长。
3. 不存在硬编码私钥或会将用户数据上传到非必要第三方的实现。
4. 完成开发后进行对抗式审查，至少覆盖跨站脚本、计时篡改与重复结算、刷新/断网恢复、数据迁移、移动端交互和无障碍。

### 交付流程

1. 实现并手动验证行程计划与专注游历联动。
2. 进行对抗式代码与体验审查，修复发现的问题，并记录结果。
3. 更新本 README 与部署说明。
4. 在确认无真实凭据、测试通过且 Git 工作区变更明确后，提交并推送到配置好的 GitHub 仓库。

## 《长安题途》数据说明

首页“今日行程”将专注倒计时、当天任务和地图收集合并为一个流程。状态保存在 `gk-focus-journey`，并会随登录同步、导入和导出：

- 满 5 分钟的已结算专注获得一枚行程印记；累计 0 / 300 / 900 / 1800 / 3000 分钟依次解锁晨读驿、申论渡、数理关、政治理论坊、金榜台。
- 关联任务会累计专注分钟；是否完成任务始终由用户在保存行程时确认。
- 刷新或切换标签页后按保存的开始时间重算；同一会话 ID 只结算一次。该数据是个人学习记录，不用于任何高价值积分或排名。
