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
| `KC DevKit: Beautify File` | Format entire document | `Ctrl+Shift+B` |
| `KC DevKit: Beautify Selection` | Format selected text | — |
| `KC DevKit: Clean Pycache` | Remove `__pycache__` directories | — |
| `KC DevKit: Run SageMath File` | Execute current `.sage` file | `F5` (sage files) |

---

## Configuration

All settings are under `kcDevKit.*` in VS Code settings.

### Markdown

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.markdown.enabled` | `true` | Enable Markdown Ultra preview |
| `kcDevKit.markdown.katex` | `true` | Enable KaTeX math rendering |
| `kcDevKit.markdown.mermaid` | `true` | Enable Mermaid diagram rendering |
| `kcDevKit.markdown.lineNumbers` | `true` | Enable code block line numbers |
| `kcDevKit.markdown.toc` | `true` | Enable TOC sidebar tree view |

### Beautify

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.beautify.enabled` | `true` | Enable code beautifier |
| `kcDevKit.beautify.language` | `{}` | Language → file pattern mapping |
| `kcDevKit.beautify.ignore` | `[]` | Glob patterns to exclude from formatting |

### Pycache

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.pycache.enabled` | `true` | Enable pycache cleaner |
| `kcDevKit.pycache.autoCleanOnOpen` | `false` | Auto-clean when workspace opens |

### SageMath

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.sage.enabled` | `true` | Enable SageMath support |
| `kcDevKit.sage.path` | `"sage"` | Path to Sage executable |
| `kcDevKit.sage.useWSL` | `false` | Run Sage through WSL on Windows |
| `kcDevKit.sage.autoDeleteSagePy` | `true` | Delete `.sage.py` after execution |

---

## Getting Started

### Install from VSIX

```bash
code --install-extension kc-devkit-1.0.0.vsix
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
