/**
 * Smoke test: parse the Agent identity conference deck.
 *
 * Usage: node scripts/smoke-ppt.mjs [pptxPath]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const DEFAULT = path.normalize(
    'd:\\pyproject\\llm\\mcp\\researchPaper\\ai_security\\Agent身份治理生态建设.pptx',
);

function fail(message) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
}

const target = process.argv[2] || DEFAULT;
if (!fs.existsSync(target)) {
    fail(`missing ${target}`);
}

const outfile = path.join(ROOT, 'out', 'parsePptx.cjs');
fs.mkdirSync(path.dirname(outfile), { recursive: true });
const esbuild = path.join(ROOT, 'node_modules', '.bin', 'esbuild.cmd');
if (!fs.existsSync(esbuild)) {
    fail('esbuild is not installed');
}
const bundled = spawnSync(
    esbuild,
    [
        path.join(ROOT, 'src', 'ppt', 'parsePptx.ts'),
        '--bundle',
        `--outfile=${outfile}`,
        '--platform=node',
        '--format=cjs',
        '--external:vscode',
    ],
    { stdio: 'inherit', shell: true },
);
if (bundled.status !== 0) {
    fail('bundle parsePptx failed');
}

const { parsePptx } = require(outfile);
const deck = await parsePptx(path.basename(target), fs.readFileSync(target));
const blob = JSON.stringify(deck);
if (deck.slides.length !== 15) {
    fail(`expected 15 slides, got ${deck.slides.length}`);
}
if (!blob.includes('Agent身份治理生态建设')) {
    fail('title text missing');
}
if (!blob.includes('sk_audit')) {
    fail('sk_audit call to action missing');
}
const shaped = deck.slides.filter((slide) => slide.shapes.length >= 8).length;
if (shaped < 15) {
    fail(`only ${shaped} slides have enough shapes`);
}
const evidence = path.join(ROOT, 'docs', 'evidence', 'ppt-preview.html');
fs.mkdirSync(path.dirname(evidence), { recursive: true });
const first = deck.slides[0].shapes
    .flatMap((shape) => shape.runs.map((run) => run.text))
    .filter(Boolean)
    .join('<br/>');
fs.writeFileSync(
    evidence,
    `<!DOCTYPE html><html lang="zh-CN"><meta charset="UTF-8"/><title>ppt smoke</title><body><p>slides=${deck.slides.length}</p><p>${first}</p></body></html>`,
    'utf8',
);
console.log(`OK slides=${deck.slides.length} file=${pathToFileURL(target).href}`);

const legacyPpt = path.join(process.env.TEMP || '', 'kc-ppt-roundtrip', 'deck.ppt');
if (process.platform === 'win32' && fs.existsSync(legacyPpt)) {
    const convFile = path.join(ROOT, 'out', 'convertLegacy.cjs');
    const convBuild = spawnSync(
        esbuild,
        [
            path.join(ROOT, 'src', 'ppt', 'convertLegacy.ts'),
            '--bundle',
            `--outfile=${convFile}`,
            '--platform=node',
            '--format=cjs',
            '--external:vscode',
        ],
        { stdio: 'inherit', shell: true },
    );
    if (convBuild.status !== 0) {
        fail('bundle convertLegacy failed');
    }
    const { convertPptToPptx } = require(convFile);
    const converted = await convertPptToPptx(legacyPpt);
    const legacyDeck = await parsePptx('deck.ppt', converted);
    if (legacyDeck.slides.length !== 15) {
        fail(`legacy ppt expected 15 slides, got ${legacyDeck.slides.length}`);
    }
    if (!JSON.stringify(legacyDeck).includes('Agent身份治理生态建设')) {
        fail('legacy ppt lost the title');
    }
    console.log('OK legacy ppt roundtrip slides=15');
}
