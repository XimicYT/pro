const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const TARGET_DOMAIN = 'www.ouiheberg.com';

app.use('/', proxy(`https://${TARGET_DOMAIN}`, {
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        // 1. STRIP COMPRESSION: Essential to avoid "cursed symbols"
        delete proxyReqOpts.headers['accept-encoding'];
        
        // 2. SPOOF HEADERS: Make the request look like it's coming from the real site
        proxyReqOpts.headers['referer'] = `https://${TARGET_DOMAIN}/en`;
        proxyReqOpts.headers['origin'] = `https://${TARGET_DOMAIN}`;
        proxyReqOpts.headers['host'] = TARGET_DOMAIN;
        
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        // Only process HTML files
        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // 3. HIJACK ALL LINKS: Convert all ouiheberg.com links to your Render URL
            const pattern = new RegExp(`(https?:)?//${TARGET_DOMAIN.replace('.', '\\.')}`, 'gi');
            content = content.replace(pattern, `https://${myHost}`);

            // 4. FIX ASSET PATHS: Ensure local scripts/CSS load correctly
            // Some sites use relative paths that might break
            content = content.replace(/src="\/([a-zA-Z0-9])/g, `src="https://${myHost}/$1`);
            content = content.replace(/href="\/([a-zA-Z0-9])/g, `href="https://${myHost}/$1`);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        
        // 5. REMOVE SECURITY BLOCKS: Delete CSP/X-Frame to fix the blank screen
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];
        delete headers['strict-transport-security'];

        // 6. FIX REDIRECTS & COOKIES
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
    console.log(`OuiHeberg Mirror active on port ${PORT}`);
});
