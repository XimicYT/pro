const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

app.use('/', proxy(
    (req) => {
        const path = req.originalUrl || req.url;
        if (path.includes('manager') || path.startsWith('/store') || path.startsWith('/clientarea') || path.startsWith('/cart')) {
            return 'https://manager.ouiheberg.com';
        }
        return 'https://www.ouiheberg.com';
    }, 
    {
        proxyReqPathResolver: (req) => {
            const path = req.originalUrl || req.url;
            if (path === '/') return '/en/free-minecraft-server';
            return path; 
        },
        
        proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
            // FORCE the server to send plain text HTML so we can inject our script
            proxyReqOpts.headers['accept-encoding'] = 'identity';
            
            const path = srcReq.originalUrl || srcReq.url;
            const isManager = path.includes('manager') || path.startsWith('/store') || path.startsWith('/clientarea') || path.startsWith('/cart');
            const targetDomain = isManager ? 'manager.ouiheberg.com' : 'www.ouiheberg.com';
            
            proxyReqOpts.headers['host'] = targetDomain;
            proxyReqOpts.headers['origin'] = `https://${targetDomain}`;
            proxyReqOpts.headers['referer'] = `https://${targetDomain}${path}`;
            
            return proxyReqOpts;
        },

        userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
            const contentType = proxyRes.headers['content-type'];

            if (contentType && contentType.includes('text/html')) {
                let content = proxyResData.toString('utf8');

                // Basic string replacements
                content = content.replace(/https?:\/\/(www\.|manager\.)?ouiheberg\.com/gi, `https://${RENDER_URL}`);
                content = content.replace(/https?:\\\/\\\/manager\.ouiheberg\.com/gi, `https://${RENDER_URL}`);
                content = content.replace(/https?:\\\/\\\/www\.ouiheberg\.com/gi, `https://${RENDER_URL}`);

                // THE ZOMBIE SCRIPT
                const zombieInjection = `
                <script>
                    (function() {
                        const PROXY_URL = 'https://${RENDER_URL}';

                        // 1. Force all window.open calls to use the current window
                        window.open = function(url) {
                            let safeUrl = url || '';
                            if (typeof safeUrl === 'string') {
                                safeUrl = safeUrl.replace(/https?:\\/\\/(www\\.|manager\\.)?ouiheberg\\.com/gi, PROXY_URL);
                            }
                            window.location.href = safeUrl; 
                            return null;
                        };

                        // 2. Kill click events dead
                        document.addEventListener('click', function(e) {
                            const target = e.target.closest('a') || e.target.closest('button');
                            if (target && target.href) {
                                if (target.href.includes('ouiheberg') || target.href.includes('freemc')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const safeUrl = target.href.replace(/https?:\\/\\/.*ouiheberg\\.com/gi, PROXY_URL);
                                    window.location.href = safeUrl;
                                }
                            }
                        }, true); // Capture phase!

                        // 3. The Unkillable UI Overlay
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
                                
                                // Append to documentElement (html tag) instead of body to survive React wipes
                                document.documentElement.appendChild(debugUI);
                            }
                        }

                        // Run immediately, and then keep checking every 500ms
                        ensureUI();
                        setInterval(ensureUI, 500);
                    })();
                </script>`;
                
                // Append directly to the end of the HTML document
                return content + zombieInjection;
            }
            return proxyResData;
        },

        userResHeaderDecorator(headers) {
            delete headers['content-security-policy'];
            delete headers['x-frame-options'];

            if (headers.location) {
                headers.location = headers.location.replace(/https?:\/\/(www\.|manager\.)?ouiheberg\.com/gi, `https://${RENDER_URL}`);
            }
            
            if (headers['set-cookie']) {
                headers['set-cookie'] = headers['set-cookie'].map(c => 
                    c.replace(/domain=\.?ouiheberg\.com/gi, `domain=${RENDER_URL}`)
                );
            }
            return headers;
        }
    }
));

app.listen(PORT, () => console.log(`Proxy active on port ${PORT}`));