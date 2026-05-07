const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // Better subdomain detection
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('accounts')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding'];
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // 1. Rewrite standard URLs
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'g');
            content = content.replace(pattern, `https://${myHost}`);

            // 2. Rewrite encoded URLs (the cause of the redirect loop)
            // This fixes strings like "http%3A%2F%2Fseedloaf.com"
            const encodedPattern = new RegExp(`http(%3A%2F%2F|:(\\/){2})([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            content = content.replace(encodedPattern, `https://${myHost}`);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq, userRes, proxyRes, proxyReq) {
        const myHost = userReq.get('host');
        
        if (headers.location) {
            // Fix standard redirects
            const pattern = new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            headers.location = headers.location.replace(pattern, `https://${myHost}`);

            // 3. STOP THE LOOP: If the redirect is just pointing to itself repeatedly,
            // or if it contains a massive nested redirect_url, we clean it.
            if (headers.location.includes('redirect_url')) {
                const url = new URL(headers.location, `https://${myHost}`);
                const params = url.searchParams;
                let rUrl = params.get('redirect_url');
                
                if (rUrl && rUrl.includes(MAIN_TARGET)) {
                    // Force the redirect parameter to point to your proxy, not the target
                    params.set('redirect_url', `https://${myHost}/`);
                    headers.location = url.pathname + '?' + params.toString();
                }
            }
        }

        // Rewrite cookie domains to your host
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(cookie => 
                cookie.replace(/domain=\.?seedloaf\.com/gi, `domain=${myHost}`)
            );
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Loop-Fixed Proxy active on port ${PORT}`);
});
