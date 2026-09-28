/**
 * Shared PPT preview protocol. No `vscode` import so the webview can use it.
 */

export const PPT_VIEW_TYPE = 'kcDevKit.pptPreview';

export interface PptRunModel {
    text: string;
    color: string;
    sizePt: number;
    bold: boolean;
    align: 'left' | 'center' | 'right';
}

export interface PptShapeModel {
    x: number;
    y: number;
    cx: number;
    cy: number;
    fill?: string;
    line?: string;
    runs: PptRunModel[];
}

export interface PptSlideModel {
    background: string;
    shapes: PptShapeModel[];
}

export interface PptDeckModel {
    fileName: string;
    slideCx: number;
    slideCy: number;
    slides: PptSlideModel[];
}

export type HostToWebview =
    | { type: 'init'; deck: PptDeckModel; revision: number }
    | { type: 'reload'; deck: PptDeckModel; revision: number }
    | { type: 'hostError'; message: string };

export type WebviewToHost =
    | { type: 'ready' }
    | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
    | { type: 'error'; message: string };

export function isWebviewToHost(value: unknown): value is WebviewToHost {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const kind = (value as { type?: unknown }).type;
    return kind === 'ready' || kind === 'log' || kind === 'error';
}
