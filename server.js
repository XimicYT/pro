const express = require('express');
const proxy = require('express-http-proxy');
const app = express();

const PORT = process.env.PORT || 10000;
const MAIN_TARGET = 'seedloaf.com';

app.use('/', proxy((req) => {
    // Force sign-in/up paths to hit the correct accounts subdomain
    if (req.url.includes('sign-up') || req.url.includes('sign-in') || req.url.includes('clerk')) {
        return `https://accounts.${MAIN_TARGET}`;
    }
    return `https://${MAIN_TARGET}`;
}, {
    proxyReqOptDecorator: function(proxyReqOpts) {
        delete proxyReqOpts.headers['accept-encoding'];
        proxyReqOpts.headers['referer'] = `https://${MAIN_TARGET}/`;
        proxyReqOpts.headers['origin'] = `https://${MAIN_TARGET}`;
        return proxyReqOpts;
    },

    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        const contentType = proxyRes.headers['content-type'];
        const myHost = userReq.get('host');

        if (contentType && contentType.includes('text/html')) {
            let content = proxyResData.toString('utf8');
            
            // 1. Rewrite all seedloaf variants to your proxy URL
            const pattern = new RegExp(`(https?:)?//([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi');
            content = content.replace(pattern, `https://${myHost}`);

            // 2. Inject Debug Alerts and Spoofing
            const debugScript = `
                <script>
                    // Alert any JS errors immediately
                    window.onerror = function(msg, url, line) {
                        alert("JS ERROR: " + msg + "\\nURL: " + url + "\\nLine: " + line);
                    };
                    
                    // Alert if Clerk or major scripts fail to load
                    window.addEventListener('error', function(e) {
                        if (e.target.tagName === 'SCRIPT') {
                            alert("FAILED TO LOAD SCRIPT: " + e.target.src);
                        }
                    }, true);

                    // Spoof location for Clerk's internal checks
                    Object.defineProperty(window, 'location', {
                        value: { ...window.location, host: '${MAIN_TARGET}', hostname: '${MAIN_TARGET}' },
                        writable: true
                    });
                    
                    console.log("Debug Proxy Script Active");
                </script>
            `;
            return content.replace('<head>', '<head>' + debugScript);
        }
        return proxyResData;
    },

    userResHeaderDecorator(headers, userReq) {
        const myHost = userReq.get('host');

        // CRITICAL: Strip the "Blank Screen" security blocks
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['x-frame-options'];

        // Fix Cookies and Redirects
        if (headers.location) {
            headers.location = headers.location.replace(new RegExp(`https?://([a-z0-9]+\\.)?${MAIN_TARGET.replace('.', '\\.')}`, 'gi'), `https://${myHost}`);
        }
        if (headers['set-cookie']) {
            headers['set-cookie'] = headers['set-cookie'].map(c => c.replace(/domain=\.?seedloaf\.com/gi, `domain=${myHost}`));
        }
        return headers;
    },

    changeOrigin: true,
    preserveHostHdr: false
}));

app.listen(PORT, () => {
    console.log(`Debug Proxy active on port ${PORT}`);
});
