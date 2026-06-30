# Changelog

## 1.3.0 (2026-06-30)

- 发布后的 YAML 改为标准格式（不再是 JSON）
- 透传所有原始 frontmatter 字段（description、publishDate、title 等）
- 新增 blog-path 字段（笔记在博客仓库中的路径）
- 移除部署工作流触发设置（git push 已自动触发 on:push 工作流）

## 1.2.9 (2026-06-29)

- README 翻译为英文，符合 Obsidian 插件目录要求
- CSS 移除 !important，改用更高优先级选择器
- 依赖源改为官方 npm registry，确保可复现构建
- bun.lockb 迁移为 bun.lock 文本格式

## 1.2.8 (2026-06-29)

- 插件改为通用博客发布工具，可发布到任意 GitHub 仓库
- 新增图片上传路径和图片 URL 前缀自定义设置
- 新增发布后自动触发 GitHub Actions 部署工作流
- Frontmatter 发布标记从 `dg-publish` 改为 `pub-blog`

## 1.2.7 (2026-06-27)

- 修复了多个功能完整性问题，确保插件各模块正常工作
- 优化了代码结构，提升稳定性

## 1.2.0 (2026-06-27)

- 移除 dg-home 相关功能，简化插件配置
- 更新包名为 obsidian-blog-publisher

## 1.1.0 (2026-06-27)

- 重写 README 文档，更新为个人博客发布插件说明

## 1.0.0 (2026-06-27)

- 初始发布：基于 digital-garden 插件定制的个人博客发布工具
