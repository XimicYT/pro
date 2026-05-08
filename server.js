const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

// --- HELPER: BULLETPROOF TARGET EXTRACTION ---
const getTargetInfo = (req) => {
    const urlPart = req.url.slice(1);
    const match = urlPart.match(/^(https?:\/\/)([^/]+)(.*)$/);
    
    if (match) {
        return {
            protocol: match[1],
            host: match[2],
            path: match[3] || '/',
            base: match[1] + match[2],
            fullTarget: match[0]
        };
    }
    return null;
};

// Landing Page
app.get('/', (req, res) => {
    if (!getTargetInfo(req)) {
        return res.send(`
            <body style="background:#050505;color:#0f0;font-family:monospace;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;">
                <h1 style="text-shadow: 0 0 10px #0f0;">CORE-PROXY v2.0</h1>
                <div style="border:1px solid #0f0;padding:20px;background:#000;box-shadow:0 0 20px rgba(0,255,0,0.2);">
                    <input type="text" id="url" placeholder="https://google.com" style="width:400px;padding:12px;background:#111;border:1px solid #333;color:#0f0;outline:none;">
                    <button onclick="window.location.href='/'+document.getElementById('url').value" style="padding:12px 20px;background:#0f0;color:#000;border:none;cursor:pointer;font-weight:bold;">INITIALIZE</button>
                </div>
                <p style="margin-top:20px;color:#444;">Format: https://${RENDER_URL}/https://target.com</p>
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
            proxyReqOpts.headers['accept-encoding'] = 'identity'; // No compression so we can edit
            proxyReqOpts.headers['host'] = info.host;
            proxyReqOpts.headers['origin'] = info.base;
            proxyReqOpts.headers['referer'] = info.base;
            return proxyReqOpts;
        },

        userResDecorator: (proxyRes, proxyResData) => {
            const contentType = proxyRes.headers['content-type'] || '';
            let content = proxyResData.toString('utf8');

            if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
                
                // 1. DYNAMIC REWRITING (Regex on Steroids)
                // Rewrite absolute URLs
                const absoluteRegex = new RegExp(`(https?:\/\/)(www\\.)?${info.host.replace(/\./g, '\\.')}`, 'gi');
                content = content.replace(absoluteRegex, `https://${RENDER_URL}/$1$2${info.host}`);

                // Rewrite root-relative paths (/assets/js -> /https://target.com/assets/js)
                content = content.replace(/(href|src|action|data-src)=["']\/([^"']+)["']/gi, (m, p1, p2) => {
                    return `${p1}="https://${RENDER_URL}/${info.base}/${p2}"`;
                });

                // 2. CSS-SPECIFIC FIXES (url('/img.png'))
                if (contentType.includes('text/css')) {
                    content = content.replace(/url\(["']?\/([^"']+)["']?\)/gi, `url(https://${RENDER_URL}/${info.base}/$1)`);
                }

                // 3. THE "GHOST ENGINE" INJECTION (HTML Only)
                if (contentType.includes('text/html')) {
                    const ghostEngine = `
                    <style>
                        #proxy-shelf {
                            position: fixed; top: 0; left: 50%; transform: translateX(-50%);
                            z-index: 2147483647; background: rgba(0,0,0,0.9);
                            color: #0f0; font-family: monospace; padding: 5px 15px;
                            border: 1px solid #0f0; border-top: none;
                            border-radius: 0 0 8px 8px; font-size: 12px;
                            transition: all 0.3s ease; opacity: 0.8; pointer-events: auto;
                        }
                        #proxy-shelf:hover { opacity: 0; transform: translateX(-50%) translateY(-100%); pointer-events: none; }
                    </style>
                    <div id="proxy-shelf">TUNNEL ACTIVE: ${info.host} (Hover to hide)</div>
                    
                    <script>
                    (function() {
                        const P_ROOT = 'https://${RENDER_URL}/';
                        const T_BASE = '${info.base}';

                        // Hijack AJAX/Fetch
                        const _fetch = window.fetch;
                        window.fetch = function() {
                            if (typeof arguments[0] === 'string' && !arguments[0].startsWith('http') && arguments[0].startsWith('/')) {
                                arguments[0] = P_ROOT + T_BASE + arguments[0];
                            }
                            return _fetch.apply(this, arguments);
                        };

                        // Hijack History (Prevents URL bar from "escaping" the proxy)
                        const _pushState = history.pushState;
                        history.pushState = function(state, title, url) {
                            const newUrl = url.startsWith('http') ? P_ROOT + url : P_ROOT + T_BASE + (url.startsWith('/') ? '' : '/') + url;
                            return _pushState.apply(history, [state, title, newUrl]);
                        };

                        // Global Interceptor for dynamic elements
                        document.addEventListener('click', e => {
                            const a = e.target.closest('a');
                            if (a && a.href && !a.href.startsWith(P_ROOT)) {
                                e.preventDefault();
                                window.location.href = P_ROOT + a.href;
                            }
                        }, true);
                    })();
                    </script>`;
                    content = content.replace('</body>', ghostEngine + '</body>');
                }
            }
            return content;
        },

        userResHeaderDecorator: (headers) => {
            // Kill security headers that block proxying
            delete headers['content-security-policy'];
            delete headers['content-security-policy-report-only'];
            delete headers['x-frame-options'];
            delete headers['x-content-type-options'];

            // Perfect Redirects
            if (headers.location) {
                if (!headers.location.startsWith('http')) {
                    // It's a relative redirect
                    headers.location = `https://${RENDER_URL}/${info.base}${headers.location.startsWith('/') ? '' : '/'}${headers.location}`;
                } else {
                    // It's an absolute redirect
                    headers.location = `https://${RENDER_URL}/${headers.location}`;
                }
            }
            
            // Cookie Domain Logic (Force host-only)
            if (headers['set-cookie']) {
                headers['set-cookie'] = headers['set-cookie'].map(c => 
                    c.replace(/domain=[^;]+/i, '').replace(/Secure;/gi, '')
                );
            }
            return headers;
        }
    })(req, res, next);
});

app.listen(PORT, () => console.log('Croxy-Level Proxy Online.'));