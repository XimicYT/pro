const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_DOMAIN = 'www.ouiheberg.com';
const MANAGER_DOMAIN = 'manager.ouiheberg.com';
const TARGET_PATH = '/en/free-minecraft-server';

app.use('/', proxy((req) => {
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

            // 1. Aggressive Regex: Catches normal URLs AND JSON-escaped URLs (https:\/\/manager...)
            const domainRegex = new RegExp(`https?:(\\/|\\\\\\/)+((www|manager)\\.)?ouiheberg\\.com`, 'gi');
            content = content.replace(domainRegex, `https://${myHost}`);

            // 2. Fix relative paths
            content = content.replace(/(href|src)="(\\\/|\/)(_next|static|assets|en|fr)/g, `$1="https://${myHost}/$3`);

            // 3. THE "NUCLEAR" SCRIPT INJECTION
            const injection = `
            <script>
                (function() {
                    const proxyHost = window.location.origin;

                    // Helper to force URLs to the proxy
                    function fixUrl(url) {
                        if (!url || typeof url !== 'string') return url;
                        return url.replace(/https?:[\\\\/]+(www\\.|manager\\.)?ouiheberg\\.com/gi, proxyHost);
                    }

                    // Helper to neutralize <a> tags
                    function neutralizeLink(node) {
                        if (node.tagName === 'A' && node.href) {
                            if (node.href.includes('ouiheberg.com')) {
                                node.href = fixUrl(node.href);
                            }
                            if (node.getAttribute('target') === '_blank') {
                                node.setAttribute('target', '_self');
                            }
                        }
                    }

                    // A. Neutralize all existing links immediately
                    document.querySelectorAll('a').forEach(neutralizeLink);

                    // B. MutationObserver: Watch for React/Next.js dynamically building the page
                    const observer = new MutationObserver(mutations => {
                        mutations.forEach(mutation => {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === 1) { // If it's an element
                                    if (node.tagName === 'A') neutralizeLink(node);
                                    node.querySelectorAll?.('a').forEach(neutralizeLink);
                                }
                            });
                        });
                    });
                    observer.observe(document.body, { childList: true, subtree: true });

                    // C. Intercept all clicks (in case the observer misses something)
                    document.addEventListener('click', function(e) {
                        const target = e.target.closest('a');
                        if (target && target.href) {
                            target.href = fixUrl(target.href);
                            target.setAttribute('target', '_self');
                        }
                    }, true);

                    // D. Hijack window.open (Stops JS from forcing new tabs)
                    window.open = function(url, name, features) {
                        const safeUrl = fixUrl(url);
                        // Instead of opening a new tab, force the current window to navigate
                        window.location.href = safeUrl;
                        return null; 
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