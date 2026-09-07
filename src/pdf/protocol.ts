/**
 * Shared PDF preview message protocol (extension host + webview).
 * Keep this file free of the `vscode` module so the webview bundle can import it.
 */

export const PDF_VIEW_TYPE = 'kcDevKit.pdfPreview';

export type PdfLogLevel = 'info' | 'warn' | 'error';

export interface PdfInitPayload {
    type: 'init';
    pdfUrl: string;
    cMapUrl: string;
    standardFontDataUrl: string;
    defaultScale: string;
    revision: number;
}

export interface PdfReloadPayload {
    type: 'reload';
    pdfUrl: string;
    revision: number;
}

export interface PdfHostErrorPayload {
    type: 'hostError';
    message: string;
}

export type HostToWebview = PdfInitPayload | PdfReloadPayload | PdfHostErrorPayload;

export interface PdfReadyMessage {
    type: 'ready';
}

export interface PdfLogMessage {
    type: 'log';
    level: PdfLogLevel;
    message: string;
}

export interface PdfErrorMessage {
    type: 'error';
    message: string;
}

export interface PdfPageChangedMessage {
    type: 'pageChanged';
    page: number;
    total: number;
}

export type WebviewToHost =
    | PdfReadyMessage
    | PdfLogMessage
    | PdfErrorMessage
    | PdfPageChangedMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isWebviewToHost(value: unknown): value is WebviewToHost {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return false;
    }
    switch (value.type) {
        case 'ready':
            return true;
        case 'log':
            return (
                (value.level === 'info' || value.level === 'warn' || value.level === 'error') &&
                typeof value.message === 'string'
            );
        case 'error':
            return typeof value.message === 'string';
        case 'pageChanged':
            return typeof value.page === 'number' && typeof value.total === 'number';
        default:
            return false;
    }
}

export function isHostToWebview(value: unknown): value is HostToWebview {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return false;
    }
    if (value.type === 'hostError') {
        return typeof value.message === 'string';
    }
    if (value.type === 'init') {
        return (
            typeof value.pdfUrl === 'string' &&
            typeof value.cMapUrl === 'string' &&
            typeof value.standardFontDataUrl === 'string' &&
            typeof value.defaultScale === 'string' &&
            typeof value.revision === 'number'
        );
    }
    if (value.type === 'reload') {
        return typeof value.pdfUrl === 'string' && typeof value.revision === 'number';
    }
    return false;
}
