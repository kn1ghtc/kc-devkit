/**
 * markdown-it-katex — KaTeX Math Formula Plugin (Server-Side Rendering)
 *
 * Adds inline math (`$...$`) and block math (`$$...$$`) parsing rules to
 * markdown-it. Formulas are rendered to HTML on the extension host using
 * `katex.renderToString()` — this is a KEY performance advantage over
 * client-side rendering: zero JS execution in the preview webview for math.
 *
 * Security: trust=false, throwOnError=false to prevent XSS and crashes.
 */

import * as katex from 'katex';

const KATEX_OPTIONS: katex.KatexOptions = {
    throwOnError: false,
    trust: false,
    output: 'html',
    strict: false,
};

/**
 * Registers inline math and block math rules on a markdown-it instance.
 *
 * @param md - The markdown-it instance provided by VS Code
 */
export function katexPlugin(md: any): void {
    md.inline.ruler.after('escape', 'math_inline', mathInlineRule);
    md.block.ruler.before(
        'fence',
        'math_block',
        mathBlockRule,
        { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
    );

    md.renderer.rules.math_inline = renderMathInline;
    md.renderer.rules.math_block = renderMathBlock;
}

/**
 * Inline parsing rule for `$...$` math expressions.
 * Scans for matching `$` delimiters on the same line.
 * Rejects `$$` (block delimiters) and empty content.
 */
function mathInlineRule(state: any, silent: boolean): boolean {
    if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) {
        return false;
    }

    // Reject $$ (block math delimiter)
    if (state.src.charCodeAt(state.pos + 1) === 0x24) {
        return false;
    }

    const start = state.pos + 1;
    // Reject if content starts with space (allows literal $)
    if (start < state.posMax && state.src.charCodeAt(start) === 0x20) {
        return false;
    }

    let end = start;
    while (end < state.posMax) {
        const ch = state.src.charCodeAt(end);
        if (ch === 0x5c /* \ */) {
            end += 2; // skip escaped character
            continue;
        }
        if (ch === 0x24 /* $ */) {
            // Reject if content ends with space
            if (end > start && state.src.charCodeAt(end - 1) === 0x20) {
                end++;
                continue;
            }
            break;
        }
        end++;
    }

    if (end >= state.posMax) {
        return false;
    }

    const content = state.src.slice(start, end);
    if (content.length === 0) {
        return false;
    }

    if (!silent) {
        const token = state.push('math_inline', 'math', 0);
        token.content = content;
        token.markup = '$';
    }

    state.pos = end + 1;
    return true;
}

/**
 * Block parsing rule for `$$...$$` math expressions.
 * Handles both multi-line and single-line block math.
 */
function mathBlockRule(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean,
): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (pos + 1 >= max) {
        return false;
    }

    if (
        state.src.charCodeAt(pos) !== 0x24 ||
        state.src.charCodeAt(pos + 1) !== 0x24
    ) {
        return false;
    }

    // Check for single-line block: $$content$$
    const lineContent = state.src.slice(pos + 2, max).trim();
    if (lineContent.length > 0 && lineContent.endsWith('$$')) {
        if (silent) {
            return true;
        }
        const mathContent = lineContent.slice(0, -2).trim();
        if (mathContent.length > 0) {
            const token = state.push('math_block', 'math', 0);
            token.block = true;
            token.content = mathContent;
            token.markup = '$$';
            token.map = [startLine, startLine + 1];
            state.line = startLine + 1;
            return true;
        }
    }

    // Multi-line block: find closing $$
    let nextLine = startLine + 1;
    let found = false;

    while (nextLine < endLine) {
        const linePos =
            state.bMarks[nextLine] + state.tShift[nextLine];
        const lineMax = state.eMarks[nextLine];
        const lineText = state.src.slice(linePos, lineMax).trim();

        if (lineText === '$$') {
            found = true;
            break;
        }
        nextLine++;
    }

    if (!found) {
        return false;
    }

    if (silent) {
        return true;
    }

    const content = state.getLines(
        startLine + 1,
        nextLine,
        state.tShift[startLine],
        false,
    );

    const token = state.push('math_block', 'math', 0);
    token.block = true;
    token.content = content.trim();
    token.markup = '$$';
    token.map = [startLine, nextLine + 1];

    state.line = nextLine + 1;
    return true;
}

/**
 * Renders an inline math token to HTML via katex.renderToString().
 */
function renderMathInline(tokens: any[], idx: number): string {
    const content = tokens[idx].content;
    try {
        return katex.renderToString(content, {
            ...KATEX_OPTIONS,
            displayMode: false,
        });
    } catch {
        return `<span class="katex-error" title="KaTeX parse error">${escapeHtml(content)}</span>`;
    }
}

/**
 * Renders a block math token to HTML via katex.renderToString().
 */
function renderMathBlock(tokens: any[], idx: number): string {
    const content = tokens[idx].content;
    try {
        return (
            '<div class="katex-block">' +
            katex.renderToString(content, {
                ...KATEX_OPTIONS,
                displayMode: true,
            }) +
            '</div>\n'
        );
    } catch {
        return `<div class="katex-block katex-error" title="KaTeX parse error"><pre>${escapeHtml(content)}</pre></div>\n`;
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
