const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

// 1. HELPER: Extract target URL info from the request path
const getTargetInfo = (req) => {
    // Look for the first occurrence of http or https in the path
    const fullPath = req.url.slice(1); 
    const match = fullPath.match(/^https?:\/\/[^/]+/);

    if (match) {
        const targetBase = match[0]; // e.g., https://manager.ouiheberg.com
        const internalPath = fullPath.slice(targetBase.length) || '/'; // e.g., /clientarea.php
        return {
            base: targetBase,
            path: internalPath,
            fullProxyPrefix: `https://${RENDER_URL}/${targetBase}`
        };
    }
    return null; // No valid URL provided
};

// Route for the landing page (when no URL is provided)
app.get('/', (req, res) => {
    if (!getTargetInfo(req)) {
        return res.send(`
            <body style="background:#111;color:#0f0;font-family:monospace;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;">
                <h1>Universal Proxy Active</h1>
                <p>Usage: https://${RENDER_URL}/https://any-website.com</p>
                <input type="text" id="url" placeholder="https://example.com" style="width:300px;padding:10px;background:#222;border:1px solid #0f0;color:#fff;">
                <button onclick="window.location.href='/'+document.getElementById('url').value" style="margin-top:10px;padding:10px 20px;cursor:pointer;">Go</button>
            </body>
        `);
    }
});

app.use('/', (req, res, next) => {
    const info = getTargetInfo(req);
    if (!info) return next();

    return proxy(info.base, {
        proxyReqPathResolver: () => info.path,
        
        proxyReqOptDecorator: (proxyReqOpts) => {
            proxyReqOpts.headers['accept-encoding'] = 'identity';
            proxyReqOpts.headers['host'] = new URL(info.base).host;
            return proxyReqOpts;
        },

        userResDecorator: (proxyRes, proxyResData) => {
            const contentType = proxyRes.headers['content-type'] || '';
            
            if (contentType.includes('text/html')) {
                let content = proxyResData.toString('utf8');

                // REWRITE ALL LINKS: Prepend our proxy URL to everything starting with http
                content = content.replace(/(href|src|action)=["'](https?:\/\/[^"']+)["']/gi, (match, p1, p2) => {
                    return `${p1}="https://${RENDER_URL}/${p2}"`;
                });

                // REWRITE RELATIVE LINKS: Prepend our proxy + target base to internal paths
                // This is what fixes the /clientarea.php issue
                content = content.replace(/(href|src|action)=["']\/([^"']+)["']/gi, (match, p1, p2) => {
                    return `${p1}="${info.fullProxyPrefix}/${p2}"`;
                });

                const zombieInjection = `
                <style>
                    #proxy-status {
                        position: fixed; top: 10px; right: 10px; z-index: 2147483647;
                        background: rgba(0,0,0,0.8); color: #0f0; padding: 8px;
                        border: 1px solid #0f0; font-family: monospace;
                        transition: opacity 0.2s ease, transform 0.2s ease;
                        pointer-events: auto;
                    }
                    /* Disappear when mouse gets close */
                    #proxy-status:hover {
                        opacity: 0 !important;
                        transform: scale(0.8);
                        pointer-events: none;
                    }
                </style>
                <div id="proxy-status">Proxy Active: ${info.base}</div>
                <script>
                    (function() {
                        const PROXY_ROOT = 'https://${RENDER_URL}/';
                        
                        // Intercept all programmatic navigations
                        const originalAssign = window.location.assign;
                        window.location.assign = (url) => {
                            window.location.href = PROXY_ROOT + new URL(url, window.location.href).href;
                        };

                        // Catch clicks on dynamically generated elements
                        document.addEventListener('click', e => {
                            const a = e.target.closest('a');
                            if (a && a.href && !a.href.startsWith(PROXY_ROOT)) {
                                e.preventDefault();
                                window.location.href = PROXY_ROOT + a.href;
                            }
                        }, true);
                    })();
                </script>`;
                return content + zombieInjection;
            }
            return proxyResData;
        },

        userResHeaderDecorator: (headers) => {
            delete headers['content-security-policy'];
            delete headers['x-frame-options'];
            
            // Fix Redirects: Ensure the Location header is wrapped in our proxy
            if (headers.location) {
                // Handle relative redirects
                if (!headers.location.startsWith('http')) {
                    const base = getTargetInfo(req).base;
                    headers.location = `https://${RENDER_URL}/${base}${headers.location}`;
                } else {
                    headers.location = `https://${RENDER_URL}/${headers.location}`;
                }
            }
            
            if (headers['set-cookie']) {
                headers['set-cookie'] = headers['set-cookie'].map(c => c.replace(/domain=[^;]+/i, ''));
            }
            return headers;
        }
    })(req, res, next);
});

app.listen(PORT, () => console.log(`Universal Proxy running on ${PORT}`));