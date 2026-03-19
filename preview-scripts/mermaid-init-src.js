/**
 * KC DevKit — Mermaid Preview Script (Source)
 *
 * This file is bundled by esbuild into preview-scripts/mermaid-init.js.
 * It runs in the VS Code markdown preview webview (browser context).
 *
 * Responsibilities:
 * 1. Initialize mermaid with strict security settings
 * 2. Detect VS Code theme (dark/light) and set mermaid theme accordingly
 * 3. Observe DOM mutations to render new .mermaid elements
 * 4. Decode HTML-escaped mermaid source before rendering
 */

import mermaid from 'mermaid';

(function () {
    'use strict';

    /** Detect VS Code theme from body class. */
    function getMermaidTheme() {
        if (document.body.classList.contains('vscode-dark') ||
            document.body.classList.contains('vscode-high-contrast')) {
            return 'dark';
        }
        return 'default';
    }

    /** Decode HTML entities back to raw text for mermaid parsing. */
    function decodeHtmlEntities(str) {
        var textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    }

    /** Counter for generating unique mermaid element IDs. */
    var renderCounter = 0;

    /** Render all unprocessed .mermaid elements. */
    async function renderMermaidElements() {
        var elements = document.querySelectorAll('.mermaid[data-mermaid-source="true"]');
        if (elements.length === 0) return;

        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var source = decodeHtmlEntities(el.textContent || '');
            if (!source.trim()) continue;

            var id = 'mermaid-' + Date.now() + '-' + (renderCounter++);

            try {
                var result = await mermaid.render(id, source);
                el.innerHTML = result.svg;
                el.removeAttribute('data-mermaid-source');
                el.setAttribute('data-processed', 'true');
            } catch (err) {
                el.removeAttribute('data-mermaid-source');
                el.classList.add('mermaid-error');
                el.textContent = 'Mermaid diagram error: ' + (err.message || String(err));
                console.error('[KC DevKit] Mermaid render error:', err);
            }
        }
    }

    // Initialize mermaid
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: getMermaidTheme(),
        fontFamily: 'var(--vscode-editor-font-family, "Segoe UI", sans-serif)',
        logLevel: 'error',
    });

    // Observe for new .mermaid elements (preview content updates)
    var observer = new MutationObserver(function () {
        renderMermaidElements();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // Initial render
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            renderMermaidElements();
        });
    } else {
        renderMermaidElements();
    }
})();
