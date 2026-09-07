/**
 * Shared Excel preview message protocol (extension host + webview).
 * Keep this file free of the `vscode` module so the webview bundle can import it.
 */

export const EXCEL_VIEW_TYPE = 'kcDevKit.excelPreview';

export type ExcelLogLevel = 'info' | 'warn' | 'error';

/** Compact cell payload: display text + optional style/formula. */
export interface ExcelCellModel {
    t: string;
    f?: string;
    bg?: string;
    fg?: string;
    b?: boolean;
    w?: boolean;
    ah?: 'left' | 'center' | 'right';
    av?: 'top' | 'middle' | 'bottom';
}

export interface ExcelMergeModel {
    r: number;
    c: number;
    rs: number;
    cs: number;
}

export interface ExcelSheetModel {
    name: string;
    rows: ExcelCellModel[][];
    colWidths: number[];
    rowHeights: number[];
    freezeRows: number;
    freezeCols: number;
    merges: ExcelMergeModel[];
}

export interface ExcelWorkbookModel {
    fileName: string;
    sheets: ExcelSheetModel[];
}

export interface ExcelInitPayload {
    type: 'init';
    workbook: ExcelWorkbookModel;
    revision: number;
}

export interface ExcelReloadPayload {
    type: 'reload';
    workbook: ExcelWorkbookModel;
    revision: number;
}

export interface ExcelHostErrorPayload {
    type: 'hostError';
    message: string;
}

export type HostToWebview = ExcelInitPayload | ExcelReloadPayload | ExcelHostErrorPayload;

export interface ExcelReadyMessage {
    type: 'ready';
}

export interface ExcelLogMessage {
    type: 'log';
    level: ExcelLogLevel;
    message: string;
}

export interface ExcelErrorMessage {
    type: 'error';
    message: string;
}

export type WebviewToHost = ExcelReadyMessage | ExcelLogMessage | ExcelErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isWebviewToHost(value: unknown): value is WebviewToHost {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return false;
    }
    if (value.type === 'ready') {
        return true;
    }
    if (value.type === 'log') {
        return (
            (value.level === 'info' || value.level === 'warn' || value.level === 'error') &&
            typeof value.message === 'string'
        );
    }
    if (value.type === 'error') {
        return typeof value.message === 'string';
    }
    return false;
}
