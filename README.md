# KC DevKit

> Comprehensive VS Code developer toolkit: Enhanced Markdown preview, code formatting, Python cache cleaner, and SageMath support.

![Version](https://img.shields.io/visual-studio-marketplace/v/kn1ghtc.kc-devkit)
![License](https://img.shields.io/github/license/kn1ghtc/kc-devkit)

---

## Features

### 📐 Markdown Ultra Preview

Enhanced Markdown preview with math, diagrams, line numbers, and TOC navigation.

| Feature | Description |
|---------|-------------|
| **KaTeX Math** | Server-side LaTeX rendering — `$inline$` and `$$block$$` |
| **Mermaid Diagrams** | Flowcharts, sequence diagrams, Gantt charts in fenced code blocks |
| **Line Numbers** | Automatic line numbering for all fenced code blocks |
| **Table of Contents** | Sidebar tree view with click-to-reveal navigation |

### 🎨 Code Beautify

Multi-language formatting powered by `js-beautify`.

- **Languages**: JavaScript, TypeScript, JSON, JSONC, CSS, SCSS, LESS, HTML
- **Config Chain**: VS Code settings → `.jsbeautifyrc` (directory walk-up)
- **Commands**: Format Document, Format Selection
- **Schema**: JSON schema validation for `.jsbeautifyrc` files

### 🧹 Pycache Cleaner

One-click cleanup of Python cache artifacts.

- Recursive `__pycache__/` directory removal
- `.pyc` / `.pyo` file deletion
- Optional auto-clean on workspace open
- Status bar feedback with directory count

### 🔮 SageMath Support

Full IDE support for SageMath mathematical software.

- **Syntax Highlighting**: 120+ SageMath builtins, rings, plotting, algebra, crypto
- **28 Snippets**: Common patterns — polynomial rings, matrices, EC curves, plots
- **Run .sage Files**: Execute via terminal with configurable Sage path
- **WSL Integration**: Auto-detect and route to WSL Sage on Windows
- **Auto-cleanup**: Optional deletion of `.sage.py` intermediary files

---

## Commands

| Command | Description | Keybinding |
|---------|-------------|------------|
| `KC DevKit: Refresh TOC` | Refresh Markdown TOC sidebar | — |
| `KC DevKit: Beautify File` | Format entire document | — |
| `KC DevKit: Beautify Selection` | Format selected text | — |
| `KC DevKit: Clean Pycache` | Remove `__pycache__` directories | `Ctrl+Shift+P Ctrl+Shift+C` |
| `KC DevKit: Run SageMath File` | Execute current `.sage` file | — |

---

## Configuration

All settings are under `kcDevKit.*` in VS Code settings.

### Markdown

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.markdown.enabled` | `true` | Enable Markdown Ultra features (KaTeX, Mermaid, TOC, line numbers) |

### Beautify

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.beautify.enabled` | `true` | Enable code beautifier |
| `kcDevKit.beautify.language` | `{js:{...},css:{...},html:{...}}` | Language → beautifier type mapping |
| `kcDevKit.beautify.ignore` | `[]` | Glob patterns to exclude from formatting |

### Pycache

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.pycache.enabled` | `true` | Enable pycache cleaner |
| `kcDevKit.pycache.autoCleanOnOpen` | `false` | Auto-clean when workspace opens |
| `kcDevKit.pycache.exclude` | `["**/node_modules/**",...]` | Glob patterns to exclude from cleanup |

### SageMath

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.sagemath.enabled` | `true` | Enable SageMath support |
| `kcDevKit.sagemath.interpreterPath` | `"sage"` | Path to Sage executable |
| `kcDevKit.sagemath.useWSL` | `false` | Run Sage through WSL on Windows |
| `kcDevKit.sagemath.autoDeleteGenerated` | `false` | Delete `.sage.py` after execution |

---

## Getting Started

### Install from Marketplace

Search **"KC DevKit"** in the VS Code Extensions panel, or run:

```bash
code --install-extension kn1ghtc.kc-devkit
```

### Build from Source

```powershell
git clone https://github.com/kn1ghtc/kc-devkit.git
cd kc-devkit
npm install
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

### Package & Deploy

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

Set `AZURE_PAT` in `.env` to publish to the VS Code Marketplace.

---

## Requirements

- VS Code ≥ 1.80.0
- Node.js ≥ 18 (for building)
- SageMath (optional, for `.sage` file execution)
- WSL (optional, for SageMath on Windows)

---

## License

MIT © [kn1ghtc](https://github.com/kn1ghtc)
