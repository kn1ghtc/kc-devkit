/**
 * Toolbar buttons and keyboard shortcuts for the PDF webview.
 */

export interface ToolbarHandlers {
    prev(): void;
    next(): void;
    zoomIn(): void;
    zoomOut(): void;
    fitWidth(): void;
    fitPage(): void;
}

export function bindPdfChrome(handlers: ToolbarHandlers): () => void {
    const byId = (id: string): HTMLButtonElement | null =>
        document.getElementById(id) as HTMLButtonElement | null;

    const prev = byId('kc-pdf-prev');
    const next = byId('kc-pdf-next');
    const zoomIn = byId('kc-pdf-zoom-in');
    const zoomOut = byId('kc-pdf-zoom-out');
    const fitWidth = byId('kc-pdf-fit-width');
    const fitPage = byId('kc-pdf-fit-page');

    const onPrev = () => handlers.prev();
    const onNext = () => handlers.next();
    const onZoomIn = () => handlers.zoomIn();
    const onZoomOut = () => handlers.zoomOut();
    const onFitWidth = () => handlers.fitWidth();
    const onFitPage = () => handlers.fitPage();

    prev?.addEventListener('click', onPrev);
    next?.addEventListener('click', onNext);
    zoomIn?.addEventListener('click', onZoomIn);
    zoomOut?.addEventListener('click', onZoomOut);
    fitWidth?.addEventListener('click', onFitWidth);
    fitPage?.addEventListener('click', onFitPage);

    const onKey = (ev: KeyboardEvent) => {
        const target = ev.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            return;
        }
        if (ev.key === 'PageDown') {
            ev.preventDefault();
            handlers.next();
            return;
        }
        if (ev.key === 'PageUp') {
            ev.preventDefault();
            handlers.prev();
            return;
        }
        if (ev.key === '+' || ev.key === '=') {
            ev.preventDefault();
            handlers.zoomIn();
            return;
        }
        if (ev.key === '-' || ev.key === '_') {
            ev.preventDefault();
            handlers.zoomOut();
        }
    };
    window.addEventListener('keydown', onKey);

    return () => {
        prev?.removeEventListener('click', onPrev);
        next?.removeEventListener('click', onNext);
        zoomIn?.removeEventListener('click', onZoomIn);
        zoomOut?.removeEventListener('click', onZoomOut);
        fitWidth?.removeEventListener('click', onFitWidth);
        fitPage?.removeEventListener('click', onFitPage);
        window.removeEventListener('keydown', onKey);
    };
}

export function setPageIndicator(page: number, total: number): void {
    const el = document.getElementById('kc-pdf-page-indicator');
    if (el) {
        el.textContent = `${page} / ${total}`;
    }
}

export function showPdfError(message: string): void {
    const el = document.getElementById('kc-pdf-error');
    if (!el) {
        return;
    }
    el.hidden = false;
    el.textContent = message;
}

export function hidePdfError(): void {
    const el = document.getElementById('kc-pdf-error');
    if (el) {
        el.hidden = true;
        el.textContent = '';
    }
}
