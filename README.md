# KC DevKit

> Comprehensive VS Code / Cursor developer toolkit: Enhanced Markdown preview, PDF preview (CJK + math fonts), Excel/CSV preview, code formatting, Python cache cleaner, and SageMath support.

![Version](https://img.shields.io/visual-studio-marketplace/v/kn1ghtc.kc-devkit)
![License](https://img.shields.io/github/license/kn1ghtc/kc-devkit)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/kn1ghtc)

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

### 📄 PDF Preview (CJK + math fonts)

Custom editor powered by **pdf.js** (canvas glyph rendering — not a text-layer-only viewer).

- **CJK**: packed `cmaps` so Chinese/Japanese/Korean glyphs paint correctly
- **Math / Type1**: `standard_fonts` for embedded-standard and math fonts
- Toolbar: prev/next, zoom +/−, fit-width, fit-page, page indicator
- Keyboard: `PageUp` / `PageDown`, `+` / `−`
- Large files: only nearby pages (viewport ±1) keep canvases; offscreen canvases are destroyed
- Reloads when the PDF file changes on disk
- Errors (missing file, encrypted PDF, invalid PDF, worker failure) show in the webview and the **KC DevKit** output channel

`*.pdf` is associated with `kcDevKit.pdfPreview` by default (`workbench.editorAssociations`).

### 📊 Excel / CSV Preview

Custom **read-only** editor so Cursor can open `.xlsx` / `.xlsm` / `.xls` / `.csv` instead of showing a binary/hex dump.

- **xlsx/xlsm**: [ExcelJS](https://github.com/exceljs/exceljs) (MIT) — multiple sheets, freeze panes, column widths, wrap text, fills, cached formula values
- **xls**: [SheetJS Community 0.18.5](https://github.com/SheetJS/sheetjs) (Apache-2.0)
- **csv**: UTF-8 / UTF-16LE with RFC 4180-style quotes
- Toolbar search filters rows; sheet tabs at the bottom; formula cells show cached results with the formula in the tooltip
- Files are **not rewritten** on preview, so COUNTIF/SUM, yellow input cells, and data validation stay intact

`*.xlsx` / `*.xlsm` / `*.xls` / `*.csv` associate with `kcDevKit.excelPreview` by default. Use **Open With…** to switch back to the text editor for CSV.

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
| `KC DevKit: Open PDF Preview` | Open current PDF (or file picker) in the custom preview | — |
| `KC DevKit: Open Excel Preview` | Open current spreadsheet (or file picker) in the custom preview | — |
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

### PDF Preview

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.pdf.enabled` | `true` | Enable PDF preview custom editor |
| `kcDevKit.pdf.defaultScale` | `"page-width"` | `page-width`, `page-fit`, or a numeric scale such as `"1.25"` |

### Excel Preview

| Setting | Default | Description |
|---------|---------|-------------|
| `kcDevKit.excel.enabled` | `true` | Enable Excel/CSV preview custom editor |

---

## Getting Started

### Install from Marketplace

Search **"KC DevKit"** in the VS Code Extensions panel, or run:

```bash
code --install-extension kn1ghtc.kc-devkit
```

### Install in Cursor

Prefer the repo deploy script (finds `cursor.cmd` / `Cursor.exe`, falls back to unzipping the VSIX):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

Or, if the Cursor CLI is on PATH:

```bash
cursor --install-extension .\kc-devkit-1.3.0.vsix --force
```

After install, reload the window: **Developer: Reload Window**.

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

Local deploy never publishes. To also push to the VS Code Marketplace:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Publish
```

Requires `AZURE_PAT` in `.env` (walk-up discovery) for the VS Code Marketplace, and `OPENVSX_TOKEN` (or `OVSX_PAT`) for Open VSX / Cursor.

PDF smoke test (CJK text + optional PNG):

```powershell
npm run smoke:pdf
# or: node scripts/smoke-pdf.mjs "D:\path\to\file.pdf"
```

Excel smoke test (sheet names + CJK + formulas + HTML evidence):

```powershell
npm run smoke:excel
# or: node scripts/smoke-excel.mjs "D:\path\to\file.xlsx"
```

---

## Requirements

- VS Code ≥ 1.80.0
- Node.js ≥ 18 (for building)
- SageMath (optional, for `.sage` file execution)
- WSL (optional, for SageMath on Windows)

---

## License

MIT © [kn1ghtc](https://github.com/kn1ghtc)

## Sponsor

Support research via [GitHub Sponsors](https://github.com/sponsors/kn1ghtc): **$10/month** read-only [`kctsb`](https://github.com/kn1ghtc/kctsb), **$50/month** also read-only [`NetPenetration`](https://github.com/kn1ghtc/NetPenetration). Sponsors may appear as avatars; they cannot push. See [SPONSORS.md](SPONSORS.md).
