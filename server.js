const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_DOMAIN = 'www.ouiheberg.com';
const MANAGER_DOMAIN = 'manager.ouiheberg.com';
const TARGET_PATH = '/en/free-minecraft-server';

app.use('/', proxy((req) => {
    // DYNAMIC TARGET: If path starts with /manager-api or similar, switch target
    // Or simply check if the URL contains manager-specific strings
    if (req.url.includes('manager')) {
        return `https://${MANAGER_DOMAIN}`;
    }
    return `https://${MAIN_DOMAIN}`;
}, {
    proxyReqPathResolver: function (req) {
        // 1. Root redirect to Free Minecraft page
        let resolvedPath = req.url === '/' ? TARGET_PATH : req.url;
        
        // 2. Clean up manager paths if you're using a prefix like /manager/...
        return resolvedPath;
    },

    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        delete proxyReqOpts.headers['accept-encoding'];
        
        const currentTarget = srcReq.url.includes('manager') ? MANAGER_DOMAIN : MAIN_DOMAIN;
        
        proxyReqOpts.headers['referer'] = `https://${currentTarget}`;
        proxyReqOpts.headers['origin'] = `https://${currentTarget}`;
        proxyReqOpts.headers['host'] = currentTarget;
        
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // --- FIX 1: FORCE LINKS TO STAY IN SAME TAB ---
            // Removes target="_blank" and replaces it with target="_self"
            content = content.replace(/target="_blank"/gi, 'target="_self"');

            // --- FIX 2: SUBDOMAIN REWRITING ---
            // Rewrite MAIN domain links
            const mainPattern = new RegExp(`(https?:)?//${MAIN_DOMAIN.replace('.', '\\.')}`, 'gi');
            content = content.replace(mainPattern, `https://${myHost}`);

            // Rewrite MANAGER domain links
            const managerPattern = new RegExp(`(https?:)?//${MANAGER_DOMAIN.replace('.', '\\.')}`, 'gi');
            content = content.replace(managerPattern, `https://${myHost}`);

            // Fix for "Static Assets" (CSS/JS)
            content = content.replace(/href="\/(_next|static|assets)/g, `href="https://${myHost}/$1`);
            content = content.replace(/src="\/(_next|static|assets)/g, `src="https://${myHost}/$1`);

            return content;
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');
        
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        // Rewrite Location headers for redirects
        if (headers.location) {
            headers.location = headers.location
                .replace(new RegExp(`https?://${MAIN_DOMAIN}`, 'gi'), `https://${myHost}`)
                .replace(new RegExp(`https?://${MANAGER_DOMAIN}`, 'gi'), `https://${myHost}`);
        }
        
        // Rewrite Cookie Domains
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => 
                c.replace(/domain=\.?ouiheberg\.com/gi, `domain=${myHost}`)
            );
        }
        return headers;
    }
}));

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});