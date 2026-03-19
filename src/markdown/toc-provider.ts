/**
 * TOC Provider — Markdown Table of Contents TreeView
 *
 * Parses headings from the active Markdown editor, builds a hierarchical
 * tree, and provides navigation commands. Updates are debounced at 300ms.
 */

import * as vscode from 'vscode';

/** Represents a single heading in the TOC tree. */
export class TocItem extends vscode.TreeItem {
    public children: TocItem[] = [];

    constructor(
        public readonly heading: string,
        public readonly level: number,
        public readonly line: number,
        public readonly documentUri: vscode.Uri,
    ) {
        super(heading, vscode.TreeItemCollapsibleState.Expanded);

        this.tooltip = `H${level}: ${heading} (line ${line + 1})`;
        this.description = `H${level}`;
        this.iconPath = new vscode.ThemeIcon('symbol-class');

        this.command = {
            command: 'revealLine',
            title: 'Go to heading',
            arguments: [{ lineNumber: line, at: 'top' }],
        };
    }
}

/**
 * TreeDataProvider for the Markdown Outline view.
 * Parses headings from the active markdown editor and builds
 * a tree reflecting the heading hierarchy (H1 > H2 > H3 ...).
 */
export class TocProvider implements vscode.TreeDataProvider<TocItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<
        TocItem | undefined | null
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private items: TocItem[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() =>
                this.refresh(),
            ),
        );

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                const editor = vscode.window.activeTextEditor;
                if (editor && e.document === editor.document) {
                    this.debouncedRefresh();
                }
            }),
        );

        // Initial parse
        this.refresh();
    }

    /** Immediately refresh the TOC tree. */
    refresh(): void {
        this.items = this.parseHeadings();
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TocItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TocItem): TocItem[] {
        if (!element) {
            return this.items;
        }
        return element.children;
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    /** Debounced refresh — waits 300ms after the last change event. */
    private debouncedRefresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => this.refresh(), 300);
    }

    /** Parses all ATX headings from the active markdown editor. */
    private parseHeadings(): TocItem[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'markdown') {
            return [];
        }

        const doc = editor.document;
        const uri = doc.uri;
        const flat: Array<{ text: string; level: number; line: number }> = [];

        let inCodeBlock = false;
        for (let i = 0; i < doc.lineCount; i++) {
            const lineText = doc.lineAt(i).text;

            // Track fenced code blocks to avoid false heading matches
            if (/^```/.test(lineText)) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) {
                continue;
            }

            const match = lineText.match(/^(#{1,6})\s+(.+)/);
            if (match) {
                flat.push({
                    level: match[1].length,
                    text: match[2].replace(/\s+#+\s*$/, '').trim(),
                    line: i,
                });
            }
        }

        return this.buildTree(flat, uri);
    }

    /**
     * Builds a hierarchical tree from a flat list of headings.
     * Uses a stack to establish parent-child relationships based on level.
     */
    private buildTree(
        headings: Array<{ text: string; level: number; line: number }>,
        uri: vscode.Uri,
    ): TocItem[] {
        const roots: TocItem[] = [];
        const stack: TocItem[] = [];

        for (const h of headings) {
            const item = new TocItem(h.text, h.level, h.line, uri);

            // Pop items from stack until we find a parent with lower level
            while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                roots.push(item);
            } else {
                const parent = stack[stack.length - 1];
                parent.children.push(item);
                parent.collapsibleState =
                    vscode.TreeItemCollapsibleState.Expanded;
            }

            stack.push(item);
        }

        return roots;
    }
}
