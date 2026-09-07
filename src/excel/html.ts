/**
 * Excel preview webview HTML (CSP + chrome + module bootstrap).
 */

import { randomBytes } from 'crypto';

export interface ExcelHtmlModel {
    nonce: string;
    csp: string;
    cssHref: string;
    viewerHref: string;
}

export function createExcelNonce(): string {
    return randomBytes(16).toString('hex');
}

export function buildExcelCsp(cspSource: string, nonce: string): string {
    return [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${cspSource}`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `font-src ${cspSource}`,
        `img-src ${cspSource} data:`,
        "connect-src 'none'",
        "frame-src 'none'",
    ].join('; ');
}

function attr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildExcelPreviewHtml(model: ExcelHtmlModel): string {
    const viewerImport = JSON.stringify(model.viewerHref);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(model.csp)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${attr(model.cssHref)}" />
  <title>Excel Preview</title>
</head>
<body class="kc-excel-body">
  <div class="kc-excel-toolbar" role="toolbar" aria-label="Excel preview">
    <span class="kc-excel-title" id="kc-excel-title">Spreadsheet</span>
    <span class="kc-excel-sep"></span>
    <label class="kc-excel-search">
      <span>筛选</span>
      <input type="search" id="kc-excel-filter" placeholder="包含文字则显示该行" />
    </label>
    <span class="kc-excel-hint" id="kc-excel-hint">只读预览 · 公式以缓存值显示</span>
  </div>
  <div class="kc-excel-error" id="kc-excel-error" hidden></div>
  <div class="kc-excel-grid-wrap" id="kc-excel-grid-wrap"></div>
  <div class="kc-excel-tabs" id="kc-excel-tabs" role="tablist" aria-label="Sheets"></div>
  <script type="module" nonce="${model.nonce}">
    import { bootExcelViewer } from ${viewerImport};
    bootExcelViewer();
  </script>
</body>
</html>`;
}

export function buildExcelErrorHtml(nonce: string, csp: string, cssHref: string, message: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(csp)}" />
  <link rel="stylesheet" href="${attr(cssHref)}" />
  <title>Excel Preview</title>
</head>
<body class="kc-excel-body">
  <div class="kc-excel-error" id="kc-excel-error">${attr(message)}</div>
  <script nonce="${nonce}"></script>
</body>
</html>`;
}
