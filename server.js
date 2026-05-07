const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// This catches EVERYTHING and sends it to Seedloaf
app.use('/', createProxyMiddleware({
    target: 'https://seedloaf.com',
    changeOrigin: true, // Necessary to fool the target server into thinking the request is local
    onProxyRes: function (proxyRes, req, res) {
        // Fixes potential CORS issues
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    },
    // This helps handle SSL/HTTPS redirects properly
    followRedirects: true
}));

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});