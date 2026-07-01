# Obsidian Blog Publisher

将 Obsidian 笔记一键发布到任意 GitHub 仓库托管的博客。

> 基于 [Obsidian Digital Garden](https://github.com/oleeskild/obsidian-digital-garden) 修改。

---

## 中文文档

### 这是什么

Blog Publisher 让你直接在 Obsidian 里把笔记发布到 GitHub 仓库。你在笔记的 frontmatter 里加上 `pub-blog: true`，运行发布命令，笔记就会推送到你配置的仓库中。如果你的博客仓库配了 GitHub Actions 自动部署，push 之后博客会自动更新。

适合已经用 GitHub Pages / Vercel / Netlify 等方案托管博客的人——你的 Obsidian 笔记库就是博客的内容源。

### 功能一览

**发布方式**
- 单篇发布：把当前打开的笔记发布到 GitHub 仓库
- 批量发布：一次性发布所有标记了 `pub-blog: true` 的笔记
- 快速发布并分享：发布后自动把笔记的 URL 复制到剪贴板
- 发布中心：可视化界面，查看哪些笔记已发布、哪些有改动、哪些待发布

**内容支持**
- 基础 Markdown 语法
- 笔记间链接（`[[链接]]`）
- Dataview 查询（代码块、行内、DataviewJS）
- Canvas 画布
- 笔记嵌入 / 引用块（`![[嵌入]]`）
- Excalidraw 嵌入
- 图片嵌入（自动上传到配置的仓库路径）
- PDF 嵌入（最大 20MB，内联渲染）
- Callout / Admonition 标注块
- 代码块
- MathJax 数学公式
- 高亮文本（`==高亮==`）
- 脚注
- Mermaid 流程图
- PlantUML 图表

**图片处理**
- 笔记中的图片自动上传到你配置的仓库路径
- 已上传的图片通过 hash 比对跳过重复上传
- 图片链接自动改写为配置的 URL 前缀

**Frontmatter 处理**
- 发布时自动透传所有 frontmatter 字段（`title`、`description`、`publishDate` 等）
- 发布后的 YAML 使用标准格式（非 JSON）
- 自动生成 `permalink` 并写入 frontmatter
- 自动写入 `blog-path` 字段（笔记在博客仓库中的路径）

**状态跟踪**（可选启用）
- 在 `pub-blog: true` 基础上，用 `status` 字段控制发布中心的状态分类
- `status: ongoing`（可配置）→ 发布中心检查远程内容，判断是未发布还是有改动
- `status: done`（可配置）→ 跳过检查，直接显示为已发布
- 适合做了小修改但不想重复推送的场景
- 未启用时使用硬编码的状态值（`🟡 Ongoing` / `🟢 Done`）

**隐私控制**
- 只有标记了 `pub-blog: true` 的笔记才会被发布
- 链接的笔记不会自动发布——你标记什么，什么才公开
- 私有笔记始终留在本地

### 快速开始

#### 前置条件

1. 一个 GitHub 账号
2. 一个用来托管博客内容的 GitHub 仓库（已有或新建都行）
3. 仓库已配置自动部署（如 GitHub Actions），这样 push 后博客会自动更新

#### 配置步骤

**第一步：创建 GitHub Token**

1. 打开 [Fine-grained token 创建页面](https://github.com/settings/personal-access-tokens/new)
2. 填写：
   - **Resource owner**：选择你自己
   - **Repository access**：选择 "Only select repositories"，然后选中你的博客仓库
   - **Permissions**：
     - `Contents` → `Read and write`（必需，用于读写文件）
     - `Actions` → `Read and write`（可选，如果需要触发部署工作流）
3. 生成后复制 Token，页面关闭后无法再看到

**第二步：安装插件并配置**

1. 在 Obsidian 设置 → 社区插件中安装 Blog Publisher
2. 打开插件设置页（Settings → Blog Publisher）
3. 填写 GitHub 仓库设置（详见下方设置项说明）
4. 设置页会实时显示连接状态——看到绿色 ✓ 表示配置正确

**第三步：发布第一篇笔记**

1. 在笔记的 frontmatter 中添加 `pub-blog: true`：
   ```yaml
   ---
   pub-blog: true
   title: 我的第一篇博客
   ---
   ```
2. 打开命令面板（`Ctrl/Cmd + P`），运行 "Blog Publisher: 发布当前笔记"
3. 看到 "笔记发布成功！" 提示即完成

### 设置项详解

设置页分为三个部分：GitHub 仓库设置、路径改写、高级。

#### GitHub 仓库设置（必填）

这部分配置你的 GitHub 仓库连接信息。填写完成后会自动检查连接状态。

| 设置项 | 说明 | 示例 |
|--------|------|------|
| **仓库名称** | 你的博客仓库名称（不含用户名前缀） | `myblog` |
| **GitHub 用户名** | 你的 GitHub 用户名 | `joeytoday` |
| **GitHub Token** | 具有仓库读写权限的 Token（输入框已做密码遮挡） | `github_pat_xxxx...` |
| **内容发布路径** | 笔记在仓库中的存放路径，末尾会自动补 `/` | `src/content/`（默认） |
| **图片上传路径** | 图片在仓库中的存放路径，末尾会自动补 `/` | `src/site/img/user/`（默认） |
| **图片 URL 前缀** | 发布后 Markdown 中图片链接的前缀 | `/img/user/`（默认） |

**路径说明**：假设你的笔记叫 `weekly-01.md`，内容发布路径设为 `src/content/`，发布后文件会出现在仓库的 `src/content/weekly-01.md`。图片同理，如果你在笔记里引用了 `![[screenshot.png]]`，图片会上传到 `src/site/img/user/screenshot.png`，发布后的 Markdown 中图片链接变成 `![](/img/user/screenshot.png)`。

#### 路径改写

路径改写规则让你把 Obsidian 中的文件夹结构映射到博客仓库中的不同结构。

| 设置项 | 说明 |
|--------|------|
| **路径改写规则** | 每行一条规则，格式为 `原始路径:目标路径` |

**示例**：

假设你的 Obsidian 笔记库结构是 PARA 体系，博客想按主题组织：

```
1-projects/blog/:blog/
1-projects/worknotes/:worknotes/
notes/PARA系统.md:notes/PARA系统.md
```

效果：
- `1-projects/blog/2026/weekly-01.md` → 发布到 `blog/2026/weekly-01.md`
- `1-projects/worknotes/2026/note.md` → 发布到 `worknotes/2026/note.md`
- 不匹配任何规则的笔记保持原路径

提示：留空目标路径（如 `old-folder:`）表示映射到仓库根目录。

#### 状态跟踪

状态跟踪让你用 frontmatter 中的状态字段控制发布中心的状态分类。在 `pub-blog: true` 的基础上，状态字段决定发布中心是否检查远程内容。

核心场景：做了一些小修改（比如改个错别字），不想重新发布。把状态改为已发布值，发布中心就不会再提示有改动。

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| **启用状态跟踪** | 开关。启用后用可配置的状态值替代硬编码的 `🟡 Ongoing` / `🟢 Done` | 关闭 |
| **状态属性名** | 用于状态跟踪的 frontmatter 属性名 | `status` |
| **待发布状态值** | 状态为此值时，发布中心检查远程内容，判断是未发布还是有改动 | `ongoing` |
| **已发布状态值** | 状态为此值时，跳过远程检查，直接显示为已发布 | `done` |

frontmatter 写法（默认属性名 `status`）：

```yaml
---
pub-blog: true
status: ongoing    # 发布中心会检查是否有改动
---
```

```yaml
---
pub-blog: true
status: done       # 跳过检查，显示为已发布，小修改不触发重新发布
---
```

如果自定义属性名（比如改为 `publish-state`）：

```yaml
---
pub-blog: true
publish-state: ongoing
---
```

`pub-blog: true` 始终是发布的前提。状态字段只影响发布中心的状态分类，不影响发布命令的执行。

未启用时，发布中心使用硬编码的 `status` 属性、`🟡 Ongoing` / `🟢 Done` 值判断状态，行为与之前一致。

#### 高级

| 设置项 | 说明 |
|--------|------|
| **启用调试日志** | 开启后在开发者控制台（`Ctrl/Cmd + Shift + I`）显示详细日志，用于排查问题。日常使用不需要开启 |

### 命令列表

| 命令 | 说明 |
|------|------|
| 快速发布并分享 | 自动添加 `pub-blog: true` 标记，发布笔记，然后把笔记 URL 复制到剪贴板 |
| 发布当前笔记 | 发布当前打开的笔记 |
| 发布所有标记的笔记 | 批量发布所有 `pub-blog: true` 的笔记，同时删除已取消标记的笔记和图片 |
| 复制笔记 URL | 把已发布笔记的 URL 复制到剪贴板 |
| 打开发布中心 | 打开可视化发布管理界面 |
| 添加发布标记 | 在当前笔记 frontmatter 中添加 `pub-blog: true` |
| 移除发布标记 | 从当前笔记 frontmatter 中移除 `pub-blog` |
| 切换发布状态 | 切换 `pub-blog` 的开/关状态 |

### 发布中心

发布中心是一个可视化界面，让你集中管理发布状态：

- **已发布笔记**：列出所有已发布到仓库的笔记
- **有改动的笔记**：本地有修改但还未重新发布的笔记，支持查看 diff
- **待发布笔记**：标记了 `pub-blog: true` 但尚未发布的笔记
- **已删除笔记**：之前发布过但已移除标记的笔记，发布时会从仓库中删除

点击左侧栏的图标或运行"打开发布中心"命令即可打开。

### 发布工作流

整个发布流程：

1. 在笔记 frontmatter 中标记 `pub-blog: true`
2. 运行发布命令
3. 插件编译笔记内容（处理链接、嵌入、图片等）
4. 通过 GitHub API 把笔记和图片推送到你的仓库
5. 如果你的仓库配了 `on: push` 的 GitHub Actions 工作流，push 后自动触发部署

不需要单独配置部署触发——git push 本身就会触发仓库的 `on: push` 工作流。

### 技术栈

- TypeScript + Svelte
- esbuild 构建
- Jest 测试
- ESLint + Prettier 代码规范

---

## English Documentation

### What is this

Blog Publisher lets you publish Obsidian notes directly to a GitHub repository. Add `pub-blog: true` to a note's frontmatter, run the publish command, and the note is pushed to your configured repo. If your blog repo has a GitHub Actions deployment workflow, the blog updates automatically on push.

Ideal for anyone already using GitHub Pages / Vercel / Netlify — your Obsidian vault becomes the content source for your blog.

### Features

**Publishing**
- Single publish: Publish the current note to your GitHub repo
- Batch publish: Publish all notes marked with `pub-blog: true` at once
- Quick publish & share: Publish and copy the note URL to clipboard in one action
- Publication Center: Visual dashboard for managing published, changed, and pending notes

**Content Support**
- Basic Markdown syntax
- Note links (`[[wikilinks]]`)
- Dataview queries (code blocks, inline, DataviewJS)
- Canvas files
- Note embeds / transclusions (`![[embed]]`)
- Excalidraw embeds
- Image embeds (auto-upload to configured repo path)
- PDF embeds (max 20MB, inline rendering)
- Callouts / Admonitions
- Code blocks
- MathJax math formulas
- Highlighted text (`==highlight==`)
- Footnotes
- Mermaid diagrams
- PlantUML diagrams

**Image Handling**
- Images in notes are automatically uploaded to your configured repo path
- Unchanged images are skipped via hash comparison (no redundant uploads)
- Image links are rewritten to your configured URL prefix

**Frontmatter Handling**
- All frontmatter fields are passed through on publish (`title`, `description`, `publishDate`, etc.)
- Published YAML uses standard format (not JSON)
- Permalink is auto-generated and written to frontmatter
- `blog-path` field is auto-written (the note's path in the blog repo)

**Status Tracking** (optional)
- Works on top of `pub-blog: true` — uses the `status` frontmatter field to control Publication Center categorization
- `status: ongoing` (configurable) → Publication Center checks remote content, shows as unpublished or changed
- `status: done` (configurable) → skips remote check, shows as published directly
- Useful for minor edits where re-publishing isn't needed
- When disabled, hardcoded status values (`🟡 Ongoing` / `🟢 Done`) are used

**Privacy**
- Only notes marked with `pub-blog: true` are published
- Linked notes are never auto-published — you control what goes public
- Private notes stay private

### Quick Start

#### Prerequisites

1. A GitHub account
2. A GitHub repository to host your blog content
3. The repo should have a deployment workflow (e.g., GitHub Actions) configured with `on: push`

#### Setup

**Step 1: Create a GitHub Access Token**

1. Visit [Fine-grained token settings](https://github.com/settings/personal-access-tokens/new)
2. Configure:
   - **Resource owner**: yourself
   - **Repository access**: "Only select repositories" → select your blog repo
   - **Permissions**:
     - `Contents` → `Read and write` (required)
     - `Actions` → `Read and write` (optional, if triggering deploy workflows)
3. Generate and copy the token

**Step 2: Install and configure the plugin**

1. Install Blog Publisher from Obsidian's community plugins
2. Open the plugin settings (Settings → Blog Publisher)
3. Fill in the GitHub repository settings (see below)
4. The settings page shows a live connection status — a green ✓ means you're good to go

**Step 3: Publish your first note**

1. Add `pub-blog: true` to the note's frontmatter:
   ```yaml
   ---
   pub-blog: true
   title: My First Post
   ---
   ```
2. Open the command palette (`Ctrl/Cmd + P`) and run "Blog Publisher: Publish current note"
3. You'll see a "Note published successfully!" notice when done

### Settings Reference

The settings page has three sections: GitHub Repository, Path Rewriting, and Advanced.

#### GitHub Repository Settings (Required)

These configure your GitHub repository connection. Connection status is checked automatically as you type.

| Setting | Description | Example |
|---------|-------------|---------|
| **Repository name** | Your blog repo name (without username prefix) | `myblog` |
| **GitHub username** | Your GitHub username | `joeytoday` |
| **GitHub Token** | A token with repo read/write access (input is masked) | `github_pat_xxxx...` |
| **Content path** | Where notes are stored in the repo (trailing `/` auto-added) | `src/content/` (default) |
| **Image upload path** | Where images are stored in the repo (trailing `/` auto-added) | `src/site/img/user/` (default) |
| **Image URL prefix** | URL prefix for image links in published Markdown | `/img/user/` (default) |

**How paths work**: If your note is `weekly-01.md` and the content path is `src/content/`, the file will appear at `src/content/weekly-01.md` in the repo. Images work the same way — `![[screenshot.png]]` in a note gets uploaded to `src/site/img/user/screenshot.png`, and the published Markdown references it as `![](/img/user/screenshot.png)`.

#### Path Rewriting

Path rewrite rules let you map your Obsidian folder structure to a different structure in the blog repo.

| Setting | Description |
|---------|-------------|
| **Path rewrite rules** | One rule per line, format: `source-path:target-path` |

**Example**:

If your vault uses a PARA structure but your blog organizes by topic:

```
1-projects/blog/:blog/
1-projects/worknotes/:worknotes/
notes/PARA系统.md:notes/PARA系统.md
```

Result:
- `1-projects/blog/2026/weekly-01.md` → published to `blog/2026/weekly-01.md`
- `1-projects/worknotes/2026/note.md` → published to `worknotes/2026/note.md`
- Notes not matching any rule keep their original path

Tip: Leave the target path empty (e.g., `old-folder:`) to map to the repo root.

#### Status Tracking

Status tracking lets you use a frontmatter status field to control how the Publication Center categorizes notes. On top of `pub-blog: true`, the status field determines whether the Publication Center checks remote content.

Core use case: made a minor edit (e.g., fixed a typo) and don't want to re-publish. Set the status to the published value, and the Publication Center won't flag it as changed.

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable status tracking** | Toggle. When on, uses configurable status values instead of hardcoded `🟡 Ongoing` / `🟢 Done` | Off |
| **Status field name** | The frontmatter property name used for status tracking | `status` |
| **Track status value** | Notes with this status value are checked against remote content for changes | `ongoing` |
| **Published status value** | Notes with this status value skip the remote check and show as published | `done` |

Frontmatter usage (default field name `status`):

```yaml
---
pub-blog: true
status: ongoing    # Publication Center checks for changes
---
```

```yaml
---
pub-blog: true
status: done       # Skips check, shows as published — minor edits won't trigger re-publish
---
```

With a custom field name (e.g., `publish-state`):

```yaml
---
pub-blog: true
publish-state: ongoing
---
```

`pub-blog: true` is always required. The status field only affects Publication Center categorization, not the publish commands themselves.

When disabled, the Publication Center uses the hardcoded `status` field with `🟡 Ongoing` / `🟢 Done` values, same as before.

#### Advanced

| Setting | Description |
|---------|-------------|
| **Enable debug logging** | Shows detailed logs in the developer console (`Ctrl/Cmd + Shift + I`). Not needed for daily use |

### Commands

| Command | Description |
|---------|-------------|
| Quick publish and share | Adds `pub-blog: true`, publishes the note, and copies its URL to clipboard |
| Publish current note | Publishes the active note |
| Publish all marked notes | Batch publishes all notes with `pub-blog: true`; also removes deleted notes and images from the repo |
| Copy note URL | Copies the published note's URL to clipboard |
| Open Publication Center | Opens the visual publication management view |
| Add publish mark | Adds `pub-blog: true` to the current note's frontmatter |
| Remove publish mark | Removes `pub-blog` from the current note's frontmatter |
| Toggle publish status | Toggles `pub-blog` on/off |

### Publication Center

The Publication Center is a visual dashboard for managing your publishing status:

- **Published notes**: All notes already published to the repo
- **Changed notes**: Notes with local modifications not yet re-published (supports diff view)
- **Pending notes**: Notes marked with `pub-blog: true` but not yet published
- **Deleted notes**: Previously published notes that no longer have the mark — these are removed from the repo on next publish

Open it via the ribbon icon or the "Open Publication Center" command.

### Publishing Workflow

The full flow:

1. Mark a note with `pub-blog: true` in frontmatter
2. Run a publish command
3. The plugin compiles the note content (resolving links, embeds, images, etc.)
4. Notes and images are pushed to your GitHub repo via the GitHub API
5. If your repo has a `on: push` GitHub Actions workflow, deployment triggers automatically

No separate deploy trigger setting is needed — git push itself triggers the repo's `on: push` workflow.

### Tech Stack

- TypeScript + Svelte
- esbuild for building
- Jest for testing
- ESLint + Prettier for code quality

## License

MIT License
