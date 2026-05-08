const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Basic Middleware
app.use(express.static(path.join(__dirname, 'public')));

// 2. The Proxy Logic
app.use('/proxy', (req, res, next) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('No URL provided. Use /proxy?url=https://example.com');
    }

    // Determine the base domain for relative link fixing
    let targetBase;
    try {
        targetBase = new URL(targetUrl).origin;
    } catch (e) {
        return res.status(400).send('Invalid URL format.');
    }

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        followRedirects: true,
        pathRewrite: {
            '^/proxy': '', // Strip the /proxy prefix before sending to target
        },
        onProxyReq: (proxyReq, req, res) => {
            // Mask headers to avoid "Proxy Detected" blocks
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.removeHeader('Origin');
        },
        onProxyRes: (proxyRes, req, res) => {
            // Fix Cookies for the proxy domain
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => 
                    cookie.replace(/Domain=[^;]+;?/i, '') // Force cookies to current domain
                );
            }
            
            // Security: Allow iframe embedding for the proxy
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-frame-options'];
        },
        // Error handling
        onError: (err, req, res) => {
            res.status(500).send('Proxy Error: ' + err.message);
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Universal Proxy active at http://localhost:${PORT}`);
});