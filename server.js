const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const TARGET_DOMAIN = 'www.ouiheberg.com';
const TARGET_PATH = '/en/free-minecraft-server';

app.use('/', proxy(`https://${TARGET_DOMAIN}`, {
    // 1. Force the proxy to start at the Free Minecraft page if the user hits the root
    proxyReqPathResolver: function (req) {
        return req.url === '/' ? TARGET_PATH : req.url;
    },

    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        // Strip compression to avoid "cursed symbols"
        delete proxyReqOpts.headers['accept-encoding'];
        
        // Make the request look like it's coming from the real site
        proxyReqOpts.headers['referer'] = `https://${TARGET_DOMAIN}${TARGET_PATH}`;
        proxyReqOpts.headers['origin'] = `https://${TARGET_DOMAIN}`;
        proxyReqOpts.headers['host'] = TARGET_DOMAIN;
        
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Rewrite all OuiHeberg links to your Render URL
            const pattern = new RegExp(`(https?:)?//${TARGET_DOMAIN.replace('.', '\\.')}`, 'gi');
            content = content.replace(pattern, `https://${myHost}`);

            // Fix for "Static Assets" (CSS/JS) that use relative paths
            content = content.replace(/href="\/_next/g, `href="https://${myHost}/_next`);
            content = content.replace(/src="\/_next/g, `src="https://${myHost}/_next`);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        
        // Strip security headers that cause the blank screen
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        if (headers.location) {
            headers.location = headers.location.replace(new RegExp(`https?://${TARGET_DOMAIN}`, 'gi'), `https://${myHost}`);
        }
        
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => 
                c.replace(new RegExp(`domain=\.?${TARGET_DOMAIN.replace('www.', '')}`, 'gi'), `domain=${myHost}`)
            );
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`OuiHeberg Minecraft Proxy active on port ${PORT}`);
});
