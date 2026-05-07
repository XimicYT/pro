const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // DYNAMIC TARGET RESOLUTION:
    // If the path starts with /sign-up or /login, route to the accounts subdomain
    if (req.url.startsWith('/sign-up') || req.url.startsWith('/login')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        // Strip compression to avoid "cursed symbols"
        delete proxyReqOpts.headers['accept-encoding'];
        return proxyReqOpts;
    },

    decompress: true,

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Replaces ALL seedloaf variants (subdomains and main) with your host
            // Example: accounts.seedloaf.com -> ://onrender.com
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'g');
            const modifiedContent = content.replace(pattern, `https://${myHost}`);
            
            return modifiedContent;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq, userRes, proxyRes, proxyReq) {
        if (headers.location) {
            const myHost = userReq.get('host');
            // Fix redirects from ANY seedloaf subdomain back to your proxy host
            headers.location = headers.location.replace(new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'g'), `https://${myHost}`);
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Subdomain-aware Proxy active on port ${PORT}`);
});
