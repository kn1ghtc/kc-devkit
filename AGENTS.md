# KC DevKit Extension — Development Conventions

## Project Basics

- **Type**: VS Code Extension (TypeScript + esbuild)
- **Version Source of Truth**: `package.json` → `version` field (唯一权威)
- **Build**: `scripts/build.ps1` — npm install + esbuild bundle + asset copy
- **Deploy**: `scripts/deploy.ps1` — build → package VSIX → publish/install
- **Marketplace Auth**: `AZURE_PAT` via `.env` file (walk-up discovery)

## Mandatory Rules

### Changelog Policy

1. **每次发布版本前必须更新 `CHANGELOG.md`**，禁止先发布再补 changelog
2. CHANGELOG 仅保留**最近 5 个版本**，超出时删除最旧条目
3. 格式遵循 [Keep a Changelog](https://keepachangelog.com/)，使用 `## [x.y.z] — YYYY-MM-DD`
4. 变更分类使用: `Added`, `Changed`, `Fixed`, `Fixed (Critical)`, `Removed`, `Improved`

### Version Bump Rules

- Bug fix / CSS / 文案修正 → patch (x.y.Z)
- 新功能 / 行为变更 → minor (x.Y.0)
- 破坏性变更 / 架构重写 → major (X.0.0)

### Publishing Checklist

1. 更新 `package.json` version
2. 更新 `CHANGELOG.md` (新版本条目置顶)
3. 确认 CHANGELOG 不超过 5 个版本条目
4. 运行 `scripts/deploy.ps1` 完成 build + package + publish
5. Git commit & push (message: `release: vX.Y.Z — 简要说明`)

### Code Standards

- TypeScript strict mode, esbuild minify
- Preview scripts: browser platform, IIFE format
- CSS 命名空间使用 `kc-` 前缀避免与 VS Code 内置冲突
- 静态资源变更后必须运行 build 验证输出完整性

### Git Discipline

- 在 `extensions/kc-devkit/` 目录内执行 git 操作
- Commit message: `type: scope — description` (type: feat/fix/refactor/release/docs)
