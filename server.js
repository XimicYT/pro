const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // Dynamically target the correct subdomain
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('clerk') || req.url.includes('accounts')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding']; // Stop cursed symbols
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        proxyReqOpts.headers['origin'] = `https://${MAIN_TARGET}`;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // 1. Rewrite all seedloaf domains to your proxy domain
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            content = content.replace(pattern, `https://${myHost}`);

            // 2. Inject a fix for Clerk/JS frameworks that check window.location
            const scriptShield = `
                <script>
                    // Spoof the location so JS frameworks don't realize they are proxied
                    const originalLocation = window.location.host;
                    Object.defineProperty(window, 'location', {
                        value: { ...window.location, host: '${MAIN_TARGET}', hostname: '${MAIN_TARGET}' },
                        writable: true
                    });
                </script>
            `;
            return content.replace('<head>', '<head>' + scriptShield);
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq, userRes) {
        const myHost = userReq.get('host');

        // CRITICAL: Remove security headers that cause blank screens
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        // Fix Redirects
        if (headers.location) {
            const pattern = new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            headers.location = headers.location.replace(pattern, `https://${myHost}`);
        }

        // Fix Cookies for Authentication
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(cookie => 
                cookie.replace(/domain=\.?seedloaf\.com/gi, `domain=${myHost}`)
                      .replace(/Secure/gi, '') // Allow testing on non-https if needed
            );
        }

        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Bypass active on port ${PORT}. Security headers stripped.`);
});
