/**
 * PDF preview webview entry (bundled to preview-scripts/pdf-viewer.js).
 */

import {
    isHostToWebview,
    type PdfInitPayload,
    type PdfReloadPayload,
    type WebviewToHost,
} from '../protocol';
import { classifyPdfError, type PdfJsDocument, type PdfJsModule } from './pdfjs-api';
import { PdfPager } from './pager';
import { computeScale, FIT_PAGE, FIT_WIDTH, parseDefaultScale, zoomMode } from './scale';
import { bindPdfChrome, hidePdfError, setPageIndicator, showPdfError } from './toolbar';

interface VsCodeApi {
    postMessage(message: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export interface BootOptions {
    pdfjs: PdfJsModule;
    workerUrl: string;
}

interface Session {
    pager: PdfPager;
    pdf: PdfJsDocument;
    revision: number;
    scaleMode: string;
    baseWidth: number;
    baseHeight: number;
    cMapUrl: string;
    standardFontDataUrl: string;
}

export function bootPdfViewer(opts: BootOptions): void {
    const vscode = acquireVsCodeApi();
    opts.pdfjs.GlobalWorkerOptions.workerSrc = opts.workerUrl;

    const pagesRoot = document.getElementById('kc-pdf-pages');
    const scrollRoot = document.getElementById('kc-pdf-scroll');
    if (!pagesRoot || !scrollRoot) {
        vscode.postMessage({ type: 'error', message: 'PDF preview DOM is incomplete.' });
        return;
    }

    let session: Session | undefined;
    let unbindChrome: (() => void) | undefined;
    let resizeTimer: number | undefined;

    const postLog = (level: 'info' | 'warn' | 'error', message: string): void => {
        vscode.postMessage({ type: 'log', level, message });
    };

    const fail = (message: string): void => {
        showPdfError(message);
        vscode.postMessage({ type: 'error', message });
        postLog('error', message);
    };

    const viewSize = (): { w: number; h: number } => ({
        w: scrollRoot.clientWidth,
        h: scrollRoot.clientHeight,
    });

    const applyFit = (mode: string): void => {
        if (!session) {
            return;
        }
        session.scaleMode = mode;
        const { w, h } = viewSize();
        const scale = computeScale(mode, session.baseWidth, session.baseHeight, w, h);
        session.pager.applyScale(scale);
    };

    unbindChrome = bindPdfChrome({
        prev: () => session?.pager.goToPage((session.pager.page) - 1),
        next: () => session?.pager.goToPage((session.pager.page) + 1),
        zoomIn: () => {
            if (!session) {
                return;
            }
            session.scaleMode = zoomMode(session.pager.currentScale, 1);
            session.pager.applyScale(Number(session.scaleMode));
        },
        zoomOut: () => {
            if (!session) {
                return;
            }
            session.scaleMode = zoomMode(session.pager.currentScale, -1);
            session.pager.applyScale(Number(session.scaleMode));
        },
        fitWidth: () => applyFit(FIT_WIDTH),
        fitPage: () => applyFit(FIT_PAGE),
    });

    const onResize = (): void => {
        if (resizeTimer !== undefined) {
            window.clearTimeout(resizeTimer);
        }
        resizeTimer = window.setTimeout(() => {
            if (!session) {
                return;
            }
            if (session.scaleMode === FIT_WIDTH || session.scaleMode === FIT_PAGE) {
                applyFit(session.scaleMode);
            }
        }, 120);
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(scrollRoot);

    const tearDown = async (): Promise<void> => {
        session?.pager.dispose();
        const pdf = session?.pdf;
        session = undefined;
        if (pdf) {
            try {
                await pdf.destroy();
            } catch {
                // ignore
            }
        }
    };

    const openDocument = async (payload: PdfInitPayload | PdfReloadPayload, extras?: {
        cMapUrl: string;
        standardFontDataUrl: string;
        defaultScale: string;
    }): Promise<void> => {
        hidePdfError();
        const cMapUrl = extras?.cMapUrl ?? session?.cMapUrl;
        const standardFontDataUrl = extras?.standardFontDataUrl ?? session?.standardFontDataUrl;
        const defaultScale = extras?.defaultScale ?? session?.scaleMode ?? FIT_WIDTH;
        if (!cMapUrl || !standardFontDataUrl) {
            fail('Missing cmap / standard font URLs.');
            return;
        }

        await tearDown();

        const loadingTask = opts.pdfjs.getDocument({
            url: payload.pdfUrl,
            cMapUrl,
            cMapPacked: true,
            standardFontDataUrl,
            disableFontFace: false,
            isEvalSupported: false,
            useSystemFonts: false,
        });

        loadingTask.onPassword = () => {
            void loadingTask.destroy();
            fail('This PDF is encrypted and cannot be opened.');
        };

        let pdf: PdfJsDocument;
        try {
            pdf = await loadingTask.promise;
        } catch (err) {
            fail(classifyPdfError(err));
            return;
        }

        const pager = new PdfPager(
            pagesRoot,
            scrollRoot,
            pdf,
            (page, total) => {
                setPageIndicator(page, total);
                vscode.postMessage({ type: 'pageChanged', page, total });
            },
            (message) => fail(message),
        );

        const first = await pdf.getPage(1);
        const base = first.getViewport({ scale: 1 });
        first.cleanup();

        const scaleMode = parseDefaultScale(defaultScale);
        const { w, h } = viewSize();
        const scale = computeScale(scaleMode, base.width, base.height, w, h);

        session = {
            pager,
            pdf,
            revision: payload.revision,
            scaleMode,
            baseWidth: base.width,
            baseHeight: base.height,
            cMapUrl,
            standardFontDataUrl,
        };

        try {
            await pager.init(scale);
            postLog('info', `Opened PDF (${pdf.numPages} pages)`);
        } catch (err) {
            fail(classifyPdfError(err));
        }
    };

    window.addEventListener('message', (ev: MessageEvent<unknown>) => {
        if (!isHostToWebview(ev.data)) {
            return;
        }
        const msg = ev.data;
        if (msg.type === 'hostError') {
            fail(msg.message);
            return;
        }
        if (msg.type === 'init') {
            void openDocument(msg, {
                cMapUrl: msg.cMapUrl,
                standardFontDataUrl: msg.standardFontDataUrl,
                defaultScale: msg.defaultScale,
            });
            return;
        }
        if (msg.type === 'reload') {
            void openDocument(msg);
        }
    });

    window.addEventListener('unload', () => {
        resizeObserver.disconnect();
        unbindChrome?.();
        void tearDown();
    });

    vscode.postMessage({ type: 'ready' });
}
