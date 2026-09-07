/**
 * Custom readonly editor provider for PDF preview.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import { buildPdfCsp, buildPdfErrorHtml, buildPdfPreviewHtml, createNonce, revisionToken } from './html';
import { isWebviewToHost, PDF_VIEW_TYPE, type HostToWebview } from './protocol';
import { ensureTrailingSlash, resolveVendorPdfJs } from './vendor';

class PdfCustomDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}
    dispose(): void {
        // no owned resources
    }
}

interface WebviewUris {
    pdfJs: vscode.Uri;
    worker: vscode.Uri;
    cmaps: vscode.Uri;
    standardFonts: vscode.Uri;
    viewer: vscode.Uri;
    css: vscode.Uri;
}

export class PdfPreviewProvider implements vscode.CustomReadonlyEditorProvider<PdfCustomDocument> {
    public static readonly viewType = PDF_VIEW_TYPE;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel,
    ) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<PdfCustomDocument> {
        return new PdfCustomDocument(uri);
    }

    async resolveCustomEditor(
        document: PdfCustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const vendor = resolveVendorPdfJs(this.context.extensionPath);
        const nonce = createNonce();
        const webview = webviewPanel.webview;
        webview.options = this.buildOptions(document.uri);

        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'styles', 'pdf-preview.css'),
        );
        const csp = buildPdfCsp(webview.cspSource, nonce);

        if (!vendor) {
            const message = 'pdf.js assets are missing. Rebuild the extension (scripts/build.ps1).';
            this.output.appendLine(`[pdf] ${message}`);
            webview.html = buildPdfErrorHtml(nonce, csp, cssUri.toString(), message);
            return;
        }

        const uris: WebviewUris = {
            pdfJs: webview.asWebviewUri(vscode.Uri.file(path.join(vendor.rootDir, vendor.pdfJsFile))),
            worker: webview.asWebviewUri(vscode.Uri.file(path.join(vendor.rootDir, vendor.workerFile))),
            cmaps: webview.asWebviewUri(vscode.Uri.file(vendor.cmapsDir)),
            standardFonts: webview.asWebviewUri(vscode.Uri.file(vendor.standardFontsDir)),
            viewer: webview.asWebviewUri(
                vscode.Uri.joinPath(this.context.extensionUri, 'preview-scripts', 'pdf-viewer.js'),
            ),
            css: cssUri,
        };

        webview.html = buildPdfPreviewHtml({
            nonce,
            csp,
            cssHref: uris.css.toString(),
            viewerHref: uris.viewer.toString(),
            pdfJsHref: uris.pdfJs.toString(),
            workerHref: uris.worker.toString(),
        });

        const disposables: vscode.Disposable[] = [];
        let revision = 0;
        let webviewReady = false;

        const post = (msg: HostToWebview): void => {
            void webview.postMessage(msg);
        };

        const sendInit = async (): Promise<void> => {
            const init = await this.buildInit(webview, document.uri, uris, revision);
            if (!init) {
                post({ type: 'hostError', message: `PDF file not found: ${document.uri.fsPath}` });
                return;
            }
            post(init);
        };

        disposables.push(
            webview.onDidReceiveMessage((raw: unknown) => {
                if (!isWebviewToHost(raw)) {
                    return;
                }
                if (raw.type === 'ready') {
                    webviewReady = true;
                    void sendInit();
                    return;
                }
                if (raw.type === 'log') {
                    this.output.appendLine(`[pdf] ${raw.level}: ${raw.message}`);
                    return;
                }
                if (raw.type === 'error') {
                    this.output.appendLine(`[pdf] error: ${raw.message}`);
                }
            }),
        );

        const watcher = this.watchPdf(document.uri, async () => {
            revision += 1;
            if (!webviewReady) {
                return;
            }
            const reload = await this.buildReload(webview, document.uri, revision);
            if (!reload) {
                post({ type: 'hostError', message: `PDF file not found: ${document.uri.fsPath}` });
                return;
            }
            post(reload);
            this.output.appendLine(`[pdf] reloaded ${document.uri.fsPath}`);
        });
        if (watcher) {
            disposables.push(watcher);
        }

        webviewPanel.onDidDispose(() => {
            for (const d of disposables) {
                d.dispose();
            }
        });

        this.output.appendLine(`[pdf] opened ${document.uri.fsPath}`);
    }

    private buildOptions(pdfUri: vscode.Uri): vscode.WebviewOptions {
        const roots = [
            vscode.Uri.joinPath(this.context.extensionUri, 'vendor', 'pdfjs'),
            vscode.Uri.joinPath(this.context.extensionUri, 'preview-scripts'),
            vscode.Uri.joinPath(this.context.extensionUri, 'styles'),
        ];
        if (pdfUri.scheme === 'file') {
            roots.push(vscode.Uri.file(path.dirname(pdfUri.fsPath)));
        }
        return { enableScripts: true, localResourceRoots: roots };
    }

    private async buildInit(
        webview: vscode.Webview,
        pdfUri: vscode.Uri,
        uris: WebviewUris,
        revision: number,
    ): Promise<HostToWebview | undefined> {
        const pdfUrl = await this.toPdfWebviewUrl(webview, pdfUri);
        if (!pdfUrl) {
            return undefined;
        }
        const defaultScale = vscode.workspace
            .getConfiguration('kcDevKit.pdf')
            .get<string>('defaultScale', 'page-width');
        return {
            type: 'init',
            pdfUrl,
            cMapUrl: ensureTrailingSlash(uris.cmaps.toString()),
            standardFontDataUrl: ensureTrailingSlash(uris.standardFonts.toString()),
            defaultScale: defaultScale || 'page-width',
            revision,
        };
    }

    private async buildReload(
        webview: vscode.Webview,
        pdfUri: vscode.Uri,
        revision: number,
    ): Promise<HostToWebview | undefined> {
        const pdfUrl = await this.toPdfWebviewUrl(webview, pdfUri);
        if (!pdfUrl) {
            return undefined;
        }
        return { type: 'reload', pdfUrl, revision };
    }

    private async toPdfWebviewUrl(webview: vscode.Webview, pdfUri: vscode.Uri): Promise<string | undefined> {
        try {
            const stat = await vscode.workspace.fs.stat(pdfUri);
            const token = revisionToken(pdfUri.fsPath, stat.mtime, stat.size);
            const base = webview.asWebviewUri(pdfUri).toString();
            const sep = base.includes('?') ? '&' : '?';
            return `${base}${sep}t=${token}`;
        } catch {
            return undefined;
        }
    }

    private watchPdf(uri: vscode.Uri, onChange: () => void): vscode.Disposable | undefined {
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
