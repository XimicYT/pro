const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // If the request is for /sign-up or /login, automatically target the accounts subdomain
    if (req.url.includes('sign-up') || req.url.includes('login') || req.url.includes('auth')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    // 1. STRIP COMPRESSION: Stops the "cursed symbols" by forcing plain text
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding'];
        // Fake the referer so Seedloaf thinks the request is coming from their own site
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        return proxyReqOpts;
    },

    decompress: true,

    // 2. REWRITE LINKS: Catch every possible seedloaf subdomain
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            const myHost = userReq.get('host');

            // This regex catches: seedloaf.com, accounts.seedloaf.com, and others
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'g');
            return content.replace(pattern, `https://${myHost}`);
        }
        return proxyResData;
    },

    // 3. FIX REDIRECTS: Ensure logins don't bounce you back to the real site
    userResHeaderDecorator(headers, userReq, userRes, proxyRes, proxyReq) {
        if (headers.location) {
            const myHost = userReq.get('host');
            const pattern = new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'g');
            headers.location = headers.location.replace(pattern, `https://${myHost}`);
        }
        // Fix Cookies: Ensures your browser accepts their login cookies
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(cookie => 
                cookie.replace(/domain=\.?seedloaf\.com/gi, `domain=${userReq.get('host')}`)
            );
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Subdomain-Fixed Proxy active on port ${PORT}`);
});
