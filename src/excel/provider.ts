/**
 * Custom readonly editor provider for Excel / CSV preview.
 * Read-only so COUNTIF/SUM, fills, and data validation in the source file stay intact.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import { buildExcelCsp, buildExcelErrorHtml, buildExcelPreviewHtml, createExcelNonce } from './html';
import { parseSpreadsheet } from './parse';
import { EXCEL_VIEW_TYPE, isWebviewToHost, type ExcelWorkbookModel, type HostToWebview } from './protocol';

class ExcelCustomDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}
    dispose(): void {
        // no owned resources
    }
}

export class ExcelPreviewProvider implements vscode.CustomReadonlyEditorProvider<ExcelCustomDocument> {
    public static readonly viewType = EXCEL_VIEW_TYPE;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel,
    ) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<ExcelCustomDocument> {
        return new ExcelCustomDocument(uri);
    }

    async resolveCustomEditor(
        document: ExcelCustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const nonce = createExcelNonce();
        const webview = webviewPanel.webview;
        webview.options = this.buildOptions();
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'styles', 'excel-preview.css'),
        );
        const viewerUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'preview-scripts', 'excel-viewer.js'),
        );
        const csp = buildExcelCsp(webview.cspSource, nonce);
        webview.html = buildExcelPreviewHtml({
            nonce,
            csp,
            cssHref: cssUri.toString(),
            viewerHref: viewerUri.toString(),
        });

        const disposables: vscode.Disposable[] = [];
        let revision = 0;
        let webviewReady = false;

        const post = (msg: HostToWebview): void => {
            void webview.postMessage(msg);
        };

        const sendWorkbook = async (): Promise<void> => {
            try {
                const workbook = await this.loadWorkbook(document.uri);
                post({ type: webviewReady && revision > 0 ? 'reload' : 'init', workbook, revision });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.output.appendLine(`[excel] ${message}`);
                post({ type: 'hostError', message });
            }
        };

        disposables.push(
            webview.onDidReceiveMessage((raw: unknown) => {
                if (!isWebviewToHost(raw)) {
                    return;
                }
                if (raw.type === 'ready') {
                    webviewReady = true;
                    void sendWorkbook();
                    return;
                }
                if (raw.type === 'log') {
                    this.output.appendLine(`[excel] ${raw.level}: ${raw.message}`);
                    return;
                }
                this.output.appendLine(`[excel] error: ${raw.message}`);
            }),
        );

        const watcher = this.watchFile(document.uri, () => {
            revision += 1;
            if (webviewReady) {
                void sendWorkbook();
            }
        });
        if (watcher) {
            disposables.push(watcher);
        }

        webviewPanel.onDidDispose(() => {
            for (const d of disposables) {
                d.dispose();
            }
        });

        this.output.appendLine(`[excel] opened ${document.uri.fsPath}`);
    }

    private buildOptions(): vscode.WebviewOptions {
        return {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'preview-scripts'),
                vscode.Uri.joinPath(this.context.extensionUri, 'styles'),
            ],
        };
    }

    private async loadWorkbook(uri: vscode.Uri): Promise<ExcelWorkbookModel> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(bytes);
        const fileName = path.basename(uri.fsPath);
        return parseSpreadsheet(fileName, buffer);
    }

    private watchFile(uri: vscode.Uri, onChange: () => void): vscode.Disposable | undefined {
        if (uri.scheme !== 'file') {
            return undefined;
        }
        const pattern = new vscode.RelativePattern(path.dirname(uri.fsPath), path.basename(uri.fsPath));
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const bounce = (): void => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => onChange(), 200);
        };
        watcher.onDidChange(bounce);
        watcher.onDidCreate(bounce);
        watcher.onDidDelete(() => onChange());
        return new vscode.Disposable(() => {
            if (timer) {
                clearTimeout(timer);
            }
            watcher.dispose();
        });
    }
}
