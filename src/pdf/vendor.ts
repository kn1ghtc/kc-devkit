/**
 * Resolve packaged pdf.js assets under vendor/pdfjs (copied by scripts/build.ps1).
 */

import * as fs from 'fs';
import * as path from 'path';

const PDF_LIB_CANDIDATES = ['pdf.min.mjs', 'pdf.mjs', 'pdf.min.js', 'pdf.js'];
const WORKER_CANDIDATES = [
    'pdf.worker.min.mjs',
    'pdf.worker.mjs',
    'pdf.worker.min.js',
    'pdf.worker.js',
];

export interface ResolvedPdfJsVendor {
    rootDir: string;
    pdfJsFile: string;
    workerFile: string;
    cmapsDir: string;
    standardFontsDir: string;
}

function firstExistingFile(dir: string, names: string[]): string | undefined {
    for (const name of names) {
        const full = path.join(dir, name);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            return name;
        }
    }
    return undefined;
}

function dirHasEntries(dir: string): boolean {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return false;
    }
    return fs.readdirSync(dir).length > 0;
}

/**
 * Locate copied pdf.js legacy build files. Returns undefined if the vendor tree
 * is incomplete (build.ps1 should have failed in that case).
 */
export function resolveVendorPdfJs(extensionPath: string): ResolvedPdfJsVendor | undefined {
    const rootDir = path.join(extensionPath, 'vendor', 'pdfjs');
    const pdfJsFile = firstExistingFile(rootDir, PDF_LIB_CANDIDATES);
    const workerFile = firstExistingFile(rootDir, WORKER_CANDIDATES);
    const cmapsDir = path.join(rootDir, 'cmaps');
    const standardFontsDir = path.join(rootDir, 'standard_fonts');

    if (!pdfJsFile || !workerFile) {
        return undefined;
    }
    if (!dirHasEntries(cmapsDir) || !dirHasEntries(standardFontsDir)) {
        return undefined;
    }

    return { rootDir, pdfJsFile, workerFile, cmapsDir, standardFontsDir };
}

export function ensureTrailingSlash(url: string): string {
    return url.endsWith('/') ? url : `${url}/`;
}
