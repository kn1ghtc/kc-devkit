/**
 * KC DevKit — Mermaid Preview Script (Source)
 *
 * This file is bundled by esbuild into preview-scripts/mermaid-init.js.
 * It runs in the VS Code markdown preview webview (browser context).
 *
 * mermaid.min.js is loaded as a separate previewScript alongside this file.
 * VS Code uses <script async> for previewScripts, so load order is NOT
 * guaranteed. This script polls for globalThis.mermaid before initialising.
 *
 * CRITICAL DESIGN NOTE (v1.2.0):
 * The markdown-it plugin outputs `class="kc-mermaid"` instead of `class="mermaid"`.
 * This prevents mermaid's built-in `startOnLoad:true` auto-processor from finding
 * and processing our elements before we call `initialize({startOnLoad:false})`.
 * Without this, the auto-processor runs on DOMContentLoaded, replaces innerHTML
 * with SVG, and our subsequent render attempt reads CSS garbage from textContent.
 *
 * Rendering strategy (v1.2.0):
 * - Async-safe: waits for mermaid library to become available
 * - IntersectionObserver: only render diagrams within/near viewport
 * - Debounced MutationObserver: batch DOM changes before scanning
 * - Serial render queue with concurrency=1 to avoid webview OOM
 * - Each diagram error is isolated; does not block remaining renders
 */

(function () {
    'use strict';

    // ── Tunables ────────────────────────────────────────────────
    var SELECTOR_PENDING = '.kc-mermaid[data-mermaid-source="true"]';
    var VIEWPORT_MARGIN  = '200px';   // pre-render zone around viewport
    var DEBOUNCE_MS      = 300;       // mutation observer debounce
    var POLL_INTERVAL_MS = 50;        // how often to check for mermaid global
    var POLL_TIMEOUT_MS  = 30000;     // give up after 30 s

    /**
     * Wait for globalThis.mermaid to become available.
     * VS Code loads previewScripts with <script async>, so the 2.8 MB
     * mermaid.min.js may finish loading after this 1.6 KB script.
     */
    function waitForMermaid(callback) {
        if (globalThis.mermaid) {
            callback(globalThis.mermaid);
            return;
        }
        var elapsed = 0;
        var timer = setInterval(function () {
            if (globalThis.mermaid) {
                clearInterval(timer);
                callback(globalThis.mermaid);
            } else {
                elapsed += POLL_INTERVAL_MS;
                if (elapsed >= POLL_TIMEOUT_MS) {
                    clearInterval(timer);
                    console.error('[KC DevKit] Timed out waiting for mermaid library (' + POLL_TIMEOUT_MS + ' ms)');
                }
            }
        }, POLL_INTERVAL_MS);
    }

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

    // ── Boot: wait for mermaid then initialise ──────────────────
    waitForMermaid(function (mermaid) {

        /** Counter for generating unique mermaid element IDs. */
        var renderCounter = 0;

        /** Serialize renders — only one mermaid.render() call at a time. */
        var renderQueue = Promise.resolve();

        function enqueueRender(el) {
            renderQueue = renderQueue.then(function () {
                return renderSingle(el);
            });
        }

        /** Render a single .kc-mermaid element. */
        async function renderSingle(el) {
            if (!el.hasAttribute('data-mermaid-source') || !el.isConnected) return;

            var source = decodeHtmlEntities(el.textContent || '');
            if (!source.trim()) return;

            var id = 'kc-mermaid-' + Date.now() + '-' + (renderCounter++);

            try {
                var result = await mermaid.render(id, source);
                el.innerHTML = result.svg;
                el.removeAttribute('data-mermaid-source');
                el.setAttribute('data-processed', 'true');
            } catch (err) {
                el.removeAttribute('data-mermaid-source');
                el.classList.add('kc-mermaid-error');
                el.textContent = 'Mermaid diagram error: ' + (err.message || String(err));
                console.error('[KC DevKit] Mermaid render error:', err);
            }
        }

        // ── Mermaid initialisation ──────────────────────────────
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: getMermaidTheme(),
            fontFamily: 'var(--vscode-editor-font-family, "Segoe UI", sans-serif)',
            logLevel: 'error',
        });

        // ── IntersectionObserver: lazy render on viewport entry ─
        var io = new IntersectionObserver(
            function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        var el = entries[i].target;
                        io.unobserve(el);
                        enqueueRender(el);
                    }
                }
            },
            { rootMargin: VIEWPORT_MARGIN }
        );

        /** Scan DOM for new unprocessed .kc-mermaid elements and observe them. */
        function observeNewElements() {
            var elements = document.querySelectorAll(SELECTOR_PENDING);
            for (var i = 0; i < elements.length; i++) {
                io.observe(elements[i]);
            }
        }

        // ── Debounced MutationObserver ──────────────────────────
        var debounceTimer = null;
        var mutationObserver = new MutationObserver(function () {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(observeNewElements, DEBOUNCE_MS);
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // ── Initial scan ────────────────────────────────────────
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeNewElements);
        } else {
            observeNewElements();
        }
    });
})();
