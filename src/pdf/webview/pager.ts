/**
 * Virtualized page list: render nearby pages on canvas, destroy offscreen ones.
 */

import type { PdfJsDocument, PdfJsPage, PdfRenderTask } from './pdfjs-api';

const NEIGHBOR = 1;

interface Slot {
    el: HTMLDivElement;
    pageNum: number;
}

export class PdfPager {
    private readonly slots: Slot[] = [];
    private readonly canvases = new Map<number, HTMLCanvasElement>();
    private readonly tasks = new Map<number, PdfRenderTask>();
    private readonly inflight = new Set<number>();
    private readonly visible = new Set<number>();
    private observer: IntersectionObserver;
    private baseWidth = 612;
    private baseHeight = 792;
    private scale = 1;
    private disposed = false;
    private currentPage = 1;

    constructor(
        private readonly pagesRoot: HTMLElement,
        private readonly scrollRoot: HTMLElement,
        private readonly pdf: PdfJsDocument,
        private readonly onPageChange: (page: number, total: number) => void,
        private readonly onError: (message: string) => void,
    ) {
        this.observer = new IntersectionObserver(
            (entries) => this.onIntersect(entries),
            { root: this.scrollRoot, rootMargin: '160px 0px', threshold: 0.01 },
        );
    }

    get pageCount(): number {
        return this.pdf.numPages;
    }

    get currentScale(): number {
        return this.scale;
    }

    get page(): number {
        return this.currentPage;
    }

    async init(scale: number): Promise<void> {
        const page = await this.pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        this.baseWidth = vp.width;
        this.baseHeight = vp.height;
        page.cleanup();

        this.pagesRoot.replaceChildren();
        this.slots.length = 0;
        for (let n = 1; n <= this.pdf.numPages; n++) {
            const el = document.createElement('div');
            el.className = 'kc-pdf-page';
            el.dataset.page = String(n);
            el.setAttribute('role', 'img');
            el.setAttribute('aria-label', `Page ${n}`);
            this.pagesRoot.appendChild(el);
            this.slots.push({ el, pageNum: n });
            this.observer.observe(el);
        }

        this.scrollRoot.addEventListener('scroll', () => this.emitCurrentPage(), { passive: true });
        this.applyScale(scale);
        this.emitCurrentPage();
        await this.syncRenders();
    }

    applyScale(scale: number): void {
        this.scale = scale;
        for (const n of [...this.canvases.keys()]) {
            this.destroyPage(n);
        }
        const width = Math.floor(this.baseWidth * scale);
        const height = Math.floor(this.baseHeight * scale);
        for (const slot of this.slots) {
            slot.el.style.width = `${width}px`;
            slot.el.style.height = `${height}px`;
        }
        void this.syncRenders();
    }

    goToPage(pageNum: number): void {
        const clamped = Math.min(this.pdf.numPages, Math.max(1, pageNum));
        const slot = this.slots[clamped - 1];
        if (slot) {
            slot.el.scrollIntoView({ block: 'start' });
            this.currentPage = clamped;
            this.onPageChange(this.currentPage, this.pdf.numPages);
        }
    }

    dispose(): void {
        this.disposed = true;
        this.observer.disconnect();
        for (const n of [...this.canvases.keys()]) {
            this.destroyPage(n);
        }
        this.pagesRoot.replaceChildren();
    }

    private onIntersect(entries: IntersectionObserverEntry[]): void {
        for (const entry of entries) {
            const raw = (entry.target as HTMLElement).dataset.page;
            const pageNum = raw ? Number(raw) : NaN;
            if (!Number.isFinite(pageNum)) {
                continue;
            }
            if (entry.isIntersecting) {
                this.visible.add(pageNum);
            } else {
                this.visible.delete(pageNum);
            }
        }
        this.emitCurrentPage();
        void this.syncRenders();
    }

    private desiredPages(): Set<number> {
        const out = new Set<number>();
        const seeds = this.visible.size > 0 ? this.visible : new Set([this.currentPage]);
        for (const p of seeds) {
            for (let n = p - NEIGHBOR; n <= p + NEIGHBOR; n++) {
                if (n >= 1 && n <= this.pdf.numPages) {
                    out.add(n);
                }
            }
        }
        return out;
    }

    private async syncRenders(): Promise<void> {
        if (this.disposed) {
            return;
        }
        const desired = this.desiredPages();
        for (const n of [...this.canvases.keys()]) {
            if (!desired.has(n)) {
                this.destroyPage(n);
            }
        }
        for (const n of desired) {
            if (!this.canvases.has(n) && !this.inflight.has(n)) {
                await this.renderPage(n);
            }
        }
    }

    private async renderPage(pageNum: number): Promise<void> {
        if (this.disposed || this.canvases.has(pageNum) || this.inflight.has(pageNum)) {
            return;
        }
        this.inflight.add(pageNum);
        let page: PdfJsPage;
        try {
            page = await this.pdf.getPage(pageNum);
        } catch (err) {
            this.inflight.delete(pageNum);
            this.onError(`Failed to load page ${pageNum}: ${String(err)}`);
            return;
        }

        const viewport = page.getViewport({ scale: this.scale });
        const canvas = document.createElement('canvas');
        const outputScale = window.devicePixelRatio || 1;
        canvas.className = 'kc-pdf-canvas';
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
            this.inflight.delete(pageNum);
            page.cleanup();
            this.onError('Canvas 2D context is unavailable.');
            return;
        }

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        const task = page.render({ canvasContext: ctx, viewport, transform, canvas });
        this.tasks.set(pageNum, task);

        try {
            await task.promise;
        } catch (err) {
            this.tasks.delete(pageNum);
            this.inflight.delete(pageNum);
            const cancelled = err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException';
            if (!cancelled) {
                this.onError(`Failed to render page ${pageNum}: ${String(err)}`);
            }
            page.cleanup();
            return;
        }

        this.tasks.delete(pageNum);
        this.inflight.delete(pageNum);
        if (this.disposed) {
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
            return;
        }

        const slot = this.slots[pageNum - 1];
        if (slot) {
            slot.el.replaceChildren(canvas);
            slot.el.style.width = `${Math.floor(viewport.width)}px`;
            slot.el.style.height = `${Math.floor(viewport.height)}px`;
        }
        this.canvases.set(pageNum, canvas);
        page.cleanup();
    }

    private destroyPage(pageNum: number): void {
        this.inflight.delete(pageNum);
        const task = this.tasks.get(pageNum);
        if (task) {
            try {
                task.cancel();
            } catch {
                // already finished
            }
            this.tasks.delete(pageNum);
        }
        const canvas = this.canvases.get(pageNum);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
            canvas.remove();
            this.canvases.delete(pageNum);
        }
        const slot = this.slots[pageNum - 1];
        if (slot) {
            slot.el.replaceChildren();
        }
    }

    private emitCurrentPage(): void {
        const rootRect = this.scrollRoot.getBoundingClientRect();
        let best = this.currentPage;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const slot of this.slots) {
            const rect = slot.el.getBoundingClientRect();
            const dist = Math.abs(rect.top - rootRect.top);
            if (dist < bestDist) {
                bestDist = dist;
                best = slot.pageNum;
            }
        }
        if (best !== this.currentPage) {
            this.currentPage = best;
            this.onPageChange(this.currentPage, this.pdf.numPages);
        }
    }
}
