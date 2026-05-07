const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_DOMAIN = 'www.ouiheberg.com';
const MANAGER_DOMAIN = 'manager.ouiheberg.com';
const TARGET_PATH = '/en/free-minecraft-server';

app.use('/', proxy((req) => {
    // --- FIX 1: ROUTING AWARENESS ---
    // If the path starts with /store, we MUST route to the manager domain.
    if (
        req.url.includes('manager') || 
        req.url.startsWith('/store') || 
        req.url.startsWith('/clientarea') ||
        req.headers.referer?.includes('manager') ||
        req.headers.referer?.includes('/store')
    ) {
        return `https://${MANAGER_DOMAIN}`;
    }
    return `https://${MAIN_DOMAIN}`;
}, {
    proxyReqPathResolver: (req) => (req.url === '/' ? TARGET_PATH : req.url),

    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        delete proxyReqOpts.headers['accept-encoding'];
        
        const isManager = srcReq.url.includes('manager') || srcReq.url.startsWith('/store');
        const currentTarget = isManager ? MANAGER_DOMAIN : MAIN_DOMAIN;
        
        proxyReqOpts.headers['host'] = currentTarget;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');

            // Strip hardcoded domain URLs
            const domainRegex = new RegExp(`https?:(\\/|\\\\\\/)+((www|manager)\\.)?ouiheberg\\.com`, 'gi');
            content = content.replace(domainRegex, `https://${myHost}`);

            // --- FIX 2: DIRECT INPUT OVERLAY & REACT KILLER ---
            const injection = `
            <script>
                (function() {
                    // A. THE REACT KILLER
                    // The 'true' at the end makes this run in the Capture Phase, 
                    // meaning it intercepts the click BEFORE React's internal routing sees it.
                    document.addEventListener('click', function(e) {
                        const target = e.target.closest('a');
                        if (target) {
                            const href = target.getAttribute('href') || '';
                            // If they click the stubborn link...
                            if (href.includes('hebergement-minecraft-ryzen') || href.includes('freemc')) {
                                e.preventDefault();     // Stop new tab
                                e.stopPropagation();    // Kill React's event listener entirely
                                
                                // Force navigation locally
                                window.location.href = '/store/hebergement-minecraft-ryzen/freemc';
                            }
                        }
                    }, true);

                    // B. THE DIRECT INPUT UI
                    // A floating box in the bottom right corner to manually force navigation
                    window.addEventListener('load', function() {
                        const floater = document.createElement('div');
                        floater.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#111;border:2px solid #444;padding:15px;z-index:2147483647;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:10px;font-family:sans-serif;';
                        floater.innerHTML = \`
                            <label style="color:#fff;font-size:12px;font-weight:bold;">Direct Proxy Navigator:</label>
                            <div style="display:flex;gap:5px;">
                                <input type="text" id="proxy-direct-url" value="/store/hebergement-minecraft-ryzen/freemc" style="padding:8px;width:300px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
                                <button onclick="window.location.href = document.getElementById('proxy-direct-url').value" style="padding:8px 15px;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Go</button>
                            </div>
                        \`;
                        document.body.appendChild(floater);
                    });
                })();
            </script>`;
            
            content = content.replace('</body>', `${injection}</body>`);
            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        delete headers['content-security-policy'];
        delete headers['x-frame-options'];

        if (headers.location) {
            headers.location = headers.location.replace(/https?:\/\/(www\\.|manager\\.)?ouiheberg\\.com/gi, `https://${myHost}`);
        }
        
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => 
                c.replace(/domain=\.?ouiheberg\.com/gi, `domain=${myHost}`)
            );
        }
        return headers;
    }
}));

app.listen(PORT, () => console.log(`Proxy active on port ${PORT}`));