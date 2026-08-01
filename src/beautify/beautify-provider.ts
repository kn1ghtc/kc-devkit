/**
 * beautify-provider.ts — Code Formatting Provider
 *
 * Registers DocumentFormattingEditProvider and DocumentRangeFormattingEditProvider
 * for JS/JSON/CSS/SCSS/HTML using the js-beautify library.
 *
 * Config resolution order:
 *   VS Code editor settings → .editorconfig → .jsbeautifyrc walk-up → kcDevKit settings
 */

import * as vscode from 'vscode';
import { resolveBeautifyOptions } from './beautify-config';

type BeautifierType = 'js' | 'css' | 'html';

/**
 * Resolves the beautifier type for a given language ID using the
 * `kcDevKit.beautify.language` configuration.
 */
function getBeautifierType(languageId: string): BeautifierType | undefined {
    const config = vscode.workspace
        .getConfiguration('kcDevKit.beautify')
        .get<Record<string, { type: string[] }>>('language');

    if (!config) {
        return undefined;
    }

    for (const [type, entry] of Object.entries(config)) {
        const e = entry as { type?: string[] };
        if (e.type && e.type.includes(languageId)) {
            return type as BeautifierType;
        }
    }
    return undefined;
}

/**
 * Formats text using the appropriate js-beautify function.
 */
function beautify(text: string, type: BeautifierType, options: Record<string, unknown>): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jsBeautify = require('js-beautify');

    switch (type) {
        case 'js':
            return jsBeautify.js(text, options);
        case 'css':
            return jsBeautify.css(text, options);
        case 'html':
            return jsBeautify.html(text, options);
        default:
            return text;
    }
}

/**
 * Checks if a file should be ignored based on `kcDevKit.beautify.ignore` glob patterns.
 */
function shouldIgnore(uri: vscode.Uri): boolean {
    const patterns = vscode.workspace
        .getConfiguration('kcDevKit.beautify')
        .get<string[]>('ignore', []);

    if (patterns.length === 0) {
        return false;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);

    for (const pattern of patterns) {
        // Simple glob matching via VS Code's minimatch-compatible RelativePattern
        const re = globToRegExp(pattern);
        if (re.test(relativePath)) {
            return true;
        }
    }
    return false;
}

/**
 * Converts a simple glob pattern to a RegExp.
 * Supports `*`, `**`, and `?` wildcards.
 */
function globToRegExp(glob: string): RegExp {
    let re = glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLESTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLESTAR__/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${re}$`);
}

/**
 * Creates a full-document formatting edit from the beautified text.
 */
function formatDocument(
    document: vscode.TextDocument,
    type: BeautifierType,
    options: Record<string, unknown>,
): vscode.TextEdit[] {
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
    );

    const formatted = beautify(document.getText(), type, options);
    return [vscode.TextEdit.replace(fullRange, formatted)];
}

/**
 * Creates a range formatting edit from the beautified selection.
 */
function formatRange(
    document: vscode.TextDocument,
    range: vscode.Range,
    type: BeautifierType,
    options: Record<string, unknown>,
): vscode.TextEdit[] {
    const text = document.getText(range);
    const formatted = beautify(text, type, options);
    return [vscode.TextEdit.replace(range, formatted)];
}

/**
 * Registers formatting providers and commands for all supported languages.
 */
export function registerBeautifyProviders(context: vscode.ExtensionContext): void {
    // Collect all language IDs from the beautify.language config
    const config = vscode.workspace
        .getConfiguration('kcDevKit.beautify')
        .get<Record<string, { type: string[] }>>('language');

    const allLanguages: string[] = [];
    if (config) {
        for (const entry of Object.values(config)) {
            const e = entry as { type?: string[] };
            if (e.type) {
                allLanguages.push(...e.type);
            }
        }
    }

    // Build document selectors
    const selectors: vscode.DocumentSelector = allLanguages.map((lang) => ({
        language: lang,
        scheme: 'file',
    }));

    // Register full-document formatter
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(selectors, {
            provideDocumentFormattingEdits(
                document: vscode.TextDocument,
                formattingOptions: vscode.FormattingOptions,
            ): vscode.TextEdit[] {
                if (shouldIgnore(document.uri)) {
                    return [];
                }

                const type = getBeautifierType(document.languageId);
                if (!type) {
                    return [];
                }

                const options = resolveBeautifyOptions(document, formattingOptions, type);
                return formatDocument(document, type, options);
            },
        }),
    );

    // Register range formatter
    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(selectors, {
            provideDocumentRangeFormattingEdits(
                document: vscode.TextDocument,
                range: vscode.Range,
                formattingOptions: vscode.FormattingOptions,
            ): vscode.TextEdit[] {
                if (shouldIgnore(document.uri)) {
                    return [];
                }

                const type = getBeautifierType(document.languageId);
                if (!type) {
                    return [];
                }

                const options = resolveBeautifyOptions(document, formattingOptions, type);
                return formatRange(document, range, type, options);
            },
        }),
    );

    // Register explicit commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.beautifyFile', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            vscode.commands.executeCommand('editor.action.formatDocument');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.beautifySelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            vscode.commands.executeCommand('editor.action.formatSelection');
        }),
    );
}
