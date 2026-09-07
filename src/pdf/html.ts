/**
 * PDF preview webview HTML (CSP, toolbar chrome, module bootstrap).
 */

import { createHash, randomBytes } from 'crypto';

export interface PdfHtmlModel {
    nonce: string;
    csp: string;
    cssHref: string;
    viewerHref: string;
    pdfJsHref: string;
    workerHref: string;
}

export function createNonce(): string {
    return randomBytes(16).toString('hex');
}

export function buildPdfCsp(cspSource: string, nonce: string): string {
    return [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${cspSource} 'wasm-unsafe-eval'`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `font-src ${cspSource} data: blob:`,
        `img-src ${cspSource} blob: data:`,
        `connect-src ${cspSource}`,
        `worker-src ${cspSource} blob:`,
        "child-src blob:",
        "frame-src 'none'",
    ].join('; ');
}

function attr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Stable cache-busting token from file mtime + size (fallback: hash of path).
 */
export function revisionToken(fsPath: string, mtimeMs: number, size: number): string {
    const hash = createHash('sha1').update(`${fsPath}|${mtimeMs}|${size}`).digest('hex').slice(0, 12);
    return hash;
}

export function buildPdfPreviewHtml(model: PdfHtmlModel): string {
    const pdfJsImport = JSON.stringify(model.pdfJsHref);
    const viewerImport = JSON.stringify(model.viewerHref);
    const workerUrl = JSON.stringify(model.workerHref);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(model.csp)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${attr(model.cssHref)}" />
  <title>PDF Preview</title>
</head>
<body class="kc-pdf-body">
  <div class="kc-pdf-toolbar" role="toolbar" aria-label="PDF preview">
    <button type="button" class="kc-pdf-btn" id="kc-pdf-prev" title="Previous page">Prev</button>
    <button type="button" class="kc-pdf-btn" id="kc-pdf-next" title="Next page">Next</button>
    <span class="kc-pdf-indicator" id="kc-pdf-page-indicator">– / –</span>
    <span class="kc-pdf-sep"></span>
    <button type="button" class="kc-pdf-btn" id="kc-pdf-zoom-out" title="Zoom out">−</button>
    <button type="button" class="kc-pdf-btn" id="kc-pdf-zoom-in" title="Zoom in">+</button>
    <button type="button" class="kc-pdf-btn" id="kc-pdf-fit-width" title="Fit width">Fit width</button>
    <button type="button" class="kc-pdf-btn" id="kc-pdf-fit-page" title="Fit page">Fit page</button>
  </div>
  <div class="kc-pdf-error" id="kc-pdf-error" hidden></div>
  <div class="kc-pdf-scroll" id="kc-pdf-scroll">
    <div class="kc-pdf-pages" id="kc-pdf-pages"></div>
  </div>
  <script type="module" nonce="${model.nonce}">
    import * as pdfjsLib from ${pdfJsImport};
    import { bootPdfViewer } from ${viewerImport};
    bootPdfViewer({ pdfjs: pdfjsLib, workerUrl: ${workerUrl} });
  </script>
</body>
</html>`;
}

export function buildPdfErrorHtml(nonce: string, csp: string, cssHref: string, message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(csp)}" />
  <link rel="stylesheet" href="${attr(cssHref)}" />
  <title>PDF Preview</title>
</head>
<body class="kc-pdf-body">
  <div class="kc-pdf-error" id="kc-pdf-error">${attr(message)}</div>
  <script nonce="${nonce}"></script>
</body>
</html>`;
}
