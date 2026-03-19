/**
 * markdown-it-mermaid — Mermaid Diagram Plugin
 *
 * Intercepts fenced code blocks with language `mermaid` and wraps them
 * in a `<div class="kc-mermaid">` element. We use `kc-mermaid` instead
 * of `mermaid` to prevent the mermaid library's built-in startOnLoad
 * auto-processing from interfering with our controlled rendering flow.
 * The preview script handles initialization, rendering, and error display.
 *
 * Security: securityLevel is enforced in the preview script, not here.
 * This plugin only produces safe HTML wrappers.
 */

/**
 * Registers the mermaid fence renderer on a markdown-it instance.
 * Replaces the default `fence` renderer to detect `mermaid` code blocks
 * and wrap their content in a renderable div.
 *
 * @param md - The markdown-it instance provided by VS Code
 */
export function mermaidPlugin(md: any): void {
    const defaultFence =
        md.renderer.rules.fence ||
        function (
            tokens: any[],
            idx: number,
            options: any,
            _env: any,
            self: any,
        ) {
            return self.renderToken(tokens, idx, options);
        };

    md.renderer.rules.fence = function (
        tokens: any[],
        idx: number,
        options: any,
        env: any,
        self: any,
    ) {
        const token = tokens[idx];
        const info = token.info ? token.info.trim().toLowerCase() : '';

        if (info === 'mermaid') {
            const content = escapeHtml(token.content);
            return (
                `<div class="kc-mermaid" data-mermaid-source="true">` +
                `${content}</div>\n`
            );
        }

        return defaultFence(tokens, idx, options, env, self);
    };
}

/**
 * Escapes HTML special characters to prevent XSS in mermaid source.
 * The preview script will decode and parse the mermaid syntax.
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
