/**
 * PPT preview module — custom editor + command registration.
 */

import * as vscode from 'vscode';

import { PptPreviewProvider } from './provider';
import { PPT_VIEW_TYPE } from './protocol';

const PPT_EXTS = ['.ppt', '.pptx'];

export function activatePptPreview(context: vscode.ExtensionContext, output: vscode.OutputChannel): void {
    const provider = new PptPreviewProvider(context, output);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(PptPreviewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        }),
    );
    context.subscriptions.push(vscode.commands.registerCommand('kcDevKit.openPptPreview', () => openPptPreview()));
}

async function openPptPreview(): Promise<void> {
    const uri = await resolvePptUri();
    if (!uri) {
        return;
    }
    await vscode.commands.executeCommand('vscode.openWith', uri, PPT_VIEW_TYPE);
}

async function resolvePptUri(): Promise<vscode.Uri | undefined> {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active && isPpt(active)) {
        return active;
    }
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const input = tab?.input;
    if (input instanceof vscode.TabInputCustom && isPpt(input.uri)) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputText && isPpt(input.uri)) {
        return input.uri;
    }
    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { Presentation: ['ppt', 'pptx'] },
        title: 'Open PPT Preview',
    });
    return picked?.[0];
}

function isPpt(uri: vscode.Uri): boolean {
    const lower = uri.fsPath.toLowerCase();
    return PPT_EXTS.some((ext) => lower.endsWith(ext));
}
