/**
 * markdown-it-line-number — Code Block Line Number Plugin
 *
 * Adds a `line-numbers` class to `<pre>` elements so that CSS counters
 * can render line numbers alongside code. Zero JS overhead in the preview.
 */

/**
 * Registers the line-number fence renderer on a markdown-it instance.
 * Wraps the default fence output in a container with the `line-numbers` class.
 *
 * @param md - The markdown-it instance provided by VS Code
 */
export function lineNumberPlugin(md: any): void {
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

        // Skip mermaid blocks — they are handled by the mermaid plugin
        if (info === 'mermaid') {
            return defaultFence(tokens, idx, options, env, self);
        }

        const rawHtml: string = defaultFence(tokens, idx, options, env, self);

        // Wrap <pre> output with line-numbers class
        return rawHtml.replace(
            /^<pre/,
            '<pre class="line-numbers"',
        );
    };
}
