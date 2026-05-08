const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

// 1. HELPER: Extract target from the request
const getTargetInfo = (req) => {
    const rawPath = req.url.slice(1); // Remove leading slash
    
    // Check if the path looks like a full URL
    if (rawPath.startsWith('http')) {
        try {
            const url = new URL(rawPath);
            return {
                protocol: url.protocol,
                host: url.host,
                path: url.pathname + url.search,
                base: `${url.protocol}//${url.host}`
            };
        } catch (e) {
            // Fallback if URL parsing fails
        }
    }
    
    // Default fallback to OuiHeberg if no valid URL is in the path
    return {
        protocol: 'https:',
        host: 'www.ouiheberg.com',
        path: req.url === '/' ? '/en/free-minecraft-server' : req.url,
        base: 'https://www.ouiheberg.com'
    };
};

app.use('/', (req, res, next) => {
    const info = getTargetInfo(req);
    
    return proxy(info.base, {
        proxyReqPathResolver: () => info.path,
        
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers['accept-encoding'] = 'identity';
            proxyReqOpts.headers['host'] = info.host;
            proxyReqOpts.headers['origin'] = info.base;
            proxyReqOpts.headers['referer'] = info.base;
            return proxyReqOpts;
        },

        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            const contentType = proxyRes.headers['content-type'] || '';
            if (contentType.includes('text/html') || contentType.includes('application/javascript')) {
                let content = proxyResData.toString('utf8');

                // REWRITE LOGIC: Find any absolute URL pointing to the target and point it to US
                // This handles the "ANY link" requirement
                const targetRegex = new RegExp(`https?://${info.host.replace(/\./g, '\\.')}`, 'gi');
                content = content.replace(targetRegex, `https://${RENDER_URL}`);

                // ZOMBIE SCRIPT: Universal version
                if (contentType.includes('text/html')) {
                    const zombieInjection = `
                    <script>
                        (function() {
                            const MY_PROXY = 'https://${RENDER_URL}/';
                            
                            // Intercept all clicks globally
                            document.addEventListener('click', e => {
                                const a = e.target.closest('a');
                                if (a && a.href && !a.href.startsWith(window.location.origin)) {
                                    e.preventDefault();
                                    // Append the destination to our proxy URL
                                    window.location.href = MY_PROXY + a.href;
                                }
                            }, true);

                            // Keep the UI Overlay
                            function ensureUI() {
                                if (document.getElementById('proxy-ui')) return;
                                const div = document.createElement('div');
                                div.id = 'proxy-ui';
                                div.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2147483647;background:#000;color:#0f0;padding:10px;border:1px solid #0f0;font-family:monospace;';
                                div.innerHTML = 'Proxy Active: ' + window.location.pathname;
                                document.documentElement.appendChild(div);
                            }
                            setInterval(ensureUI, 1000);
                        })();
                    </script>`;
                    return content + zombieInjection;
                }
                return content;
            }
            return proxyResData;
        },

        userResHeaderDecorator: (headers) => {
            delete headers['content-security-policy'];
            delete headers['x-frame-options'];
            
            if (headers.location) {
                // If the server tries to redirect, we wrap that redirect in our proxy URL
                headers.location = `https://${RENDER_URL}/${headers.location}`;
            }
            
            if (headers['set-cookie']) {
                headers['set-cookie'] = headers['set-cookie'].map(c => c.replace(/domain=[^;]+/i, ''));
            }
            return headers;
        }
    })(req, res, next);
});

app.listen(PORT, () => console.log(`Universal Proxy on port ${PORT}`));