# Obsidian Blog Publisher

将 Obsidian 笔记发布到任意 GitHub 仓库的博客发布插件。

> 基于 [Obsidian Digital Garden](https://github.com/oleeskild/obsidian-digital-garden) 修改。

## 功能特性

### 内容支持
- 基础 Markdown 语法
- 笔记间链接
- Dataview 查询（代码块、行内和 DataviewJS）
- Canvas
- 笔记嵌入/引用
- Excalidraw 绘图嵌入
- 图片嵌入（自动上传到指定路径）
- PDF 嵌入（最大 20MB，内联渲染）
- Callouts/Admonitions
- 代码块
- MathJax 数学公式
- 高亮文本
- 脚注
- Mermaid 图表
- PlantUML 图表

### 发布功能
- **单篇发布** — 发布当前笔记到 GitHub 仓库
- **批量发布** — 一次性发布所有标记的笔记
- **发布中心** — 可视化管理已发布和待发布的笔记
- **图片自动上传** — 笔记中的图片自动上传到指定仓库路径
- **自动触发部署** — 发布后可自动触发 GitHub Actions 工作流
- **路径重写** — 支持自定义笔记和图片的发布路径
- **Permalink 自动生成** — 发布时自动在 frontmatter 中写入 permalink

### 隐私控制
- **选择性发布** — 仅标记 `pub-blog: true` 的笔记会被发布
- **无意外泄露** — 链接的笔记不会自动发布
- **完全控制** — 私有笔记保持私有

## 快速开始

### 前置要求
1. GitHub 账号
2. 一个用于托管博客内容的 GitHub 仓库

### 设置步骤

1. **创建 GitHub Access Token**
   - 访问 [Fine-grained token 设置页](https://github.com/settings/personal-access-tokens/new)
   - 配置权限：
     - Resource owner: 自己
     - 仅选择你的博客仓库
     - Permissions:
       - Contents: `Read and write`
       - Actions: `Read and write`（如需触发部署工作流）
   - 生成并复制 Token

2. **配置插件**
   - 在 Obsidian 设置中找到 "Blog Publisher"
   - 填写：
     - GitHub 用户名
     - 仓库名称
     - Access Token
     - 内容发布路径（默认 `src/content/`）
     - 图片上传路径（默认 `src/site/img/user/`）
     - 图片 URL 前缀（默认 `/img/user/`）
     - 部署工作流文件名（如 `deploy.yml`，留空则不触发）

3. **发布笔记**
   - 在笔记 Frontmatter 中添加：
   ```yaml
   ---
   pub-blog: true
   ---
   ```
   - 使用命令面板执行 "Blog Publisher: 发布当前笔记"

## 可用命令

| 命令 | 描述 |
|------|------|
| 快速发布并分享笔记 | 发布笔记并复制链接 |
| 发布当前笔记 | 发布当前活动笔记 |
| 发布所有标记的笔记 | 批量发布所有 `pub-blog: true` 的笔记 |
| 复制笔记URL | 复制已发布笔记的访问链接 |
| 打开发布中心 | 打开发布管理界面 |
| 添加发布标记 | 在当前笔记添加 `pub-blog: true` |
| 移除发布标记 | 移除当前笔记的发布标记 |
| 切换发布状态 | 切换 `pub-blog` 标记状态 |

## 本地开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
npm run format
```

## 技术栈

- **框架**: Obsidian Plugin
- **语言**: TypeScript, Svelte
- **构建**: esbuild
- **测试**: Jest
- **代码质量**: ESLint, Prettier, Husky

## 许可证

MIT License
