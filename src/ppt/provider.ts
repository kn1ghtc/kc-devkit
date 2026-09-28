/**
 * Custom readonly editor for .ppt and .pptx.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import { convertPptToPptx } from './convertLegacy';
import { buildPptCsp, buildPptErrorHtml, buildPptPreviewHtml, createPptNonce } from './html';
import { parsePptx } from './parsePptx';
import { isWebviewToHost, PPT_VIEW_TYPE, type HostToWebview, type PptDeckModel } from './protocol';

class PptCustomDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}
    dispose(): void {
        // no owned resources
    }
}

export class PptPreviewProvider implements vscode.CustomReadonlyEditorProvider<PptCustomDocument> {
    public static readonly viewType = PPT_VIEW_TYPE;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel,
    ) {}

    async openCustomDocument(uri: vscode.Uri): Promise<PptCustomDocument> {
        return new PptCustomDocument(uri);
    }

    async resolveCustomEditor(document: PptCustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        const nonce = createPptNonce();
        const webview = webviewPanel.webview;
        webview.options = this.buildOptions();
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'styles', 'ppt-preview.css'));
        const viewerUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'preview-scripts', 'ppt-viewer.js'),
        );
        const csp = buildPptCsp(webview.cspSource, nonce);
        webview.html = buildPptPreviewHtml({
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
        const sendDeck = async (): Promise<void> => {
            try {
                const deck = await this.loadDeck(document.uri);
                post({ type: webviewReady && revision > 0 ? 'reload' : 'init', deck, revision });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.output.appendLine(`[ppt] ${message}`);
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
                    void sendDeck();
                    return;
                }
                if (raw.type === 'log') {
                    this.output.appendLine(`[ppt] ${raw.level}: ${raw.message}`);
                    return;
                }
                this.output.appendLine(`[ppt] error: ${raw.message}`);
            }),
        );
        webviewPanel.onDidDispose(() => {
            for (const item of disposables) {
                item.dispose();
            }
        });
        this.output.appendLine(`[ppt] opened ${document.uri.fsPath}`);
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

    private async loadDeck(uri: vscode.Uri): Promise<PptDeckModel> {
        const fileName = path.basename(uri.fsPath);
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.ppt') && !lower.endsWith('.pptx')) {
            const converted = await convertPptToPptx(uri.fsPath);
            return parsePptx(fileName, converted);
        }
        const bytes = await vscode.workspace.fs.readFile(uri);
        return parsePptx(fileName, Buffer.from(bytes));
    }
}
