const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_DOMAIN = 'www.ouiheberg.com';
const MANAGER_DOMAIN = 'manager.ouiheberg.com';
const TARGET_PATH = '/en/free-minecraft-server';

app.use('/', proxy((req) => {
    // Route traffic based on URL content
    if (req.url.includes('manager') || req.headers.referer?.includes('manager')) {
        return `https://${MANAGER_DOMAIN}`;
    }
    return `https://${MAIN_DOMAIN}`;
}, {
    proxyReqPathResolver: (req) => (req.url === '/' ? TARGET_PATH : req.url),

    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        delete proxyReqOpts.headers['accept-encoding'];
        const currentTarget = srcReq.url.includes('manager') ? MANAGER_DOMAIN : MAIN_DOMAIN;
        proxyReqOpts.headers['host'] = currentTarget;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');

            // 1. Rewrite hardcoded URLs in the HTML
            const domainRegex = new RegExp(`https?://(www\\.|manager\\.)?ouiheberg\\.com`, 'gi');
            content = content.replace(domainRegex, `https://${myHost}`);

            // 2. Fix relative paths for assets
            content = content.replace(/(href|src)="\/(_next|static|assets|en|fr)/g, `$1="https://${myHost}/$2`);

            // 3. THE "MAGIC" SCRIPT INJECTION
            // This script runs on the client side to catch dynamic links
            const injection = `
            <script>
                (function() {
                    // Force all clicks to stay on the proxy
                    document.addEventListener('click', function(e) {
                        const target = e.target.closest('a');
                        if (target && target.href) {
                            // If the link points to the real site, rewrite it to the proxy
                            if (target.href.includes('ouiheberg.com')) {
                                target.href = target.href.replace(/https?:\/\/(www\\.|manager\\.)?ouiheberg\\.com/gi, window.location.origin);
                            }
                            // Force same-tab opening
                            target.setAttribute('target', '_self');
                        }
                    }, true);

                    // Optional: Intercept History API (for Next.js routing)
                    const originalPushState = history.pushState;
                    history.pushState = function() {
                        arguments[2] = arguments[2].replace(/https?:\/\/(www\\.|manager\\.)?ouiheberg\\.com/gi, window.location.origin);
                        return originalPushState.apply(history, arguments);
                    };
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