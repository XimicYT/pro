const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const TARGET_URL = 'seedloaf.com';

app.use('/', proxy(`https://${TARGET_URL}`, {
    // 1. This tells the library to handle the HTTPS handshake automatically
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        // We don't need to manually set protocol here anymore
        return proxyReqOpts;
    },

    // 2. Intercept and rewrite HTML content to keep links on our proxy
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        let content = proxyResData.toString('utf8');
        const myHost = userReq.get('host');
        
        // This replaces "https://seedloaf.com" with "https://your-app.onrender.com"
        // It also handles cases where the site uses "//seedloaf.com" (protocol-relative)
        const pattern = new RegExp(`(https:)?//${TARGET_URL}`, 'g');
        const modifiedContent = content.replace(pattern, `https://${myHost}`);
        
        return modifiedContent;
    },

    // 3. Catch redirects (like after a login) and point them back to the proxy
    proxyResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        if (proxyRes.headers.location) {
            let redirect = proxyRes.headers.location;
            if (redirect.includes(TARGET_URL)) {
                proxyRes.headers.location = redirect.replace(`https://${TARGET_URL}`, `https://${userReq.get('host')}`);
            }
        }
        return proxyResData;
    },

    // Important for modern sites
    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});