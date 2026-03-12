# 📝 Obsidian Blog Publisher

个人使用的 Obsidian 博客发布插件。基于 [Obsidian Digital Garden](https://github.com/oleeskild/obsidian-digital-garden) 修改而来。

> ⚠️ **仅供个人使用** — 此插件为个人博客发布工作流定制，不对外公开维护。

## 功能特性

### 📝 内容支持
- 基础 Markdown 语法
- 笔记间链接
- Dataview 查询（代码块、行内和 DataviewJS）
- Canvas
- 笔记嵌入/引用
- Excalidraw 绘图嵌入
- 图片嵌入
- PDF 嵌入（最大 20MB，内联渲染）
- Callouts/Admonitions
- 代码块
- MathJax 数学公式
- 高亮文本
- 脚注
- Mermaid 图表
- PlantUML 图表

### 🧭 导航与发现
- 实时搜索预览
- 文件树导航
- 反向链接
- 局部关系图
- 全局关系图
- 目录
- 悬停链接预览

### 🎨 自定义
- Obsidian 主题支持
- Style Settings 插件支持
- CSS 变量自定义样式
- 自定义过滤器（基于正则的内容转换）
- 笔记图标
- 时间戳（创建/更新）
- 自定义 UI 文本

### 🔒 隐私控制
- **选择性发布** — 仅明确标记 `dg-publish: true` 的笔记会被发布
- **无意外泄露** — 链接的笔记不会自动发布
- **完全控制** — 私有笔记保持私有

## 快速开始

### 前置要求
1. GitHub 账号
2. Vercel 账号（或其他托管平台）

### 设置步骤

1. **部署网站模板**
   - 访问 [digitalgarden 仓库](https://github.com/oleeskild/digitalgarden)
   - 点击 "Deploy to Vercel" 按钮
   - 按提示完成部署

2. **创建 GitHub Access Token**
   - 访问 [Fine-grained token 设置页](https://github.com/settings/personal-access-tokens/new)
   - 配置权限：
     - Resource owner: 自己
     - 仅选择你的花园仓库
     - Permissions:
       - Contents: `Read and write`
       - Pull requests: `Read and write`
   - 生成并复制 Token

3. **配置插件**
   - 在 Obsidian 设置中找到 "Blog Publisher"
   - 填写：
     - GitHub 用户名
     - 仓库名称
     - Access Token

4. **发布笔记**
   - 在笔记 Frontmatter 中添加：
   ```yaml
   ---
   dg-publish: true
   ---
   ```
   - 使用命令面板执行 "Blog Publisher: Publish Single Note"

## 本地开发

```bash
# 克隆仓库
git clone <repository-url>

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

## 可用命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 开发模式构建 |
| `npm run build` | 生产环境构建 |
| `npm test` | 运行测试 |
| `npm run lint` | 代码检查 |
| `npm run lint-fix` | 自动修复代码问题 |
| `npm run format` | 格式化代码 |
| `npm run typecheck` | TypeScript 类型检查 |

## 技术栈

- **框架**: Obsidian Plugin
- **语言**: TypeScript, Svelte
- **构建**: esbuild
- **测试**: Jest
- **代码质量**: ESLint, Prettier, Husky

## 许可证

MIT License

---

**注意**: 此插件为个人定制版本，基于 [Obsidian Digital Garden](https://github.com/oleeskild/obsidian-digital-garden) 修改。如需通用版本，请参考原项目。
