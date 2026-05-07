const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const TARGET_URL = 'seedloaf.com';

app.use('/', proxy(`https://${TARGET_URL}`, {
    // 1. FORCE PLAIN TEXT: Tell the target server NOT to compress the response.
    // This prevents "cursed symbols" (Gzip/Brotli) from reaching your decorator.
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding'];
        return proxyReqOpts;
    },
    
    // Ensure decompression is active just in case
    decompress: true,

    // 2. Intercept and rewrite HTML content
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        // Check if content is HTML
        if (contentType && contentType.includes('text/html')) {
            // Convert Buffer to String
            let content = proxyResData.toString('utf8');
            
            // Rewrite all links from seedloaf.com to your current host
            const pattern = new RegExp(`(https?:)?//${TARGET_URL}`, 'g');
            const modifiedContent = content.replace(pattern, `https://${myHost}`);
            
            return modifiedContent;
        }

        return proxyResData;
    },

    // 3. Handle Redirects (e.g., Location headers)
    userResHeaderDecorator(headers, userReq, userRes, proxyRes, proxyReq) {
        if (headers.location && headers.location.includes(TARGET_URL)) {
            headers.location = headers.location.replace(`https://${TARGET_URL}`, `https://${userReq.get('host')}`);
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Proxy fixed: Compression stripped. Listening on port ${PORT}`);
});
