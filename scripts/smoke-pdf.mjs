/**
 * Node smoke test for pdf.js CJK text + canvas glyph rendering.
 *
 * Usage:
 *   node scripts/smoke-pdf.mjs [pdfPath]
 *   node scripts/smoke-pdf.mjs -- <pdfPath>
 *
 * Exit 0 if CJK Unified Ideographs are extracted AND (PNG is non-blank OR canvas skip).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_PDF = path.normalize(
    'd:\\pyproject\\llm\\mcp\\researchPaper\\ai_security\\text-copyright-signature-watermark\\latex_build_cn\\main.pdf',
);

const CJK_UNIFIED = /[\u4E00-\u9FFF]/;
const EVIDENCE_PNG = path.join(ROOT, 'docs', 'evidence', 'page1.png');

const PDF_LIB_CANDIDATES = ['pdf.min.mjs', 'pdf.mjs', 'pdf.min.js', 'pdf.js'];
const WORKER_CANDIDATES = [
    'pdf.worker.min.mjs',
    'pdf.worker.mjs',
    'pdf.worker.min.js',
    'pdf.worker.js',
];

function firstExisting(dir, names) {
    for (const name of names) {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) {
            return full;
        }
    }
    return undefined;
}

function parsePdfArg(argv) {
    const args = argv.slice(2).filter((a) => a !== '--');
    return args[0] || DEFAULT_PDF;
}

function fail(message) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
}

function dirUrl(dir) {
    const href = pathToFileURL(dir).href;
    return href.endsWith('/') ? href : `${href}/`;
}

function findPdfJsRoot() {
    const vendor = path.join(ROOT, 'vendor', 'pdfjs');
    const nmLegacy = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
    const nmBuild = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build');
    const nmCmaps = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'cmaps');
    const nmFonts = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'standard_fonts');
    const vendorCmaps = path.join(vendor, 'cmaps');
    const vendorFonts = path.join(vendor, 'standard_fonts');

    const vendorLib = firstExisting(vendor, PDF_LIB_CANDIDATES);
    if (vendorLib && fs.existsSync(vendorCmaps) && fs.existsSync(vendorFonts)) {
        return {
            lib: vendorLib,
            worker: firstExisting(vendor, WORKER_CANDIDATES),
            cmaps: vendorCmaps,
            fonts: vendorFonts,
            source: 'vendor/pdfjs',
        };
    }

    const nmLib = firstExisting(nmLegacy, PDF_LIB_CANDIDATES) || firstExisting(nmBuild, PDF_LIB_CANDIDATES);
    if (!nmLib || !fs.existsSync(nmCmaps) || !fs.existsSync(nmFonts)) {
        fail('pdfjs-dist not found (run npm install / scripts/build.ps1)');
    }
    return {
        lib: nmLib,
        worker: firstExisting(nmLegacy, WORKER_CANDIDATES) || firstExisting(nmBuild, WORKER_CANDIDATES),
        cmaps: nmCmaps,
        fonts: nmFonts,
        source: 'node_modules/pdfjs-dist',
    };
}

function collectTextAndFonts(textContent) {
    const chunks = [];
    const fontNames = new Set();
    const items = Array.isArray(textContent.items) ? textContent.items : [];
    for (const item of items) {
        if (item && typeof item.str === 'string') {
            chunks.push(item.str);
        }
        if (item && typeof item.fontName === 'string') {
            fontNames.add(item.fontName);
        }
    }
    const styles = textContent.styles && typeof textContent.styles === 'object' ? textContent.styles : {};
    for (const [id, style] of Object.entries(styles)) {
        const family = style && typeof style.fontFamily === 'string' ? style.fontFamily : '';
        fontNames.add(family ? `${id} (${family})` : id);
    }
    return { text: chunks.join(''), fontNames: [...fontNames] };
}

function snippetAroundCjk(text) {
    const match = text.match(CJK_UNIFIED);
    if (!match || match.index === undefined) {
        return '';
    }
    const start = Math.max(0, match.index - 20);
    const end = Math.min(text.length, match.index + 40);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isNonBlankImage(data, width, height) {
    let dark = 0;
    for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a > 8 && (r < 250 || g < 250 || b < 250)) {
            dark += 1;
        }
    }
    const sampled = Math.floor((width * height) / 4);
    return dark > Math.min(80, Math.max(20, sampled * 0.001));
}

class NodeCanvasFactory {
    constructor(createCanvas) {
        this.createCanvas = createCanvas;
    }
    create(width, height) {
        const canvas = this.createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
        return { canvas, context: canvas.getContext('2d') };
    }
    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = Math.max(1, Math.ceil(width));
        canvasAndContext.canvas.height = Math.max(1, Math.ceil(height));
    }
    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

async function tryRenderPng(pdfjs, doc, canvasFactory) {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    await page.render({
        canvasContext: canvasAndContext.context,
        canvas: canvasAndContext.canvas,
        viewport,
    }).promise;
    const ctx = canvasAndContext.context;
    const image = ctx.getImageData(0, 0, canvasAndContext.canvas.width, canvasAndContext.canvas.height);
    if (!isNonBlankImage(image.data, canvasAndContext.canvas.width, canvasAndContext.canvas.height)) {
        page.cleanup();
        fail('PNG render looks blank (all white / transparent)');
    }
    fs.mkdirSync(path.dirname(EVIDENCE_PNG), { recursive: true });
    const buffer = canvasAndContext.canvas.toBuffer('image/png');
    fs.writeFileSync(EVIDENCE_PNG, buffer);
    page.cleanup();
    return EVIDENCE_PNG;
}

async function main() {
    const pdfPath = path.resolve(parsePdfArg(process.argv));
    if (!fs.existsSync(pdfPath)) {
        fail(`PDF not found: ${pdfPath}`);
    }

    const assets = findPdfJsRoot();
    console.log(`pdf.js source: ${assets.source}`);
    console.log(`lib: ${assets.lib}`);
    console.log(`pdf: ${pdfPath}`);

    const pdfjs = await import(pathToFileURL(assets.lib).href);
    if (assets.worker) {
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(assets.worker).href;
    }

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const baseOptions = {
        data,
        cMapUrl: dirUrl(assets.cmaps),
        cMapPacked: true,
        standardFontDataUrl: dirUrl(assets.fonts),
        isEvalSupported: false,
        verbosity: 0,
    };

    // Text extraction (cmaps). FontFace is a browser API; Node uses path outlines below.
    const loadingTask = pdfjs.getDocument({
        ...baseOptions,
        disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    console.log(`pages: ${doc.numPages}`);

    let combined = '';
    const fonts = new Set();
    const maxPages = Math.min(doc.numPages, 4);
    for (let n = 1; n <= maxPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const extracted = collectTextAndFonts(content);
        combined += extracted.text;
        extracted.fontNames.forEach((f) => fonts.add(f));
        page.cleanup();
    }

    if (!CJK_UNIFIED.test(combined)) {
        fail('no CJK Unified Ideographs in extracted text (cmaps/text layer failed)');
    }

    const snippet = snippetAroundCjk(combined);
    console.log(`CJK snippet: ${snippet}`);
    console.log(`fonts (${fonts.size}):`);
    for (const name of [...fonts].slice(0, 40)) {
        console.log(`  - ${name}`);
    }

    let pngStatus = 'skipped';
    try {
        const canvasMod = await import('@napi-rs/canvas');
        if (canvasMod.DOMMatrix && typeof globalThis.DOMMatrix === 'undefined') {
            globalThis.DOMMatrix = canvasMod.DOMMatrix;
        }
        if (canvasMod.Path2D && typeof globalThis.Path2D === 'undefined') {
            globalThis.Path2D = canvasMod.Path2D;
        }
        const factory = new NodeCanvasFactory(canvasMod.createCanvas);
        const pngPath = await tryRenderPng(pdfjs, doc, factory);
        pngStatus = pngPath;
        console.log(`PNG: ${pngPath}`);
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`SKIP PNG: ${reason}`);
        pngStatus = `skipped (${reason})`;
    }

    await doc.destroy();
    console.log('SMOKE PASS: CJK text assertion ok');
    console.log(`SMOKE PNG: ${pngStatus}`);
}

main().catch((err) => {
    fail(err instanceof Error ? err.stack || err.message : String(err));
});
