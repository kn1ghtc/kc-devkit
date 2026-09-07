/**
 * Excel preview module — custom editor + command registration.
 */

import * as vscode from 'vscode';

import { EXCEL_VIEW_TYPE } from './protocol';
import { ExcelPreviewProvider } from './provider';

const SPREADSHEET_EXTS = ['.xlsx', '.xlsm', '.xls', '.csv'];

export function activateExcelPreview(
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
): void {
    const provider = new ExcelPreviewProvider(context, output);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(ExcelPreviewProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.openExcelPreview', () => openExcelPreview()),
    );
}

async function openExcelPreview(): Promise<void> {
    const uri = await resolveSpreadsheetUri();
    if (!uri) {
        return;
    }
    await vscode.commands.executeCommand('vscode.openWith', uri, EXCEL_VIEW_TYPE);
}

async function resolveSpreadsheetUri(): Promise<vscode.Uri | undefined> {
    const fromEditor = activeSpreadsheetUri();
    if (fromEditor) {
        return fromEditor;
    }
    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { Spreadsheet: ['xlsx', 'xlsm', 'xls', 'csv'] },
        title: 'Open Excel Preview',
    });
    return picked?.[0];
}

function activeSpreadsheetUri(): vscode.Uri | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor && isSpreadsheetUri(editor.document.uri)) {
        return editor.document.uri;
    }
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!tab) {
        return undefined;
    }
    const input = tab.input;
    if (input instanceof vscode.TabInputCustom && isSpreadsheetUri(input.uri)) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputText && isSpreadsheetUri(input.uri)) {
        return input.uri;
    }
    return undefined;
}

function isSpreadsheetUri(uri: vscode.Uri): boolean {
    const lower = uri.fsPath.toLowerCase();
    return SPREADSHEET_EXTS.some((ext) => lower.endsWith(ext));
}
