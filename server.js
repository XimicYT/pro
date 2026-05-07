const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // If the path contains a full URL (like from our wildcard rewriter), use that instead
    if (req.url.startsWith('/proxy-h/')) {
        return req.url.split('/proxy-h/')[1];
    }
    
    // Default routing
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

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // FIX 1: Remove the broken 'redefine property: location' script
            // FIX 2: Wildcard Link Hijacking
            // This turns ANY https link (even external ones) into a proxied link
            // Example: https://setuptrust.com -> https://your-render-url/proxy-h/https://setuptrust.com
            const linkPattern = /(https?:\/\/)(?!.*onrender\.com)([a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+)/g;
            content = content.replace(linkPattern, `https://${myHost}/proxy-h/$1$2`);

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
            headers.location = headers.location.replace(/(https?:\/\/)([a-zA-Z0-9-._~]+)/gi, `https://${myHost}/proxy-h/$1$2`);
        }
        
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => c.replace(/domain=\.?seedloaf\.com/gi, `domain=${myHost}`));
        }
        return headers;
    },

    changeOrigin: true
}));

app.listen(PORT, () => {
    console.log(`Wildcard Proxy active on port ${PORT}`);
});
