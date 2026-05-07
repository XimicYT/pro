const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 3000;
const TARGET_URL = 'seedloaf.com';

app.use('/', proxy(TARGET_URL, {
    // 1. Force HTTPS when talking to the target
    proxyReqOptDecorator: function(proxyReqOpts) {
        proxyReqOpts.protocol = 'https:';
        return proxyReqOpts;
    },

    // 2. This intercepts the response and modifies the HTML
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        let content = proxyResData.toString('utf8');
        
        // Replace all instances of the real domain with your proxy URL
        // This keeps "Login", "Sign up", and navigation links within your proxy
        const host = userReq.get('host');
        const pattern = new RegExp(`https://${TARGET_URL}`, 'g');
        const modifiedContent = content.replace(pattern, `https://${host}`);
        
        return modifiedContent;
    },

    // 3. Handle redirects (e.g., after logging in)
    proxyResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        if (proxyRes.headers.location) {
            // If the server tries to redirect to the real site, 
            // we catch it and redirect them back to our proxy instead
            proxyRes.headers.location = proxyRes.headers.location.replace(`https://${TARGET_URL}`, '');
        }
        return proxyResData;
    },

    // Ensure we don't break cookies/sessions
    preserveHostHdr: false,
    memoizeHost: false
}));

app.listen(PORT, () => {
    console.log(`Deep Proxy active on port ${PORT}`);
});