require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const AccessControl = require('./auth');
const PaymentMonitor = require('./xmr-monitor');
const RateLimiter = require('./rate-limiter');

const accessControl = new AccessControl();
const paymentMonitor = new PaymentMonitor();
const rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

// Constants
const CONFIG = {
    ACCESS_CODE_LENGTH: 6,
    RATE_LIMIT_MAX: 5,
    RATE_LIMIT_WINDOW: 60000
};

class TorBlogServer {
    constructor() {
        // Server config
        this.publicPath = path.join(__dirname, process.env.PUBLIC_PATH || 'public');
        this.downloadsPath = path.join(this.publicPath, 'downloads');
        this.templatesPath = path.join(this.publicPath, 'templates');
        this.port = parseInt(process.env.PORT, 10) || 8080;
        this.host = process.env.HOST || '127.0.0.1';
        this.paymentsFile = process.env.PAYMENTS_FILE || './payments.json';
        this.torServiceDir = process.env.TOR_SERVICE_DIR || '/var/lib/tor/blog_service/';
        this.torServicePort = process.env.TOR_SERVICE_PORT || 80;

        // Payment / contact config - UNIFIED XMR variables
        this.currencyName = process.env.CURRENCY_NAME || 'XMR';
        this.xmrPrice = process.env.XMR_PRICE || '1';
        this.xmrAddress = process.env.XMR_ADDRESS || '';

        this.contactEmail = process.env.CONTACT_EMAIL || '';
        this.gpgFingerprint = process.env.GPG_FINGERPRINT || '';
        this.gpgDownloadPath = process.env.GPG_DOWNLOAD_PATH || '/download/gpg-key.asc';

        // Site metadata
        this.siteTitle = process.env.SITE_TITLE || 'ZeroTrails | Ultimate Privacy Arsenal';
        this.siteDescription = process.env.SITE_DESCRIPTION || '';
        this.siteKeywords = process.env.SITE_KEYWORDS || '';
        this.siteAuthor = process.env.SITE_AUTHOR || '';

        // Dynamic links / onion
        this.onionAddress = process.env.ONION_ADDRESS || '';
        this.keyserverUrl = process.env.KEYSERVER_URL || '';
        this.downloadEncryptGuide = process.env.DOWNLOAD_ENCRYPT_GUIDE || '/download/encrypt-guide.pdf';
        this.downloadKleopatraWindows = process.env.DOWNLOAD_KLEOPATRA_WINDOWS || '/download/kleopatra-windows.exe';

        this.checkEnv();
        this.ensureDownloadsFolder();

        this.server = this.startServer();
        paymentMonitor.startMonitoring();
        this.setupGracefulShutdown();
    }

    checkEnv() {
        const requiredVars = [
            'XMR_ADDRESS', 'CONTACT_EMAIL', 'GPG_FINGERPRINT',
            'ONION_ADDRESS', 'KEYSERVER_URL'
        ];
        let missing = requiredVars.filter(v => !process.env[v] || process.env[v].trim() === '');
        if (missing.length > 0) {
            console.warn('⚠️  WARNING: Missing critical .env variables:', missing.join(', '));
        }
    }

    ensureDownloadsFolder() {
        if (!fs.existsSync(this.downloadsPath)) {
            fs.mkdirSync(this.downloadsPath, { recursive: true });
            console.log(`📂 Created downloads folder at ${this.downloadsPath}`);
        }
    }

    startServer() {
        const server = http.createServer((req, res) => {
            res.removeHeader = function() {};

            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;

            try {
                if (pathname === '/' && req.method === 'GET') {
                    this.servePaywall(req, res);
                } else if (pathname === '/check-access' && req.method === 'POST') {
                    this.handleAccessCheck(req, res, parsedUrl);
                } else if (pathname === '/blog' || pathname.startsWith('/blog/')) {
                    this.serveBlog(req, res, pathname, parsedUrl);
                } else if (pathname.startsWith('/download/')) {
                    this.serveDownload(req, res, pathname);
                } else if (pathname === '/health' && req.method === 'GET') {
                    this.serveHealthCheck(req, res);
                } else {
                    this.serveStatic(req, res, pathname);
                }
            } catch (error) {
                console.error('Server error:', error);
                this.servePaywall(req, res);
            }
        });

        server.listen(this.port, this.host, () => {
            console.log(`🔒 Tor server running on http://${this.host}:${this.port}`);
            console.log('🌐 Configure Tor with:');
            console.log(`HiddenServiceDir ${this.torServiceDir}`);
            console.log(`HiddenServicePort ${this.torServicePort} ${this.host}:${this.port}`);
        });

        server.on('error', (error) => {
            console.error('❌ Server error:', error);
        });

        return server;
    }

    async servePaywall(req, res) {
        const randomId = this.generateRandomId(CONFIG.ACCESS_CODE_LENGTH);

        const payment = await paymentMonitor.addPayment(randomId);
        const payAddress = (payment && payment.subaddress) ? payment.subaddress : this.xmrAddress;

        const html = this.fillTemplate({
            SITE_TITLE: this.siteTitle,
            SITE_DESCRIPTION: this.siteDescription,
            SITE_KEYWORDS: this.siteKeywords,
            SITE_AUTHOR: this.siteAuthor,
            ONION_ADDRESS: this.onionAddress,
            XMR_PRICE: this.xmrPrice,
            CURRENCY_NAME: this.currencyName,
            PAY_ADDRESS: payAddress,
            RANDOM_ID: randomId,
            CONTACT_EMAIL: this.contactEmail,
            GPG_FINGERPRINT: this.gpgFingerprint,
            GPG_DOWNLOAD_PATH: this.gpgDownloadPath,
            KEYSERVER_URL: this.keyserverUrl,
            DOWNLOAD_ENCRYPT_GUIDE: this.downloadEncryptGuide,
            DOWNLOAD_KLEOPATRA_WINDOWS: this.downloadKleopatraWindows
        });

        this.sendResponse(res, 200, 'text/html', html);
    }

    fillTemplate(vars) {
        const templatePath = path.join(this.templatesPath, 'paywall.html');
        try {
            let template = fs.readFileSync(templatePath, 'utf8');
            return Object.entries(vars).reduce(
                (html, [key, value]) => html.replace(new RegExp(`{{${key}}}`, 'g'), value),
                template
            );
        } catch (error) {
            console.error('Template read error:', error.message);
            return `<html><body><h1>Error loading template</h1></body></html>`;
        }
    }

    generateRandomId(length = CONFIG.ACCESS_CODE_LENGTH) {
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }

    serveDownload(req, res, pathname) {
        const fileName = pathname.replace('/download/', '');
        const filePath = path.join(this.publicPath, 'downloads', fileName);

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error(`File not found: ${filePath}`);
                this.servePaywall(req, res);
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = this.getContentType(ext);

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store'
            });

            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        });
    }

    handleAccessCheck(req, res) {
        const ip = req.socket.remoteAddress || 'unknown';

        // Rate limiting
        if (!rateLimiter.check(ip)) {
            this.sendJsonError(res, 'Too many requests, please wait', ['Maximum 5 requests per minute allowed']);
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const formData = querystring.parse(body);
            const memoCode = (formData.memo_code || '').trim().toUpperCase();

            if (!memoCode.startsWith('ACCESS-')) {
                this.sendJsonError(res, 'Invalid memo code format', ['Must start with "ACCESS-"']);
                return;
            }

            const memo = memoCode.replace('ACCESS-', '');
            const payment = paymentMonitor.payments[memo];

            if (payment && payment.status === 'confirmed') {
                this.sendJsonSuccess(res, `/blog?token=${payment.access_token}`);
            } else {
                const reasons = [
                    'Transaction not confirmed yet (wait ~1-2 minutes after paying)',
                    `Payment amount less than ${this.xmrPrice} $${this.currencyName}`,
                    'Wrong recipient address (use the address shown above)',
                ];
                this.sendJsonError(res, `Payment with access code ${memoCode} not found or not confirmed`, reasons);
            }
        });
    }

    sendJsonSuccess(res, redirectUrl) {
        this.sendJsonResponse(res, 200, { redirect: redirectUrl });
    }

    sendJsonError(res, message, reasons) {
        this.sendJsonResponse(res, 400, { error: true, message, reasons });
    }

    sendJsonResponse(res, statusCode, data) {
        const json = JSON.stringify(data);
        res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(json);
    }

    serveBlog(req, res, pathname, parsedUrl) {
        const token = parsedUrl.query.token;
        if (!token || !accessControl.validateToken(token) || !accessControl.checkAccess(token)) {
            this.servePaywall(req, res);
            return;
        }

        let filePath = pathname === '/blog' ? '/index.html' : pathname.replace('/blog', '');
        if (filePath === '/') filePath = '/index.html';
        this.serveBlogFile(req, res, filePath, token);
    }

    serveBlogFile(req, res, filePath, token) {
        const fullPath = path.join(this.publicPath, filePath);

        fs.access(fullPath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error(`Blog file not found: ${fullPath}`);
                this.servePaywall(req, res);
                return;
            }

            fs.readFile(fullPath, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Blog file read error: ${fullPath}`, err.message);
                    this.servePaywall(req, res);
                    return;
                }

                if (path.extname(fullPath).toLowerCase() === '.html') {
                    data = this.injectTokenIntoContent(data, token);
                }

                const contentType = this.getContentType(path.extname(fullPath).toLowerCase());
                this.sendResponse(res, 200, contentType, data);
            });
        });
    }

    injectTokenIntoContent(html, token) {
        // Optimized: single regex for href, src, action
        return html.replace(
            /(href|src|action)=["']\/([^"']*?)["']/g,
            (match, attr, path) => `${attr}="/blog/${path}?token=${token}"`
        );
    }

    serveStatic(req, res, pathname) {
        if (pathname === '/' || pathname.startsWith('/blog')) {
            this.servePaywall(req, res);
            return;
        }

        const fullPath = path.join(this.publicPath, pathname);
        fs.access(fullPath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error(`Static file not found: ${fullPath}`);
                this.servePaywall(req, res);
                return;
            }

            fs.readFile(fullPath, (err, data) => {
                if (err) {
                    console.error(`Static file read error: ${fullPath}`, err.message);
                    this.servePaywall(req, res);
                    return;
                }

                const contentType = this.getContentType(path.extname(fullPath).toLowerCase());
                this.sendResponse(res, 200, contentType, data);
            });
        });
    }

    serveHealthCheck(req, res) {
        const health = {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: Date.now(),
            rpc_connected: !!paymentMonitor.rpcUrl
        };
        this.sendJsonResponse(res, 200, health);
    }

    getContentType(ext) {
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.exe': 'application/octet-stream',
            '.asc': 'text/plain'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }

    sendResponse(res, status, contentType, data) {
        const headers = {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(data),
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        };
        res.writeHead(status, headers);
        res.end(data);
    }

    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n${signal} received, shutting down gracefully...`);
            this.server.close(() => {
                console.log('✅ Server closed');
                paymentMonitor.savePayments();
                console.log('✅ Payments saved');
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}

new TorBlogServer();
