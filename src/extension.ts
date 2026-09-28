/**
 * KC DevKit — Extension Entry Point (Feature Orchestrator)
 *
 * Activates 7 independent feature modules based on user settings:
 * 1. Markdown Ultra  — KaTeX, Mermaid, TOC, code line numbers
 * 2. Code Beautify   — JS/JSON/CSS/SCSS/HTML formatting via js-beautify
 * 3. Pycache Cleaner — Recursive __pycache__ and .pyc deletion
 * 4. SageMath        — Run .sage files, syntax highlighting, snippets
 * 5. PDF Preview     — pdf.js canvas custom editor (CJK cmaps + standard fonts)
 * 6. Excel Preview   — xlsx/xls/csv custom editor (ExcelJS + SheetJS, freeze/wrap)
 * 7. PPT Preview     — ppt/pptx slide rendering (OOXML; legacy ppt via PowerPoint)
 *
 * Each module is isolated: a failure in one does not crash others.
 */

import * as vscode from 'vscode';

import { katexPlugin } from './markdown/markdown-it-katex';
import { mermaidPlugin } from './markdown/markdown-it-mermaid';
import { lineNumberPlugin } from './markdown/markdown-it-line-number';
import { TocProvider } from './markdown/toc-provider';
import { registerBeautifyProviders } from './beautify/beautify-provider';
import { activatePycacheCleaner } from './pycache/pycache-cleaner';
import { activateSageMath } from './sagemath/sage-runner';
import { activatePdfPreview } from './pdf/activate';
import { activateExcelPreview } from './excel/activate';
import { activatePptPreview } from './ppt/activate';

/** Helper: read a boolean setting with fallback. */
function isModuleEnabled(module: string): boolean {
    return vscode.workspace
        .getConfiguration('kcDevKit')
        .get<boolean>(`${module}.enabled`, true);
}

/**
 * Extension activation — called by VS Code when any activationEvent fires.
 * Returns the `extendMarkdownIt` function required for markdown plugin injection.
 */
export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('KC DevKit');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('KC DevKit activating...');

    // ── Module 1: Markdown Ultra ────────────────────────────────
    let tocProvider: TocProvider | undefined;
    if (isModuleEnabled('markdown')) {
        try {
            tocProvider = new TocProvider();
            const treeView = vscode.window.createTreeView('kcDevKitToc', {
                treeDataProvider: tocProvider,
                showCollapseAll: true,
            });
            context.subscriptions.push(treeView);
            context.subscriptions.push(tocProvider);

            context.subscriptions.push(
                vscode.commands.registerCommand('kcDevKit.refreshToc', () => {
                    tocProvider?.refresh();
                }),
            );

            outputChannel.appendLine('  ✓ Markdown Ultra module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ Markdown Ultra failed: ${err}`);
        }
    }

    // ── Module 2: Code Beautify ─────────────────────────────────
    if (isModuleEnabled('beautify')) {
        try {
            registerBeautifyProviders(context);
            outputChannel.appendLine('  ✓ Code Beautify module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ Code Beautify failed: ${err}`);
        }
    }

    // ── Module 3: Pycache Cleaner ───────────────────────────────
    if (isModuleEnabled('pycache')) {
        try {
            activatePycacheCleaner(context);
            outputChannel.appendLine('  ✓ Pycache Cleaner module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ Pycache Cleaner failed: ${err}`);
        }
    }

    // ── Module 4: SageMath ──────────────────────────────────────
    if (isModuleEnabled('sagemath')) {
        try {
            activateSageMath(context);
            outputChannel.appendLine('  ✓ SageMath module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ SageMath failed: ${err}`);
        }
    }

    // ── Module 5: PDF Preview ───────────────────────────────────
    if (isModuleEnabled('pdf')) {
        try {
            activatePdfPreview(context, outputChannel);
            outputChannel.appendLine('  ✓ PDF Preview module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ PDF Preview failed: ${err}`);
        }
    }

    // ── Module 6: Excel Preview ─────────────────────────────────
    if (isModuleEnabled('excel')) {
        try {
            activateExcelPreview(context, outputChannel);
            outputChannel.appendLine('  ✓ Excel Preview module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ Excel Preview failed: ${err}`);
        }
    }

    if (isModuleEnabled('ppt')) {
        try {
            activatePptPreview(context, outputChannel);
            outputChannel.appendLine('  ✓ PPT Preview module loaded');
        } catch (err) {
            outputChannel.appendLine(`  ✗ PPT Preview failed: ${err}`);
        }
    }

    outputChannel.appendLine('KC DevKit activated.');

    // Return the markdown-it plugin extension point.
    // VS Code calls extendMarkdownIt(md) for every preview instance.
    return {
        extendMarkdownIt(md: any) {
            if (isModuleEnabled('markdown')) {
                katexPlugin(md);
                mermaidPlugin(md);
                lineNumberPlugin(md);
            }
            return md;
        },
    };
}

/** Called when the extension is deactivated. */
export function deactivate(): void {
    // Cleanup handled by context.subscriptions
}
