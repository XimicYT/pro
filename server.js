const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';
const ACCOUNTS_TARGET = `accounts.${MAIN_TARGET}`;

app.use('/', proxy((req) => {
    // If the URL looks like an auth/sign-up path, route specifically to the accounts subdomain
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('clerk')) {
        return `https://${ACCOUNTS_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding']; // Fixes "cursed text"
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        proxyReqOpts.headers['origin'] = `https://${MAIN_TARGET}`;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // Rewrite ALL variants (seedloaf.com and ://seedloaf.com) to your Render URL
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            content = content.replace(pattern, `https://${myHost}`);

            // Fix for Clerk's internal Frontend API calls
            const apiPattern = new RegExp(`clerk\\.${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            content = content.replace(apiPattern, myHost);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');

        // STRIP SECURITY: Removes the "Blank Screen" blocks (CSP)
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        // Fix Redirects from subdomains
        if (headers.location) {
            const pattern = new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            headers.location = headers.location.replace(pattern, `https://${myHost}`);
        }

        // Rewrite Cookie Domains so your browser stores the login session
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
    console.log(`Subdomain-aware proxy active on port ${PORT}`);
});
