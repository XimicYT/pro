const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

// Helper to determine which upstream domain to use
const getTarget = (req) => {
    const path = req.originalUrl || req.url;
    // 1. Handle the tracking/click domain
    if (path.startsWith('/click/')) {
        return 'https://link.ouiheberg.com';
    }
    // 2. Handle the billing/manager domain
    if (path.includes('manager') || path.startsWith('/store') || path.startsWith('/clientarea') || path.startsWith('/cart') || path.startsWith('/index.php?rp=')) {
        return 'https://manager.ouiheberg.com';
    }
    // 3. Default to the main site
    return 'https://www.ouiheberg.com';
};

app.use('/', proxy(
    getTarget, 
    {
        proxyReqPathResolver: (req) => {
            const path = req.originalUrl || req.url;
            if (path === '/') return '/en/free-minecraft-server';
            return path; 
        },
        
        proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
            proxyReqOpts.headers['accept-encoding'] = 'identity';
            
            // Dynamically set the Host header based on the target we are hitting
            const targetUrl = getTarget(srcReq);
            const targetDomain = targetUrl.replace('https://', '');
            
            proxyReqOpts.headers['host'] = targetDomain;
            proxyReqOpts.headers['origin'] = `https://${targetDomain}`;
            proxyReqOpts.headers['referer'] = `https://${targetDomain}${srcReq.url}`;
            
            return proxyReqOpts;
        },

        userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
            const contentType = proxyRes.headers['content-type'];

            if (contentType && contentType.includes('text/html')) {
                let content = proxyResData.toString('utf8');

                // Broadened Regex to catch 'link.', 'manager.', and 'www.'
                const domainRegex = /https?:\/\/(www\.|manager\.|link\.)?ouiheberg\.com/gi;
                content = content.replace(domainRegex, `https://${RENDER_URL}`);
                
                // Handle escaped slashes often found in JSON/JS responses
                const escapedRegex = /https?:\\\/\\\/(www\.|manager\.|link\.)?ouiheberg\.com/gi;
                content = content.replace(escapedRegex, `https://${RENDER_URL}`);

                const zombieInjection = `
                <script>
                    (function() {
                        const PROXY_URL = 'https://${RENDER_URL}';

                        // Intercept window.open
                        const oldOpen = window.open;
                        window.open = function(url) {
                            if (typeof url === 'string') {
                                url = url.replace(/https?:\/\/(www\.|manager\.|link\.)?ouiheberg\.com/gi, PROXY_URL);
                            }
                            return oldOpen.call(window, url);
                        };

                        // Global link interceptor
                        document.addEventListener('click', function(e) {
                            const target = e.target.closest('a');
                            if (target && target.href) {
                                if (target.href.includes('ouiheberg.com')) {
                                    // Let the natural navigation happen, but ensure the URL is rewritten
                                    target.href = target.href.replace(/https?:\/\/(www\.|manager\.|link\.)?ouiheberg\.com/gi, PROXY_URL);
                                }
                            }
                        }, true);

                        function ensureUI() {
                            if (!document.getElementById('super-debug-console')) {
                                const debugUI = document.createElement('div');
                                debugUI.id = 'super-debug-console';
                                debugUI.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#111;padding:15px;z-index:2147483647;border:2px solid #0f0;border-radius:5px;display:flex;flex-direction:column;gap:10px;';
                                debugUI.innerHTML = \`
                                    <label style="color:#0f0;font-family:monospace;font-size:14px;font-weight:bold;">Manual Proxy Router</label>
                                    <div style="display:flex;gap:5px;">
                                        <input type="text" id="emergency-url" value="/store/hebergement-minecraft-ryzen/freemc" style="width:250px;background:#222;color:#fff;border:1px solid #555;padding:5px;">
                                        <button onclick="window.location.href = document.getElementById('emergency-url').value" style="background:#0f0;color:#000;border:none;padding:5px 10px;cursor:pointer;font-weight:bold;">GO</button>
                                    </div>
                                \`;
                                document.documentElement.appendChild(debugUI);
                            }
                        }
                        setInterval(ensureUI, 1000);
                    })();
                </script>`;
                
                return content + zombieInjection;
            }
            return proxyResData;
        },

        userResHeaderDecorator(headers) {
            delete headers['content-security-policy'];
            delete headers['x-frame-options'];

            // Rewrite Location headers for redirects (Crucial for the 'link' subdomain)
            if (headers.location) {
                headers.location = headers.location.replace(/https?:\/\/(www\.|manager\.|link\.)?ouiheberg\.com/gi, `https://${RENDER_URL}`);
            }
            
            // Cookie Domain Stripping: Making cookies "host-only" so they work on Render
            if (headers['set-cookie']) {
                headers['set-cookie'] = headers['set-cookie'].map(c => 
                    c.replace(/domain=\.?ouiheberg\.com/gi, '') 
                );
            }
            return headers;
        }
    }
));

app.listen(PORT, () => console.log(`Proxy active on port ${PORT}`));