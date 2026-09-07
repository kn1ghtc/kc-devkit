'use strict';

/**
 * Make Node http/https (and ovsx/follow-redirects) honor HTTPS_PROXY.
 * Corporate networks cannot connect to Fastly/open-vsx.org directly.
 */
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const proxyUrl = (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ''
).trim();

if (!proxyUrl) {
    return;
}

function loadHttpsProxyAgent() {
    const candidates = [
        'https-proxy-agent',
        path.join(__dirname, '..', 'node_modules', 'https-proxy-agent'),
    ];
    for (const id of candidates) {
        try {
            const mod = require(id);
            return mod.HttpsProxyAgent || mod;
        } catch {
            // try next
        }
    }
    process.stderr.write('[node-env-proxy-preload] https-proxy-agent not found; skip\n');
    return null;
}

const HttpsProxyAgent = loadHttpsProxyAgent();
if (!HttpsProxyAgent) {
    return;
}

const agent = new HttpsProxyAgent(proxyUrl);

function hostnameOf(options) {
    if (!options) {
        return '';
    }
    if (typeof options === 'string') {
        try {
            return new URL(options).hostname;
        } catch {
            return '';
        }
    }
    if (options instanceof URL) {
        return options.hostname;
    }
    return String(options.hostname || options.host || '').split(':')[0];
}

function shouldBypass(hostname) {
    if (!hostname) {
        return false;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
    }
    const raw = (process.env.NO_PROXY || process.env.no_proxy || '').trim();
    if (!raw || raw === '://:') {
        return false;
    }
    const host = hostname.toLowerCase();
    return raw.split(',').some((entry) => {
        const item = entry.trim().toLowerCase();
        if (!item) {
            return false;
        }
        if (item.startsWith('.')) {
            return host.endsWith(item) || host === item.slice(1);
        }
        if (item.startsWith('*.')) {
            return host.endsWith(item.slice(1));
        }
        return host === item;
    });
}

function injectAgent(options) {
    if (!options || typeof options !== 'object' || options instanceof URL) {
        return options;
    }
    if (options.agent || options.createConnection) {
        return options;
    }
    if (shouldBypass(hostnameOf(options))) {
        return options;
    }
    options.agent = agent;
    return options;
}

function wrap(orig) {
    return function patchedRequest(...args) {
        if (args.length === 0) {
            return orig.apply(this, args);
        }
        const first = args[0];
        if (typeof first === 'string' || first instanceof URL) {
            const second = args[1];
            if (second && typeof second === 'object' && typeof second !== 'function') {
                injectAgent(second);
            } else if (!shouldBypass(hostnameOf(first))) {
                args.splice(1, 0, { agent });
            }
        } else if (first && typeof first === 'object') {
            injectAgent(first);
        }
        return orig.apply(this, args);
    };
}

http.request = wrap(http.request);
https.request = wrap(https.request);
http.get = wrap(http.get);
https.get = wrap(https.get);
