const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // 1. Handle our "Silent Tunnel" for external scripts/subdomains
    // If the path starts with our prefix /s/ followed by a domain
    if (req.url.startsWith('/s/')) {
        const parts = req.url.split('/s/')[1]; // Get everything after /s/
        const targetUrl = parts.startsWith('http') ? parts : `https://${parts}`;
        
        // Return only the host to express-http-proxy
        const urlObj = new URL(targetUrl);
        return urlObj.origin; 
    }
    
    // 2. Default routing for Seedloaf
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('clerk')) {
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
        // If it's a tunneled request, strip our prefix and return the real path
        if (req.url.startsWith('/s/')) {
            const parts = req.url.split('/s/')[1];
            const urlObj = new URL(parts.startsWith('http') ? parts : `https://${parts}`);
            return urlObj.pathname + urlObj.search;
        }
        return req.url; // Normal path
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Rewrite all https links to use our /s/ tunnel
            // Example: https://google.com -> https://yourhost.com
            const linkPattern = /(https?:\/\/)(?!.*onrender\.com)([a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+)/g;
            content = content.replace(linkPattern, `https://${myHost}/s/$1$2`);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        if (headers.location) {
            // Tunnel redirects as well
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
    console.log(`Silent Tunnel active on port ${PORT}`);
});
