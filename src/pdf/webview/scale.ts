/**
 * Zoom helpers for the PDF webview.
 */

export const FIT_WIDTH = 'page-width';
export const FIT_PAGE = 'page-fit';

const PAD = 24;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const ZOOM_FACTOR = 1.25;

export function parseDefaultScale(value: string): string {
    const trimmed = value.trim();
    if (trimmed === FIT_WIDTH || trimmed === FIT_PAGE) {
        return trimmed;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) {
        return String(n);
    }
    return FIT_WIDTH;
}

export function computeScale(
    mode: string,
    pageWidth: number,
    pageHeight: number,
    viewWidth: number,
    viewHeight: number,
): number {
    const availW = Math.max(50, viewWidth - PAD);
    const availH = Math.max(50, viewHeight - PAD);
    if (pageWidth <= 0 || pageHeight <= 0) {
        return 1;
    }
    if (mode === FIT_PAGE) {
        return clamp(Math.min(availW / pageWidth, availH / pageHeight));
    }
    if (mode === FIT_WIDTH) {
        return clamp(availW / pageWidth);
    }
    const n = Number(mode);
    if (Number.isFinite(n) && n > 0) {
        return clamp(n);
    }
    return clamp(availW / pageWidth);
}

export function zoomMode(currentScale: number, direction: 1 | -1): string {
    const next = direction > 0 ? currentScale * ZOOM_FACTOR : currentScale / ZOOM_FACTOR;
    return String(clamp(next));
}

function clamp(scale: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
