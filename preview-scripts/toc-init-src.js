/**
 * KC DevKit — Preview Floating TOC (Source)
 *
 * Bundled by esbuild into preview-scripts/toc-init.js.
 * Runs inside the VS Code markdown preview webview (browser context).
 *
 * Features:
 * - Floating panel overlay with toggle/close/refresh
 * - Extracts headings from preview DOM (<h1>–<h6>)
 * - Scrollspy: highlights the current heading while scrolling
 * - Search/filter headings in real-time
 * - Remembers open/closed state across preview refreshes (sessionStorage)
 * - MutationObserver: auto-refreshes when DOM content changes
 * - Keyboard shortcut: Ctrl/Cmd + Shift + T to toggle
 */

(function () {
    'use strict';

    // ── Tunables ────────────────────────────────────────────────
    var DEBOUNCE_REBUILD_MS = 500;
    var SCROLLSPY_THROTTLE_MS = 80;
    var STORAGE_KEY = 'kc-toc-open';

    // ── State ───────────────────────────────────────────────────
    var headings = [];       // Array<{ el: Element, level: number, text: string }>
    var tocItems = [];       // Array<HTMLLIElement>
    var activeIndex = -1;
    var isOpen = false;

    // ── Create DOM structure ────────────────────────────────────
    function createToggleButton() {
        var btn = document.createElement('button');
        btn.id = 'kc-toc-toggle';
        btn.title = 'Toggle Table of Contents (Ctrl+Shift+T)';
        btn.textContent = '\u2630'; // ☰ hamburger
        btn.addEventListener('click', togglePanel);
        document.body.appendChild(btn);
        return btn;
    }

    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'kc-toc-panel';

        // Header
        var header = document.createElement('div');
        header.id = 'kc-toc-header';

        var title = document.createElement('span');
        title.className = 'kc-toc-title';
        title.textContent = 'Table of Contents';

        var refreshBtn = document.createElement('button');
        refreshBtn.title = 'Refresh';
        refreshBtn.textContent = '\u21BB'; // ↻
        refreshBtn.addEventListener('click', function () { rebuildToc(); });

        var closeBtn = document.createElement('button');
        closeBtn.title = 'Close';
        closeBtn.textContent = '\u00D7'; // ×
        closeBtn.addEventListener('click', function () { setOpen(false); });

        header.appendChild(title);
        header.appendChild(refreshBtn);
        header.appendChild(closeBtn);

        // Search input
        var search = document.createElement('input');
        search.id = 'kc-toc-search';
        search.type = 'text';
        search.placeholder = 'Filter headings\u2026';
        search.addEventListener('input', filterItems);

        // List
        var list = document.createElement('ul');
        list.id = 'kc-toc-list';

        // Stats bar
        var stats = document.createElement('div');
        stats.id = 'kc-toc-stats';

        panel.appendChild(header);
        panel.appendChild(search);
        panel.appendChild(list);
        panel.appendChild(stats);
        document.body.appendChild(panel);

        return { panel: panel, list: list, search: search, stats: stats };
    }

    // ── Panel open/close logic ──────────────────────────────────
    function setOpen(open) {
        isOpen = open;
        ui.panel.classList.toggle('open', isOpen);
        toggleBtn.classList.toggle('active', isOpen);
        try { sessionStorage.setItem(STORAGE_KEY, isOpen ? '1' : '0'); } catch (_) { /* noop */ }
        if (isOpen) {
            updateScrollspy();
        }
    }

    function togglePanel() {
        setOpen(!isOpen);
    }

    // ── Build / rebuild heading list ────────────────────────────
    function collectHeadings() {
        headings = [];
        var els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var level = parseInt(el.tagName.charAt(1), 10);
            var text = (el.textContent || '').trim();
            if (text) {
                headings.push({ el: el, level: level, text: text });
                // Ensure heading has an id for scroll targeting
                if (!el.id) {
                    el.id = 'kc-heading-' + i;
                }
            }
        }
    }

    function rebuildToc() {
        collectHeadings();
        var list = ui.list;
        list.innerHTML = '';
        tocItems = [];

        for (var i = 0; i < headings.length; i++) {
            var h = headings[i];
            var li = document.createElement('li');
            li.setAttribute('data-level', String(h.level));

            var a = document.createElement('a');
            a.href = '#' + h.el.id;
            a.textContent = h.text;
            a.title = h.text;
            // Capture index in closure
            (function (idx) {
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    headings[idx].el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Highlight briefly
                    setActiveItem(idx);
                });
            })(i);

            li.appendChild(a);
            list.appendChild(li);
            tocItems.push(li);
        }

        ui.stats.textContent = headings.length + ' headings';
        ui.search.value = '';
        updateScrollspy();
    }

    // ── Search / filter ─────────────────────────────────────────
    function filterItems() {
        var query = (ui.search.value || '').trim().toLowerCase();
        var visible = 0;
        for (var i = 0; i < tocItems.length; i++) {
            var text = headings[i].text.toLowerCase();
            var match = !query || text.indexOf(query) !== -1;
            tocItems[i].classList.toggle('kc-toc-hidden', !match);
            if (match) visible++;
        }
        ui.stats.textContent = visible + ' / ' + headings.length + ' headings';
    }

    // ── Scrollspy ───────────────────────────────────────────────
    function setActiveItem(index) {
        if (activeIndex === index) return;
        if (activeIndex >= 0 && activeIndex < tocItems.length) {
            var prevA = tocItems[activeIndex].querySelector('a');
            if (prevA) prevA.classList.remove('active');
        }
        activeIndex = index;
        if (activeIndex >= 0 && activeIndex < tocItems.length) {
            var curA = tocItems[activeIndex].querySelector('a');
            if (curA) {
                curA.classList.add('active');
                // Scroll TOC list to keep active item visible
                scrollItemIntoView(tocItems[activeIndex]);
            }
        }
    }

    function scrollItemIntoView(li) {
        var list = ui.list;
        var liTop = li.offsetTop - list.offsetTop;
        var liBottom = liTop + li.offsetHeight;
        if (liTop < list.scrollTop) {
            list.scrollTop = liTop - 4;
        } else if (liBottom > list.scrollTop + list.clientHeight) {
            list.scrollTop = liBottom - list.clientHeight + 4;
        }
    }

    function updateScrollspy() {
        if (!isOpen || headings.length === 0) return;

        // Find the heading closest to the top of the viewport
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var bestIndex = 0;
        var offset = 80; // header offset

        for (var i = 0; i < headings.length; i++) {
            var rect = headings[i].el.getBoundingClientRect();
            if (rect.top <= offset) {
                bestIndex = i;
            } else {
                break;
            }
        }
        setActiveItem(bestIndex);
    }

    // ── Throttled scroll handler ────────────────────────────────
    var scrollTimer = null;
    function onScroll() {
        if (scrollTimer) return;
        scrollTimer = setTimeout(function () {
            scrollTimer = null;
            updateScrollspy();
        }, SCROLLSPY_THROTTLE_MS);
    }

    // ── Keyboard shortcut: Ctrl/Cmd + Shift + T ─────────────────
    function onKeydown(e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            togglePanel();
        }
        // Escape closes panel
        if (e.key === 'Escape' && isOpen) {
            setOpen(false);
        }
    }

    // ── MutationObserver: rebuild on DOM change ─────────────────
    var rebuildTimer = null;
    function scheduleRebuild() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(rebuildToc, DEBOUNCE_REBUILD_MS);
    }

    // ── Initialisation ──────────────────────────────────────────
    var toggleBtn;
    var ui;

    function init() {
        toggleBtn = createToggleButton();
        ui = createPanel();

        // Restore open state
        try {
            isOpen = sessionStorage.getItem(STORAGE_KEY) === '1';
        } catch (_) { /* noop */ }
        if (isOpen) {
            ui.panel.classList.add('open');
            toggleBtn.classList.add('active');
        }

        rebuildToc();

        // Events
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('keydown', onKeydown);

        // Watch for DOM changes (markdown preview updates)
        var mo = new MutationObserver(scheduleRebuild);
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // ── Boot ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
