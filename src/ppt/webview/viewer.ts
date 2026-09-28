/**
 * PPT preview webview. Positions shapes from the host model.
 */

import type { HostToWebview, PptDeckModel, PptSlideModel } from '../protocol';

let deck: PptDeckModel | undefined;
let index = 0;

export function bootPptViewer(): void {
    const vscode = acquireVsCodeApi();
    const stage = document.getElementById('kc-ppt-stage');
    const page = document.getElementById('kc-ppt-page');
    const title = document.getElementById('kc-ppt-title');
    const error = document.getElementById('kc-ppt-error');
    const prev = document.getElementById('kc-ppt-prev');
    const next = document.getElementById('kc-ppt-next');
    if (!stage || !page || !title || !error || !prev || !next) {
        vscode.postMessage({ type: 'error', message: 'PPT preview DOM is incomplete.' });
        return;
    }

    const render = (): void => {
        if (!deck || deck.slides.length === 0) {
            stage.innerHTML = '';
            return;
        }
        index = Math.max(0, Math.min(index, deck.slides.length - 1));
        page.textContent = `${index + 1} / ${deck.slides.length}`;
        title.textContent = deck.fileName;
        drawSlide(stage, deck, deck.slides[index]);
    };

    prev.addEventListener('click', () => {
        index -= 1;
        render();
    });
    next.addEventListener('click', () => {
        index += 1;
        render();
    });
    window.addEventListener('resize', render);
    window.addEventListener('message', (event: MessageEvent<HostToWebview>) => {
        const message = event.data;
        if (!message || typeof message !== 'object') {
            return;
        }
        if (message.type === 'hostError') {
            error.hidden = false;
            error.textContent = message.message;
            return;
        }
        if (message.type === 'init' || message.type === 'reload') {
            error.hidden = true;
            deck = message.deck;
            if (message.type === 'init') {
                index = 0;
            }
            render();
        }
    });
    vscode.postMessage({ type: 'ready' });
}

function drawSlide(stage: HTMLElement, model: PptDeckModel, slide: PptSlideModel): void {
    const wrap = stage.parentElement;
    const maxWidth = Math.max((wrap?.clientWidth ?? 960) - 32, 320);
    const maxHeight = Math.max((wrap?.clientHeight ?? 640) - 16, 240);
    const aspect = model.slideCx / model.slideCy;
    let width = maxWidth;
    let height = width / aspect;
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
    }
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    stage.style.background = slide.background;
    stage.replaceChildren();
    const scale = width / model.slideCx;
    for (const shape of slide.shapes) {
        const node = document.createElement('div');
        node.className = 'kc-ppt-shape';
        node.style.left = `${shape.x * scale}px`;
        node.style.top = `${shape.y * scale}px`;
        node.style.width = `${Math.max(shape.cx * scale, 1)}px`;
        node.style.height = `${Math.max(shape.cy * scale, 1)}px`;
        if (shape.fill) {
            node.style.background = `#${shape.fill}`;
        }
        if (shape.line) {
            node.style.border = `1px solid #${shape.line}`;
        }
        if (shape.runs.length > 0) {
            const first = shape.runs[0];
            node.style.color = first.color;
            node.style.fontWeight = first.bold ? '700' : '400';
            node.style.textAlign = first.align;
            node.style.fontSize = `${Math.max(first.sizePt * (width / (model.slideCx / 914400)) / 72, 8)}px`;
            node.textContent = shape.runs.map((run) => run.text).join('\n');
        }
        stage.appendChild(node);
    }
}

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
