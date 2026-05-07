const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Serve your local index.html file at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Proxy logic for everything else
// This will forward requests to seedloaf.com
app.use('/proxy', createProxyMiddleware({
    target: 'https://seedloaf.com',
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': '', // removes /proxy from the URL when forwarding
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});