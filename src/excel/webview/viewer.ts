/**
 * Excel preview webview entry (bundled to preview-scripts/excel-viewer.js).
 */

import type { ExcelSheetModel, ExcelWorkbookModel, HostToWebview, WebviewToHost } from '../protocol';
import { applyRowFilter, renderSheetTable } from './grid';

interface VsCodeApi {
    postMessage(message: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

function isHostToWebview(value: unknown): value is HostToWebview {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const type = (value as { type?: unknown }).type;
    return type === 'init' || type === 'reload' || type === 'hostError';
}

export function bootExcelViewer(): void {
    const vscode = acquireVsCodeApi();
    const titleEl = document.getElementById('kc-excel-title');
    const hintEl = document.getElementById('kc-excel-hint');
    const errorEl = document.getElementById('kc-excel-error');
    const wrap = document.getElementById('kc-excel-grid-wrap');
    const tabs = document.getElementById('kc-excel-tabs');
    const filter = document.getElementById('kc-excel-filter') as HTMLInputElement | null;
    if (!wrap || !tabs) {
        vscode.postMessage({ type: 'error', message: 'Excel preview DOM is incomplete.' });
        return;
    }

    let workbook: ExcelWorkbookModel | undefined;
    let sheetIndex = 0;

    const showError = (message: string): void => {
        if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = message;
        }
        vscode.postMessage({ type: 'error', message });
    };

    const hideError = (): void => {
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
    };

    const paintSheet = (sheet: ExcelSheetModel): void => {
        wrap.replaceChildren(renderSheetTable(sheet));
        const table = wrap.querySelector('table.kc-excel-table') as HTMLTableElement | null;
        if (table && filter) {
            applyRowFilter(table, filter.value);
        }
        if (hintEl) {
            hintEl.textContent = `${sheet.name} · ${sheet.rows.length} 行 × ${sheet.colWidths.length} 列 · 只读`;
        }
    };

    const paintTabs = (sheets: ExcelSheetModel[]): void => {
        tabs.replaceChildren();
        sheets.forEach((sheet, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kc-excel-tab';
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', idx === sheetIndex ? 'true' : 'false');
            btn.textContent = sheet.name;
            if (idx === sheetIndex) {
                btn.classList.add('kc-excel-tab-active');
            }
            btn.addEventListener('click', () => {
                sheetIndex = idx;
                paintTabs(sheets);
                paintSheet(sheet);
            });
            tabs.appendChild(btn);
        });
    };

    const render = (model: ExcelWorkbookModel): void => {
        hideError();
        workbook = model;
        if (titleEl) {
            titleEl.textContent = model.fileName;
        }
        if (sheetIndex >= model.sheets.length) {
            sheetIndex = 0;
        }
        paintTabs(model.sheets);
        const sheet = model.sheets[sheetIndex];
        if (!sheet) {
            showError('Workbook contains no sheets.');
            return;
        }
        paintSheet(sheet);
        vscode.postMessage({
            type: 'log',
            level: 'info',
            message: `rendered ${model.sheets.length} sheet(s) from ${model.fileName}`,
        });
    };

    filter?.addEventListener('input', () => {
        const table = wrap.querySelector('table.kc-excel-table') as HTMLTableElement | null;
        if (table) {
            applyRowFilter(table, filter.value);
        }
    });

    window.addEventListener('message', (ev: MessageEvent<unknown>) => {
        if (!isHostToWebview(ev.data)) {
            return;
        }
        if (ev.data.type === 'hostError') {
            showError(ev.data.message);
            return;
        }
        render(ev.data.workbook);
    });

    vscode.postMessage({ type: 'ready' });
}
