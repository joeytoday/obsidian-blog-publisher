# Obsidian Blog Publisher

Publish Obsidian notes to any GitHub-hosted blog repository.

> Based on [Obsidian Digital Garden](https://github.com/oleeskild/obsidian-digital-garden).

## Features

### Content Support
- Basic Markdown syntax
- Note links
- Dataview queries (code blocks, inline, and DataviewJS)
- Canvas
- Note embeds/transclusions
- Excalidraw embeds
- Image embeds (auto-upload to configured path)
- PDF embeds (max 20MB, inline rendering)
- Callouts/Admonitions
- Code blocks
- MathJax math formulas
- Highlighted text
- Footnotes
- Mermaid diagrams
- PlantUML diagrams

### Publishing
- **Single publish** — Publish the current note to a GitHub repository
- **Batch publish** — Publish all marked notes at once
- **Publication Center** — Visual management of published and pending notes
- **Auto image upload** — Images in notes are automatically uploaded to the configured repository path
- **Auto deploy trigger** — Optionally trigger a GitHub Actions workflow after publishing
- **Path rewriting** — Customize note and image publish paths
- **Permalink generation** — Automatically write permalink to frontmatter on publish

### Privacy
- **Selective publishing** — Only notes marked with `pub-blog: true` are published
- **No accidental leaks** — Linked notes are not automatically published
- **Full control** — Private notes stay private

## Quick Start

### Prerequisites
1. A GitHub account
2. A GitHub repository to host your blog content

### Setup

1. **Create a GitHub Access Token**
   - Visit [Fine-grained token settings](https://github.com/settings/personal-access-tokens/new)
   - Configure permissions:
     - Resource owner: yourself
     - Select only your blog repository
     - Permissions:
       - Contents: `Read and write`
       - Actions: `Read and write` (if using workflow trigger)
   - Generate and copy the token

2. **Configure the plugin**
   - Find "Blog Publisher" in Obsidian settings
   - Fill in:
     - GitHub username
     - Repository name
     - Access token
     - Content path (default: `src/content/`)
     - Image upload path (default: `src/site/img/user/`)
     - Image URL prefix (default: `/img/user/`)
     - Deploy workflow filename (e.g., `deploy.yml`, leave empty to skip)

3. **Publish a note**
   - Add to the note's frontmatter:
   ```yaml
   ---
   pub-blog: true
   ---
   ```
   - Run "Blog Publisher: Publish current note" from the command palette

## Commands

| Command | Description |
|---------|-------------|
| Quick publish and share | Publish note and copy link to clipboard |
| Publish current note | Publish the active note |
| Publish all marked notes | Batch publish all notes with `pub-blog: true` |
| Copy note URL | Copy the published note's URL |
| Open Publication Center | Open the publication management view |
| Add publish mark | Add `pub-blog: true` to current note |
| Remove publish mark | Remove `pub-blog` from current note |
| Toggle publish status | Toggle `pub-blog` mark on/off |

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
npm run format
```

## Tech Stack

- **Framework**: Obsidian Plugin
- **Language**: TypeScript, Svelte
- **Build**: esbuild
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier, Husky

## License

MIT License
