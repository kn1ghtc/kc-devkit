/**
 * PPT preview webview HTML.
 */

import { randomBytes } from 'crypto';

export interface PptHtmlModel {
    nonce: string;
    csp: string;
    cssHref: string;
    viewerHref: string;
}

export function createPptNonce(): string {
    return randomBytes(16).toString('hex');
}

export function buildPptCsp(cspSource: string, nonce: string): string {
    return [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${cspSource}`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} data:`,
        "connect-src 'none'",
        "frame-src 'none'",
    ].join('; ');
}

function attr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildPptPreviewHtml(model: PptHtmlModel): string {
    const viewerImport = JSON.stringify(model.viewerHref);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(model.csp)}" />
  <link rel="stylesheet" href="${attr(model.cssHref)}" />
  <title>PPT Preview</title>
</head>
<body class="kc-ppt-body">
  <div class="kc-ppt-toolbar" role="toolbar" aria-label="PPT preview">
    <button type="button" id="kc-ppt-prev">上一页</button>
    <span id="kc-ppt-page">1 / 1</span>
    <button type="button" id="kc-ppt-next">下一页</button>
    <span class="kc-ppt-title" id="kc-ppt-title"></span>
  </div>
  <div class="kc-ppt-error" id="kc-ppt-error" hidden></div>
  <div class="kc-ppt-stage-wrap" id="kc-ppt-stage-wrap">
    <div class="kc-ppt-stage" id="kc-ppt-stage"></div>
  </div>
  <script type="module" nonce="${model.nonce}">
    import { bootPptViewer } from ${viewerImport};
    bootPptViewer();
  </script>
</body>
</html>`;
}

export function buildPptErrorHtml(nonce: string, csp: string, cssHref: string, message: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${attr(csp)}" />
  <link rel="stylesheet" href="${attr(cssHref)}" />
  <title>PPT Preview</title>
</head>
<body class="kc-ppt-body">
  <div class="kc-ppt-error">${attr(message)}</div>
</body>
</html>`;
}
