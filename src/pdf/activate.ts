/**
 * PDF preview module — custom editor + command registration.
 */

import * as vscode from 'vscode';

import { PDF_VIEW_TYPE } from './protocol';
import { PdfPreviewProvider } from './provider';

/**
 * Activates the PDF preview module (isolated from other KC DevKit features).
 */
export function activatePdfPreview(
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
): void {
    const provider = new PdfPreviewProvider(context, output);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(PdfPreviewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.openPdfPreview', () => openPdfPreview()),
    );
}

async function openPdfPreview(): Promise<void> {
    const uri = await resolvePdfUri();
    if (!uri) {
        return;
    }
    await vscode.commands.executeCommand('vscode.openWith', uri, PDF_VIEW_TYPE);
}

async function resolvePdfUri(): Promise<vscode.Uri | undefined> {
    const fromEditor = activePdfUri();
    if (fromEditor) {
        return fromEditor;
    }
    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { PDF: ['pdf'] },
        title: 'Open PDF Preview',
    });
    return picked?.[0];
}

function activePdfUri(): vscode.Uri | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor && isPdfUri(editor.document.uri)) {
        return editor.document.uri;
    }
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!tab) {
        return undefined;
    }
    const input = tab.input;
    if (input instanceof vscode.TabInputCustom && isPdfUri(input.uri)) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputText && isPdfUri(input.uri)) {
        return input.uri;
    }
    return undefined;
}

function isPdfUri(uri: vscode.Uri): boolean {
    return uri.fsPath.toLowerCase().endsWith('.pdf');
}
