const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // 1. Silent Tunnel Resolver
    if (req.url.startsWith('/s/')) {
        const parts = req.url.split('/s/')[1];
        try {
            const targetUrl = parts.startsWith('http') ? parts : `https://${parts}`;
            return new URL(targetUrl).origin;
        } catch (e) { return `https://${MAIN_TARGET}`; }
    }
    // 2. Auth Subdomain Routing
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('clerk') || req.url.includes('accounts')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding'];
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        proxyReqOpts.headers['origin'] = `https://${MAIN_TARGET}`;
        return proxyReqOpts;
    },

    proxyReqPathResolver: function (req) {
        if (req.url.startsWith('/s/')) {
            const parts = req.url.split('/s/')[1];
            try {
                const urlObj = new URL(parts.startsWith('http') ? parts : `https://${parts}`);
                return urlObj.pathname + urlObj.search;
            } catch (e) { return req.url; }
        }
        return req.url;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Rewrite all https links to use our /s/ tunnel
            const linkPattern = /(https?:\/\/)(?!.*onrender\.com)([a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+)/g;
            content = content.replace(linkPattern, `https://${myHost}/s/$1$2`);

            // CLERK FIX: Inject a "Soft Spoof" that doesn't crash the browser
            // We tell Clerk its "frontendApi" and "proxyUrl" are YOUR host.
            const clerkFix = `
                <script>
                    window.__CLERK_FRONTEND_API__ = "${myHost}";
                    window.__CLERK_PROXY_URL__ = "https://${myHost}";
                    
                    // Prevent Clerk from redirecting away if it feels "lost"
                    const originalPush = window.history.pushState;
                    window.history.pushState = function() {
                        if (arguments[2] && arguments[2].includes('${MAIN_TARGET}')) {
                            arguments[2] = arguments[2].replace(/https?:\\/\\/.*?${MAIN_TARGET}/, '');
                        }
                        return originalPush.apply(window.history, arguments);
                    };
                </script>
            `;
            return content.replace('<head>', '<head>' + clerkFix);
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        if (headers.location) {
            headers.location = headers.location.replace(/(https?:\/\/)([a-zA-Z0-9-._~]+)/gi, `https://${myHost}/s/$1$2`);
        }
        
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => c.replace(/domain=\.?seedloaf\.com/gi, `domain=${myHost}`));
        }
        return headers;
    },

    changeOrigin: true
}));

app.listen(PORT, () => {
    console.log(`Clerk-Bypass Proxy active on port ${PORT}`);
});
