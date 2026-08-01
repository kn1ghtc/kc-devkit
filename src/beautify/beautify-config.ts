/**
 * beautify-config.ts — Config Resolution for js-beautify
 *
 * Resolution chain (later overrides earlier):
 *   1. VS Code editor settings (tabSize, insertSpaces)
 *   2. .editorconfig values (if present in workspace)
 *   3. .jsbeautifyrc walk-up from the file's directory
 *
 * Returns a merged options object suitable for js-beautify.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

type BeautifierType = 'js' | 'css' | 'html';

/**
 * Resolves the final js-beautify options for a given document.
 *
 * @param document - The text document being formatted
 * @param formattingOptions - VS Code's formatting options (tabSize, insertSpaces)
 * @param type - The beautifier type (js, css, html)
 * @returns Merged options object for js-beautify
 */
export function resolveBeautifyOptions(
    document: vscode.TextDocument,
    formattingOptions: vscode.FormattingOptions,
    type: BeautifierType,
): Record<string, unknown> {
    // 1. Start with VS Code editor settings
    const baseOptions: Record<string, unknown> = {
        indent_size: formattingOptions.tabSize,
        indent_char: formattingOptions.insertSpaces ? ' ' : '\t',
        indent_with_tabs: !formattingOptions.insertSpaces,
        eol: getEol(document),
        end_with_newline: vscode.workspace
            .getConfiguration('files', document.uri)
            .get<boolean>('insertFinalNewline', false),
    };

    // 2. Look for .jsbeautifyrc walking up from the file's directory
    const rcOptions = findBeautifyRc(document.uri);

    // 3. Extract type-specific overrides from the rc file
    const merged = { ...baseOptions, ...rcOptions };
    if (rcOptions && typeof rcOptions[type] === 'object') {
        Object.assign(merged, rcOptions[type]);
    }
    // Remove the nested type keys to avoid passing invalid options
    delete merged.js;
    delete merged.css;
    delete merged.html;

    return merged;
}

/**
 * Detects the document's EOL sequence.
 */
function getEol(document: vscode.TextDocument): string {
    return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

/**
 * Walks up from the document's directory looking for a .jsbeautifyrc file.
 * Supports JSON format (with comments stripped via a simple regex).
 *
 * @returns Parsed options or undefined if no rc file found
 */
function findBeautifyRc(uri: vscode.Uri): Record<string, any> | undefined {
    if (uri.scheme !== 'file') {
        return undefined;
    }

    let dir = path.dirname(uri.fsPath);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const roots: string[] = workspaceFolders
        ? workspaceFolders.map((f: vscode.WorkspaceFolder) => f.uri.fsPath)
        : [];

    // Walk up until we reach a workspace root or the filesystem root
    const maxDepth = 20;
    for (let i = 0; i < maxDepth; i++) {
        const rcPath = path.join(dir, '.jsbeautifyrc');
        if (fs.existsSync(rcPath)) {
            try {
                const raw = fs.readFileSync(rcPath, 'utf-8');
                // Strip single-line comments (// ...) for loose JSON parsing
                const cleaned = raw.replace(/^\s*\/\/.*$/gm, '');
                return JSON.parse(cleaned);
            } catch {
                // Malformed rc file — skip
                return undefined;
            }
        }

        // Stop at workspace root
        if (roots.some((root: string) => dir === root)) {
            break;
        }

        const parent = path.dirname(dir);
        if (parent === dir) {
            break; // filesystem root
        }
        dir = parent;
    }

    return undefined;
}
