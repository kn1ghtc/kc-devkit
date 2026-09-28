/**
 * Read PPTX (OOXML) into positioned shapes for the preview webview.
 * Legacy .ppt is converted to PPTX before this parser runs.
 */

import JSZip from 'jszip';

import type { PptDeckModel, PptRunModel, PptShapeModel, PptSlideModel } from './protocol';

const SHAPE = /<p:(sp|cxnSp)\b[^>]*>([\s\S]*?)<\/p:\1>/g;

export async function parsePptx(fileName: string, data: Buffer): Promise<PptDeckModel> {
    const zip = await JSZip.loadAsync(data);
    const presentation = await readText(zip, 'ppt/presentation.xml');
    if (!presentation) {
        throw new Error('不是有效的 PPTX：缺少 presentation.xml');
    }
    const size = readSlideSize(presentation);
    const names = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => slideNumber(a) - slideNumber(b));
    if (names.length === 0) {
        throw new Error('PPTX 里没有幻灯片');
    }
    const slides: PptSlideModel[] = [];
    for (const name of names) {
        const xml = await readText(zip, name);
        slides.push(xml ? parseSlide(xml) : { background: '#181E2A', shapes: [] });
    }
    return { fileName, slideCx: size.cx, slideCy: size.cy, slides };
}

function slideNumber(name: string): number {
    const match = name.match(/slide(\d+)\.xml/i);
    return match ? Number(match[1]) : 0;
}

async function readText(zip: JSZip, name: string): Promise<string | undefined> {
    const file = zip.file(name);
    if (!file) {
        return undefined;
    }
    return file.async('string');
}

function readSlideSize(xml: string): { cx: number; cy: number } {
    const tag = xml.match(/<p:sldSz\b[^>]*>/i);
    const cx = Number(attr(tag?.[0] ?? '', 'cx')) || 12192000;
    const cy = Number(attr(tag?.[0] ?? '', 'cy')) || 6858000;
    return { cx, cy };
}

function attr(tag: string, name: string): string | undefined {
    const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    return match?.[1];
}

function parseSlide(xml: string): PptSlideModel {
    const background = /<p:bg\b[\s\S]*?<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/i.exec(xml)?.[1];
    const shapes: PptShapeModel[] = [];
    for (const match of xml.matchAll(SHAPE)) {
        const shape = parseShape(match[2] ?? '');
        if (shape) {
            shapes.push(shape);
        }
    }
    return { background: background ? `#${background}` : '#181E2A', shapes };
}

function parseShape(block: string): PptShapeModel | undefined {
    const xfrm = block.match(/<a:xfrm\b[\s\S]*?<\/a:xfrm>/i)?.[0] ?? '';
    const off = xfrm.match(/<a:off\b[^>]*>/i)?.[0] ?? '';
    const ext = xfrm.match(/<a:ext\b[^>]*>/i)?.[0] ?? '';
    const x = Number(attr(off, 'x'));
    const y = Number(attr(off, 'y'));
    const cx = Number(attr(ext, 'cx'));
    const cy = Number(attr(ext, 'cy'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
        return undefined;
    }
    const spPr = block.split(/<p:txBody\b/i)[0] ?? '';
    const fill = /<a:noFill\s*\/>/i.test(spPr) ? undefined : hexColor(spPr);
    const lnAt = spPr.indexOf('<a:ln');
    const line = lnAt >= 0 ? hexColor(spPr.slice(lnAt)) : undefined;
    const runs = parseRuns(block);
    if (!fill && !line && runs.length === 0) {
        return undefined;
    }
    return { x, y, cx, cy, fill, line, runs };
}

function parseRuns(block: string): PptRunModel[] {
    const body = block.split(/<p:txBody\b/i)[1] ?? '';
    const runs: PptRunModel[] = [];
    for (const part of body.split(/<a:p\b/i).slice(1)) {
        const pieces = [...part.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/gi)].map((item) => decodeXml(item[1] ?? ''));
        const text = pieces.join('');
        if (!text) {
            continue;
        }
        const alignAttr = attr(part.match(/<a:pPr\b[^>]*>/i)?.[0] ?? '', 'algn');
        runs.push({
            text,
            color: `#${hexColor(part) ?? 'E8EFFA'}`,
            sizePt: Number(attr(part.match(/<a:rPr\b[^>]*>/i)?.[0] ?? '', 'sz')) / 100 || 14,
            bold: /\bb="1"/.test(part.slice(0, 400)),
            align: alignAttr === 'ctr' ? 'center' : alignAttr === 'r' ? 'right' : 'left',
        });
    }
    return runs;
}

function hexColor(xml: string): string | undefined {
    const match = xml.match(/<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/i);
    return match?.[1];
}

function decodeXml(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
