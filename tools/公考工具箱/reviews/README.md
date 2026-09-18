# 复盘资料库

这里是公考工具箱的长期复盘资料目录。每个季度单独放在 seasons/季度目录/ 中，Skill 只需要新增或更新该目录的 review-data.json 和 match-report.json，不需要改页面代码。

## 新增一季

1. 创建 seasons/2027-国考-第31季/。
2. 放入 Skill 生成的 review-data.json、match-report.json，原始 PDF/Word 放在该季的 source/，证据图片放在共享的 assets/sources/。
3. 在仓库根目录运行：

   node tools/公考工具箱/reviews/scripts/build-library.mjs

4. 检查 match-report.json 的 validationErrors 和 duplicateConflicts，确认每道题都有匹配状态和来源证据。
5. 浏览器打开公考工具箱，进入“复盘台”核验低置信度题目；定期点击“备份”导出学习进度 JSON。

构建脚本会扫描所有季度、按稳定题目 ID 去重、检查重复内容冲突和缺失证据，并生成 library.json、review-data.js、总 match-report.json。页面只加载生成的 review-data.js，所以 GitHub Pages 无需服务器。

## 数据与同步

浏览器本机进度使用 gk-review-library-v1，会自动进入公考工具箱现有的本地/Supabase 同步机制。退出账号后本地数据仍可用；导入 JSON 会先预览新增、重复和冲突，合并时保留掌握度、答题历史和个人笔记，并提供撤销。

建议提交到 GitHub 的内容是季度结构化 JSON、证据图片、生成文件和脚本。原始资料如果包含个人信息或不适合公开，不要提交到公开仓库；页面运行不依赖这些 PDF。
