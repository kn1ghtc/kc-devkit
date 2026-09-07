/**
 * Minimal pdf.js surface used by the webview (no pdfjs-dist import).
 */

export interface PdfViewport {
    width: number;
    height: number;
}

export interface PdfRenderTask {
    promise: Promise<void>;
    cancel(): void;
}

export interface PdfJsPage {
    getViewport(params: { scale: number }): PdfViewport;
    render(params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: PdfViewport;
        transform?: number[];
        canvas?: HTMLCanvasElement;
    }): PdfRenderTask;
    cleanup(): void;
}

export interface PdfJsDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfJsPage>;
    destroy(): Promise<void>;
}

export interface PdfGetDocumentParams {
    url?: string;
    data?: Uint8Array;
    cMapUrl: string;
    cMapPacked: boolean;
    standardFontDataUrl: string;
    disableFontFace: boolean;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
}

export interface PdfLoadingTask {
    promise: Promise<PdfJsDocument>;
    destroy(): Promise<void>;
    onPassword:
        | ((updateCallback: (password: string) => void, reason: number) => void)
        | undefined;
}

export interface PdfJsModule {
    getDocument(src: PdfGetDocumentParams): PdfLoadingTask;
    GlobalWorkerOptions: { workerSrc: string };
}

export function classifyPdfError(err: unknown): string {
    const name =
        err && typeof err === 'object' && 'name' in err
            ? String((err as { name: unknown }).name)
            : '';
    const message = err instanceof Error ? err.message : String(err);

    if (name === 'PasswordException' || /password|encrypted/i.test(message)) {
        return 'This PDF is encrypted and cannot be opened.';
    }
    if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
        return 'Invalid or corrupted PDF file.';
    }
    if (name === 'MissingPDFException' || /missing pdf/i.test(message)) {
        return 'PDF file not found.';
    }
    if (/worker/i.test(message)) {
        return 'PDF worker failed to load.';
    }
    return message || 'Failed to render PDF.';
}
