const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const RENDER_URL = 'pro-z9if.onrender.com';

// Shared logic for both proxies
const createProxyOptions = (targetDomain) => ({
    proxyReqPathResolver: (req) => {
        // 1. If hitting the absolute root of the main site, go to the Minecraft page
        if (targetDomain === 'www.ouiheberg.com' && req.originalUrl === '/') {
            return '/en/free-minecraft-server';
        }
        // 2. FIX FOR 404: Use originalUrl so the /store/ prefix is preserved when sent to the backend
        return req.originalUrl; 
    },
    
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        delete proxyReqOpts.headers['accept-encoding']; // Crucial to prevent gibberish
        proxyReqOpts.headers['host'] = targetDomain;
        proxyReqOpts.headers['origin'] = `https://${targetDomain}`;
        proxyReqOpts.headers['referer'] = `https://${targetDomain}${srcReq.originalUrl}`;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');

            // --- HTML STRING REPLACEMENTS ---
            // Nuke all target="_blank" from orbit in the raw string
            content = content.replace(/target=["']_blank["']/gi, 'target="_self"');
            
            // Hard replace standard domains with your Render URL
            content = content.replace(/https?:\/\/(www\.|manager\.)?ouiheberg\.com/gi, `https://${RENDER_URL}`);
            
            // Hard replace JSON-escaped domains (React/Next.js data blocks)
            content = content.replace(/https?:\\\/\\\/manager\.ouiheberg\.com/gi, `https://${RENDER_URL}`);
            content = content.replace(/https?:\\\/\\\/www\.ouiheberg\.com/gi, `https://${RENDER_URL}`);

            // Fix relative static assets
            content = content.replace(/(href|src)="(\/|_next|static|assets|en|fr)/g, `$1="https://${RENDER_URL}/$2`);

            // --- THE HEAD INJECTION ---
            // Injected into <head> so it runs BEFORE React gets a chance to initialize
            const headInjection = `
            <base target="_self">
            <script>
                (function() {
                    // Override native window.open
                    window.open = function(url, name, features) {
                        const safeUrl = url.replace(/https?:\\/\\/.*ouiheberg\\.com/gi, 'https://${RENDER_URL}');
                        window.location.href = safeUrl;
                        return null;
                    };

                    // Catch ALL mouse interactions before React can trigger its router
                    function killEscapes(e) {
                        const target = e.target.closest('a');
                        if (target && target.href) {
                            if (target.href.includes('hebergement-minecraft-ryzen') || target.href.includes('ouiheberg')) {
                                e.preventDefault();
                                e.stopPropagation();
                                const safeUrl = target.href.replace(/https?:\\/\\/.*ouiheberg\\.com/gi, 'https://${RENDER_URL}');
                                window.location.href = safeUrl;
                            }
                        }
                    }
                    
                    document.addEventListener('click', killEscapes, true);
                    document.addEventListener('mousedown', killEscapes, true); // Catch React fast-clicks
                    document.addEventListener('mouseup', killEscapes, true);
                })();
            </script>`;
            
            // Inject right after the <head> tag opens
            content = content.replace(/<head[^>]*>/i, `$&${headInjection}`);

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
});

// --- THE ROUTING FIX ---
// Explicitly map paths to their specific subdomains so they never 404

const managerProxy = proxy('https://manager.ouiheberg.com', createProxyOptions('manager.ouiheberg.com'));
const mainProxy = proxy('https://www.ouiheberg.com', createProxyOptions('www.ouiheberg.com'));

// 1. Send all Manager/WHMCS paths directly to the manager subdomain
app.use('/store', managerProxy);
app.use('/clientarea', managerProxy);
app.use('/cart', managerProxy);
app.use('/login', managerProxy);
app.use('/assets', managerProxy); // Just in case CSS comes from here

// 2. Send everything else to the main website
app.use('/', mainProxy);

app.listen(PORT, () => console.log(`Proxy active on port ${PORT}`));