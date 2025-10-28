require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const AccessControl = require('./auth');
const PaymentMonitor = require('./xmr-monitor');

const accessControl = new AccessControl();
const paymentMonitor = new PaymentMonitor();

class TorBlogServer {
    constructor() {
        // Server config
        this.publicPath = path.join(__dirname, process.env.PUBLIC_PATH || 'public');
        this.downloadsPath = path.join(this.publicPath, 'downloads');
        this.port = parseInt(process.env.PORT, 10) || 8080;
        this.host = process.env.HOST || '127.0.0.1';
        this.paymentsFile = process.env.PAYMENTS_FILE || './payments.json';
        this.torServiceDir = process.env.TOR_SERVICE_DIR || '/var/lib/tor/blog_service/';
        this.torServicePort = process.env.TOR_SERVICE_PORT || 80;

        // Payment / contact config
        this.currencyName = process.env.CURRENCY_NAME || 'IRONFISH';
        this.ironfishPrice = process.env.IRONFISH_PRICE || '100';
        this.ironfishAddress = process.env.IRONFISH_ADDRESS || '';

        this.contactEmail = process.env.CONTACT_EMAIL || '';
        this.gpgFingerprint = process.env.GPG_FINGERPRINT || '';
        this.gpgDownloadPath = process.env.GPG_DOWNLOAD_PATH || '/download/gpg-key.asc';

        // Site metadata
        this.siteTitle = process.env.SITE_TITLE || 'ZeroTrails | Ultimate Privacy Arsenal | 100 IRON';
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

        this.startServer();
        paymentMonitor.startMonitoring();
    }

    // Проверка критических переменных .env
    checkEnv() {
        const requiredVars = [
            'IRONFISH_ADDRESS', 'CONTACT_EMAIL', 'GPG_FINGERPRINT', 
            'ONION_ADDRESS', 'KEYSERVER_URL'
        ];
        let missing = requiredVars.filter(v => !process.env[v] || process.env[v].trim() === '');
        if (missing.length > 0) {
            console.warn('⚠️  WARNING: Missing critical .env variables:', missing.join(', '));
        }
    }

    // Создание папки downloads если нет
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
    }
    servePaywall(req, res) {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.siteTitle}</title>
<meta name="description" content="${this.siteDescription}">
<meta name="keywords" content="${this.siteKeywords}">
<meta name="robots" content="index, follow">
<meta name="author" content="${this.siteAuthor}">
<meta name="onion-location" content="${this.onionAddress}">
<meta name="onion-service" content="true">
<meta name="language" content="en">
<link rel="stylesheet" href="./index.css">
</head>
<body>
<div class="container">

<div class="categories-menu">
<a href="#" onclick="checkAuth('/blog/vpn')">VPN</a>•
<a href="#" onclick="checkAuth('/blog/phones')">PHONES</a>•
<a href="#" onclick="checkAuth('/blog/soft')">SOFTWARE</a>•
<a href="#" onclick="checkAuth('/blog/crypto')">CRYPTO</a>•
<a href="#" onclick="checkAuth('/blog/tor')">TOR</a>•
<a href="#" onclick="checkAuth('/blog/os')">OS</a>•
<a href="#" onclick="checkAuth('/blog/comms')">COMMS</a>•
<a href="#" onclick="checkAuth('/blog/cloud')">CLOUD</a>•
<a href="#" onclick="checkAuth('/blog/docs')">DOCS</a>
</div>

<div class="global-error" id="globalError">
<button class="close-btn" onclick="closeGlobalError()">&times;</button>
<div id="globalErrorContent">
<strong>[!] ACCESS DENIED</strong><br>
<span style="color: #ff8888;">Purchase subscription to access content</span>
</div>
</div>

<div class="header">
<h1>Z E R O . T R A I L S (USA)</h1>
<p>Essential guide to becoming a ghost online and secure in the real world!</p>
</div>

<div class="payment-box">
<div class="price">
<h2>${this.ironfishPrice} $${this.currencyName}</h2>
<p>365 DAYS ACCESS</p>
</div>
<div class="instructions">
<h3>[>] PAYMENT INSTRUCTIONS:</h3>
<ol>
<li>Send <strong>${this.ironfishPrice} $${this.currencyName}</strong> to address:</li>
<code>${this.ironfishAddress}</code>
<li><strong>MUST INCLUDE IN MEMO FIELD:</strong></li>
<code style="background: #000000ff; color: rgba(172, 255, 174, 1); font-size: 1em;">ACCESS-${randomId}</code>
</ol>
</div>
<div class="access-form">
<p>ENTER MEMO CODE TO ACCESS:</p>
<div class="error-message" id="errorMessage">
<button class="close-btn" onclick="closeError()">&times;</button>
<div id="errorContent"></div>
</div>
<form id="accessForm">
<input type="text" id="memo_code" name="memo_code" placeholder="ACCESS-XXXXXX" required>
<br>
<button type="submit" id="submitBtn">> ACCESS PORTAL</button>
</form>
</div>
</div>

<div class="contact-info">
<p>[CONTACT & SUPPORT]</p>
<p>E-Mail: ${this.contactEmail}</p>
<p>GPG: <span class="gpg-fingerprint" onclick="window.location.href='${this.gpgDownloadPath}'">${this.gpgFingerprint}</span></p>
<div class="server-info" onclick="window.open('${this.keyserverUrl}', '_blank')">
🔒 CLICK: keyserver
</div>
<div class="download-links">
<a href="${this.downloadEncryptGuide}">Email Encryption Guide</a> | 
<a href="${this.downloadKleopatraWindows}">Kleopatra for Windows</a>
</div>
</div>

<div class="footer">
<p>NO LOGS | NO JS | TOR ONLY</p>
</div>
</div>

<script>
function checkAuth(url) {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (!token) { showGlobalError(); return false; }
    window.location.href = url;
    return true;
}

function showGlobalError() {
    document.getElementById('globalError').classList.add('show');
    document.getElementById('memo_code').focus();
}

function closeGlobalError() {
    document.getElementById('globalError').classList.remove('show');
}

document.getElementById('accessForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const memoCode = document.getElementById('memo_code').value.trim().toUpperCase();
    const submitBtn = document.getElementById('submitBtn');
    if (!memoCode.startsWith('ACCESS-')) {
        showError('Invalid format! Must start with "ACCESS-"');
        return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '> CHECKING...';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/check-access', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            submitBtn.disabled = false;
            submitBtn.textContent = '> ACCESS PORTAL';
            if (xhr.status === 200) {
                window.location.href = JSON.parse(xhr.responseText).redirect;
            } else {
                try {
                    const response = JSON.parse(xhr.responseText);
                    showError(response.message, response.reasons);
                } catch (e) {
                    showError('Unknown error occurred');
                }
            }
        }
    };
    xhr.send('memo_code=' + encodeURIComponent(memoCode));
});

function showError(message, reasons = []) {
    const errorDiv = document.getElementById('errorMessage');
    const errorContent = document.getElementById('errorContent');
    let content = '<strong>[!] ' + message + '</strong>';
    if (reasons.length > 0) {
        content += '<ul>';
        reasons.forEach(reason => content += '<li>' + reason + '</li>');
        content += '</ul>';
    }
    errorContent.innerHTML = content;
    errorDiv.classList.add('show');
}

function closeError() {
    document.getElementById('errorMessage').classList.remove('show');
}

document.addEventListener('click', function(e) {
    const errorDiv = document.getElementById('errorMessage');
    const globalError = document.getElementById('globalError');
    if (e.target === errorDiv) closeError();
    if (e.target === globalError) closeGlobalError();
});
</script>
</body>
</html>`;

        this.sendResponse(res, 200, 'text/html', html);
    }

    serveDownload(req, res, pathname) {
        const fileName = pathname.replace('/download/', '');
        const filePath = path.join(this.publicPath, 'downloads', fileName);

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
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
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const formData = querystring.parse(body);
            const memoCode = (formData.memo_code || '').trim().toUpperCase();

            if (!memoCode.startsWith('ACCESS-')) {
                this.sendJsonError(res, 'Invalid memo code format', ['Must start with "ACCESS-"']);
                return;
            }

            const payments = this.loadPayments();
            const payment = Object.values(payments).find(p => p.memo === memoCode && p.status === 'confirmed');

            if (payment) {
                this.sendJsonSuccess(res, `/blog?token=${payment.access_token}`);
            } else {
                const reasons = [
                    'Transaction not confirmed yet (wait 1-2 minutes)',
                    `Payment amount less than ${this.ironfishPrice} $${this.currencyName}`,
                    'Wrong recipient address',
                    'Memo code is case-sensitive'
                ];
                this.sendJsonError(res, `Payment with memo code ${memoCode} not found`, reasons);
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
        if (!token || !accessControl.checkAccess(token)) {
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
            if (err) { this.servePaywall(req, res); return; }

            fs.readFile(fullPath, 'utf8', (err, data) => {
                if (err) { this.servePaywall(req, res); return; }

                if (path.extname(fullPath).toLowerCase() === '.html') {
                    data = this.injectTokenIntoContent(data, token);
                }

                const contentType = this.getContentType(path.extname(fullPath).toLowerCase());
                this.sendResponse(res, 200, contentType, data);
            });
        });
    }

    injectTokenIntoContent(html, token) {
        return html
            .replace(/href="\/([^"]*)"/g, `href="/blog/$1?token=${token}"`)
            .replace(/href='\/([^']*)'/g, `href='/blog/$1?token=${token}'`)
            .replace(/action="\/([^"]*)"/g, `action="/blog/$1?token=${token}"`)
            .replace(/action='\/([^']*)'/g, `action='/blog/$1?token=${token}'`)
            .replace(/src="\/([^"]*)"/g, `src="/blog/$1?token=${token}"`)
            .replace(/src='\/([^']*)'/g, `src='/blog/$1?token=${token}'`);
    }

    serveStatic(req, res, pathname) {
        if (pathname === '/' || pathname.startsWith('/blog')) { this.servePaywall(req, res); return; }

        const fullPath = path.join(this.publicPath, pathname);
        fs.access(fullPath, fs.constants.F_OK, (err) => {
            if (err) { this.servePaywall(req, res); return; }

            fs.readFile(fullPath, (err, data) => {
                if (err) { this.servePaywall(req, res); return; }

                const contentType = this.getContentType(path.extname(fullPath).toLowerCase());
                this.sendResponse(res, 200, contentType, data);
            });
        });
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

    loadPayments() {
        try { return JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8')); }
        catch { return {}; }
    }
}

new TorBlogServer();
