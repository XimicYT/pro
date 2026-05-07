const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

app.use('/', proxy(
    // 1. DYNAMIC TARGETING: Decide which server to hit without stripping the URL path
    (req) => {
        const path = req.originalUrl || req.url;
        if (path.includes('manager') || path.startsWith('/store') || path.startsWith('/clientarea') || path.startsWith('/cart')) {
            return 'https://manager.ouiheberg.com';
        }
        return 'https://www.ouiheberg.com';
    }, 
    {
        // 2. PATH RESOLVER: Pass the exact path, never let Express strip it
        proxyReqPathResolver: (req) => {
            const path = req.originalUrl || req.url;
            if (path === '/') return '/en/free-minecraft-server';
            return path; // Keeps /store/... completely intact!
        },
        
        proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
            delete proxyReqOpts.headers['accept-encoding'];
            
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

                // Hard string replacements for known domains
                content = content.replace(/https?:\/\/(www\.|manager\.)?ouiheberg\.com/gi, `https://${RENDER_URL}`);
                content = content.replace(/https?:\\\/\\\/manager\.ouiheberg\.com/gi, `https://${RENDER_URL}`);
                content = content.replace(/https?:\\\/\\\/www\.ouiheberg\.com/gi, `https://${RENDER_URL}`);

                // --- THE ULTIMATE PROTOTYPE OVERRIDE & DEBUG TOOL ---
                const headInjection = `
                <base target="_self">
                <script>
                    (function() {
                        const PROXY_URL = 'https://${RENDER_URL}';

                        // 1. OVERRIDE NATIVE DOM APIs (Stops React from building new tabs)
                        const originalSetAttribute = Element.prototype.setAttribute;
                        Element.prototype.setAttribute = function(name, value) {
                            if (name.toLowerCase() === 'target' && value === '_blank') {
                                value = '_self'; // Override target="_blank" globally at the browser engine level
                            }
                            if (name.toLowerCase() === 'href' && typeof value === 'string') {
                                value = value.replace(/https?:\\/\\/(www\\.|manager\\.)?ouiheberg\\.com/gi, PROXY_URL);
                            }
                            return originalSetAttribute.call(this, name, value);
                        };

                        // 2. OVERRIDE WINDOW.OPEN
                        window.open = function(url) {
                            let safeUrl = url || '';
                            if (typeof safeUrl === 'string') {
                                safeUrl = safeUrl.replace(/https?:\\/\\/(www\\.|manager\\.)?ouiheberg\\.com/gi, PROXY_URL);
                            }
                            window.location.href = safeUrl; 
                            return null;
                        };

                        // 3. SUPER DEBUG TOOL
                        window.addEventListener('load', function() {
                            const debugUI = document.createElement('div');
                            debugUI.style.cssText = 'position:fixed;bottom:10px;left:10px;width:350px;height:250px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;z-index:2147483647;padding:10px;overflow-y:auto;border:2px solid #0f0;border-radius:5px;pointer-events:none;';
                            debugUI.id = 'super-debug-console';
                            
                            // Make it so you can interact with the debug input but click through the background
                            debugUI.innerHTML = \`
                                <div style="pointer-events:auto;margin-bottom:10px;display:flex;gap:5px;">
                                    <input type="text" id="emergency-url" value="/store/hebergement-minecraft-ryzen/freemc" style="flex:1;background:#222;color:#fff;border:1px solid #555;padding:4px;font-size:11px;">
                                    <button onclick="window.location.href = document.getElementById('emergency-url').value" style="background:#0f0;color:#000;border:none;padding:4px 8px;cursor:pointer;font-weight:bold;">GO</button>
                                </div>
                                <div id="debug-log">== SUPER DEBUG ACTIVE ==<br></div>
                            \`;
                            document.body.appendChild(debugUI);

                            function logInfo(msg) {
                                const logBox = document.getElementById('debug-log');
                                if(logBox) {
                                    logBox.innerHTML += \`> \${msg}<br>\`;
                                    document.getElementById('super-debug-console').scrollTop = document.getElementById('super-debug-console').scrollHeight;
                                }
                            }

                            // Capture ALL mouse events
                            document.addEventListener('mousedown', function(e) {
                                const target = e.target.closest('a') || e.target.closest('button');
                                if (target) {
                                    logInfo('INTERACTION: ' + target.tagName + ' clicked');
                                    const href = target.getAttribute('href') || 'No HREF';
                                    logInfo('TARGET HREF: ' + href);
                                    
                                    if (target.tagName === 'A') {
                                        target.setAttribute('target', '_self'); // Force self again
                                        if (href.includes('hebergement-minecraft-ryzen') || href.includes('freemc')) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            logInfo('REACT BYPASSED. FORCING REDIRECT.');
                                            window.location.href = '/store/hebergement-minecraft-ryzen/freemc';
                                        }
                                    }
                                }
                            }, true);
                        });
                    })();
                </script>`;
                
                // Inject at the very top of the head
                if (content.match(/<head[^>]*>/i)) {
                    content = content.replace(/<head[^>]*>/i, `$&${headInjection}`);
                } else {
                    content = headInjection + content;
                }

                return content;
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