const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const TARGET_URL = 'seedloaf.com';

app.use('/', proxy(`https://${TARGET_URL}`, {
    // 1. CRITICAL: This tells the proxy to unzip the "cursed text" 
    // so we can actually read and edit the HTML.
    proxyReqOptDecorator: function(proxyReqOpts) {
        return proxyReqOpts;
    },
    
    // We must decompress to edit the text
    decompress: true,

    // 2. Intercept and rewrite HTML content
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        // Only rewrite if the content is HTML (don't touch images/binaries)
        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Rewrite all links from seedloaf.com to your Render URL
            const pattern = new RegExp(`(https:)?//${TARGET_URL}`, 'g');
            const modifiedContent = content.replace(pattern, `https://${myHost}`);
            
            return modifiedContent;
        }

        // If it's an image or other file, just return it as is
        return proxyResData;
    },

    // 3. Handle Redirects (e.g., after logging in)
    proxyResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        if (proxyRes.headers.location) {
            let redirect = proxyRes.headers.location;
            if (redirect.includes(TARGET_URL)) {
                proxyRes.headers.location = redirect.replace(`https://${TARGET_URL}`, `https://${userReq.get('host')}`);
            }
        }
        return proxyResData;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Decompressed Proxy active on port ${PORT}`);
});