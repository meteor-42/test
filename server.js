const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const AccessControl = require('./auth');
const PaymentMonitor = require('./payment-monitor');

const accessControl = new AccessControl();
const paymentMonitor = new PaymentMonitor();

class TorBlogServer {
    constructor() {
        this.publicPath = path.join(__dirname, 'public');
        this.port = 8080;
        this.host = '127.0.0.1';
        this.startServer();
        paymentMonitor.startMonitoring();
    }

    startServer() {
        const server = http.createServer((req, res) => {
            // Убираем Server header для анонимности
            res.removeHeader = function() {};
            
            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;

            try {
                if (pathname === '/' && req.method === 'GET') {
                    this.servePaywall(req, res);
                }
                else if (pathname === '/check-access' && req.method === 'POST') {
                    this.handleAccessCheck(req, res, parsedUrl);
                }
                else if (pathname === '/blog' || pathname.startsWith('/blog/')) {
                    this.serveBlog(req, res, pathname, parsedUrl);
                }
                else {
                    this.serveStatic(req, res, pathname);
                }
            } catch (error) {
                console.error('Server error:', error);
                this.serveError(res, 500, 'Internal Server Error');
            }
        });

        server.listen(this.port, this.host, () => {
            console.log(`🔒 Tor Blog server running on http://${this.host}:${this.port}`);
            console.log('🌐 Configure Tor with:');
            console.log(`HiddenServiceDir /var/lib/tor/blog_service/`);
            console.log(`HiddenServicePort 80 ${this.host}:${this.port}`);
        });

        server.on('error', (error) => {
            console.error('❌ Server error:', error);
        });
    }

    // Главная страница - paywall
    servePaywall(req, res) {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
       // В методе servePaywall замените HTML на:
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PRIVATE RESEARCH BLOG - ACCESS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Courier New', monospace; 
            background: #0a0a0a;
            color: #e0e0e0;
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 700px;
            width: 100%;
        }
        .menu {
            background: #1a1a1a;
            border: 1px solid #ffa500;
            border-radius: 3px;
            padding: 12px;
            margin: 20px 0;
            color: #ffa500;
            font-size: 13px;
            text-align: center;
        }
        .menu span {
            margin: 0 8px;
            cursor: default;
        }
        .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 1px solid #333;
            padding-bottom: 20px;
        }
        .header h1 {
            font-size: 2.2em;
            margin-bottom: 8px;
            color: #ffa500;
        }
        .header p {
            color: #888;
            font-size: 1em;
        }
        .payment-box {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 3px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .price {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
        }
        .price h2 {
            font-size: 1.6em;
            color: #ffa500;
            margin-bottom: 8px;
        }
        .price p {
            color: #888;
            font-size: 0.9em;
        }
        .instructions {
            background: #2a2a2a;
            border-radius: 3px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 3px solid #ffa500;
        }
        .instructions h3 {
            color: #ffa500;
            margin-bottom: 12px;
            font-size: 1.1em;
        }
        .instructions ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .instructions li {
            margin-bottom: 10px;
            color: #ccc;
        }
        code {
            background: #000;
            color: #ffa500;
            padding: 6px 10px;
            border-radius: 2px;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            border: 1px solid #333;
            display: block;
            margin: 8px 0;
            word-break: break-all;
        }
        .access-form {
            text-align: center;
            padding-top: 15px;
            border-top: 1px solid #333;
        }
        .access-form p {
            margin-bottom: 12px;
            color: #ccc;
        }
        input[type="text"] {
            width: 100%;
            max-width: 400px;
            padding: 10px 12px;
            background: #000;
            color: #ffa500;
            border: 1px solid #444;
            border-radius: 2px;
            font-size: 14px;
            margin-bottom: 15px;
            font-family: 'Courier New', monospace;
        }
        input[type="text"]:focus {
            outline: none;
            border-color: #ffa500;
        }
        button {
            background: transparent;
            color: #ffa500;
            border: 1px solid #ffa500;
            padding: 10px 25px;
            border-radius: 2px;
            font-size: 14px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
        }
        button:hover {
            background: #ffa500;
            color: #000;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 0.8em;
            margin-top: 15px;
        }
        .contact-info {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 3px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            font-size: 12px;
        }
        .contact-info p {
            margin: 6px 0;
            color: #888;
        }
        .gpg-fingerprint {
            font-family: 'Courier New', monospace;
            color: #ffa500;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Top Menu -->
        <div class="menu">
            [<span>MAIN</span>]•[<span>ACCESS</span>]•[<span>CONTACT</span>]•[<span>INFO</span>]•[<span>STATUS</span>]
        </div>

        <div class="header">
            <h1>[#] PRIVATE RESEARCH BLOG</h1>
            <p>EXCLUSIVE CONTENT - MEMBERS ONLY</p>
        </div>
        
        <div class="payment-box">
            <div class="price">
                <h2>[$] 10 $IRON</h2>
                <p>[#] 30 DAYS ACCESS | [@] TOR ONLY</p>
            </div>
            
            <div class="instructions">
                <h3>[>] PAYMENT INSTRUCTIONS:</h3>
                <ol>
                    <li>Send <strong>10 $IRON</strong> to address:</li>
                    <code>if_youractualironfishaddressgoeshere123456789</code>
                    
                    <li><strong>MUST INCLUDE IN MEMO FIELD:</strong></li>
                    <code style="background: #332200; color: #ffa500; font-size: 1em;">BLOG-ACCESS-${randomId}</code>
                    
                    <li>After transaction confirms (1-2 minutes), enter memo code below</li>
                </ol>
            </div>
            
            <div class="access-form">
                <p>ENTER MEMO CODE TO ACCESS BLOG:</p>
                <form action="/check-access" method="POST">
                    <input type="text" name="memo_code" placeholder="BLOG-ACCESS-XXXXXX" required>
                    <br>
                    <button type="submit">[>] ACCESS PRIVATE BLOG</button>
                </form>
            </div>
        </div>

        <!-- Contact Information -->
        <div class="contact-info">
            <p>[CONTACT INFORMATION]</p>
            <p>[@] Contact: gustav.krupp@proton.me</p>
            <p>[#] GPG Fingerprint: <span class="gpg-fingerprint">1234 5678 90AB CDEF 1234 5678 90AB CDEF 1234 5678</span></p>
        </div>
        
        <!-- Footer Menu -->
        <div class="menu">
            [<span>STATUS: ONLINE</span>]•[<span>USERS: 0</span>]•[<span>TOR: ACTIVE</span>]•[<span>ACCESS: PAID</span>]
        </div>

        <div class="footer">
            <p>[!] INSTANT ACTIVATION | [#] AUTO-CLEANUP AFTER 30 DAYS</p>
            <p>[@] THIS SERVICE IS ONLY ACCESSIBLE VIA TOR NETWORK</p>
        </div>
    </div>
</body>
</html>`;
        this.sendResponse(res, 200, 'text/html', html);
    }

    // Обработка проверки доступа
    handleAccessCheck(req, res, parsedUrl) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            const formData = querystring.parse(body);
            const memoCode = (formData.memo_code || '').trim().toUpperCase();
            
            if (!memoCode.startsWith('BLOG-ACCESS-')) {
                this.serveError(res, 400, 'Invalid memo code format');
                return;
            }
            
            // Ищем платеж с этим memo
            const payments = this.loadPayments();
            const payment = Object.values(payments).find(p => 
                p.memo === memoCode && 
                p.status === 'confirmed'
            );
            
            if (payment) {
                // Редирект с токеном в URL (для Tor)
                const redirectUrl = `/blog?token=${payment.access_token}`;
                
                res.writeHead(302, {
                    'Location': redirectUrl,
                    'Cache-Control': 'no-store'
                });
                res.end();
            } else {
                this.servePaymentNotFound(res, memoCode);
            }
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            this.serveError(res, 500, 'Request processing error');
        });
    }

    // Отдача защищенного блога
    serveBlog(req, res, pathname, parsedUrl) {
        const token = parsedUrl.query.token;
        
        if (!token) {
            res.writeHead(302, { 
                'Location': '/',
                'Cache-Control': 'no-store'
            });
            res.end();
            return;
        }
        
        if (!accessControl.checkAccess(token)) {
            this.serveInvalidToken(res);
            return;
        }
        
        // Определяем запрашиваемый файл
        let filePath = pathname === '/blog' ? '/index.html' : pathname.replace('/blog', '');
        if (filePath === '/') filePath = '/index.html';
        
        this.serveBlogFile(req, res, filePath, token);
    }

    // Отдача файлов блога с инъекцией токена
    serveBlogFile(req, res, filePath, token) {
        const fullPath = path.join(this.publicPath, filePath);
        
        // Проверяем существование файла
        fs.access(fullPath, fs.constants.F_OK, (err) => {
            if (err) {
                this.serveError(res, 404, 'File not found');
                return;
            }
            
            fs.readFile(fullPath, 'utf8', (err, data) => {
                if (err) {
                    this.serveError(res, 500, 'Error reading file');
                    return;
                }
                
                const ext = path.extname(fullPath).toLowerCase();
                
                // Для HTML файлов инжектим токен в ссылки
                if (ext === '.html') {
                    data = this.injectTokenIntoContent(data, token);
                }
                
                const contentType = this.getContentType(ext);
                this.sendResponse(res, 200, contentType, data);
            });
        });
    }

    // Инъекция токена в HTML контент
    injectTokenIntoContent(html, token) {
        // Заменяем все относительные ссылки
        return html
            .replace(/href="\/([^"]*)"/g, `href="/blog/$1?token=${token}"`)
            .replace(/href='\/([^']*)'/g, `href='/blog/$1?token=${token}'`)
            .replace(/action="\/([^"]*)"/g, `action="/blog/$1?token=${token}"`)
            .replace(/action='\/([^']*)'/g, `action='/blog/$1?token=${token}'`)
            .replace(/src="\/([^"]*)"/g, `src="/blog/$1?token=${token}"`)
            .replace(/src='\/([^']*)'/g, `src='/blog/$1?token=${token}'`);
    }

    // Отдача статических файлов
    serveStatic(req, res, pathname) {
        if (pathname === '/') {
            this.servePaywall(req, res);
            return;
        }
        
        // Блокируем прямой доступ к блогу
        if (pathname.startsWith('/blog')) {
            res.writeHead(302, { 
                'Location': '/',
                'Cache-Control': 'no-store'
            });
            res.end();
            return;
        }
        
        const fullPath = path.join(this.publicPath, pathname);
        
        fs.access(fullPath, fs.constants.F_OK, (err) => {
            if (err) {
                this.serveError(res, 404, 'Not found');
                return;
            }
            
            fs.readFile(fullPath, (err, data) => {
                if (err) {
                    this.serveError(res, 500, 'Error reading file');
                    return;
                }
                
                const ext = path.extname(fullPath).toLowerCase();
                const contentType = this.getContentType(ext);
                this.sendResponse(res, 200, contentType, data);
            });
        });
    }

    // Страница "платеж не найден"
    servePaymentNotFound(res, memoCode) {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Payment Not Found</title>
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: #0a0a0a;
            color: #e0e0e0;
            text-align: center; 
            margin: 50px auto;
            max-width: 700px;
            padding: 20px;
        }
        .menu {
            background: #1a1a1a;
            border: 1px solid #ffa500;
            border-radius: 3px;
            padding: 15px;
            margin: 30px 0;
            color: #ffa500;
            font-size: 14px;
        }
        .menu span {
            margin: 0 10px;
        }
        .error-box {
            background: #1a1a1a;
            border: 1px solid #ff4444;
            border-radius: 3px;
            padding: 30px;
            margin: 20px 0;
            text-align: left;
        }
        h2 { 
            color: #ff4444; 
            margin-bottom: 20px;
            text-align: center;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }
        ul { 
            margin: 20px 0; 
            padding-left: 20px;
        }
        li { 
            margin: 12px 0; 
            color: #ccc;
            line-height: 1.5;
        }
        .reason-icon {
            color: #ffa500;
            margin-right: 10px;
            font-weight: bold;
        }
        a { 
            color: #ffa500; 
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid #ffa500;
            border-radius: 3px;
            display: inline-block;
            margin: 20px 10px 10px 10px;
            font-size: 14px;
        }
        a:hover { 
            background: #ffa500; 
            color: #000; 
        }
        code { 
            background: #000; 
            color: #ffa500; 
            padding: 4px 8px; 
            border-radius: 2px;
            border: 1px solid #333;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .contact-info {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 3px;
            padding: 20px;
            margin: 30px 0;
            text-align: center;
            font-size: 13px;
        }
        .contact-info p {
            margin: 8px 0;
            color: #888;
        }
        .gpg-fingerprint {
            font-family: 'Courier New', monospace;
            color: #ffa500;
            font-size: 12px;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <!-- Navigation Menu -->
    <div class="menu">
        [<span>HOME</span>]•[<span>BLOG</span>]•[<span>ACCESS</span>]•[<span>CONTACT</span>]•[<span>INFO</span>]
    </div>

    <div class="error-box">
        <h2>[!] PAYMENT NOT FOUND</h2>
        <p>Payment with memo code <code>BLOG-ACCESS-B3G2PA</code> was not found.</p>
        
        <div style="margin: 25px 0;">
            <p><strong>POSSIBLE REASONS:</strong></p>
            <ul>
                <li><span class="reason-icon">[X]</span> Incorrect memo code</li>
                <li><span class="reason-icon">[!]</span> Transaction not confirmed yet (wait 1-2 minutes)</li>
                <li><span class="reason-icon">[$]</span> Payment amount less than 10 $IRON</li>
                <li><span class="reason-icon">[@]</span> Wrong recipient address</li>
                <li><span class="reason-icon">[#]</span> Memo code is case-sensitive</li>
            </ul>
        </div>

        <div style="text-align: center; margin-top: 30px;">
            <a href="/">[<< RETURN TO MAIN]</a>
            <a href="/check-access">[RETRY ACCESS]</a>
        </div>
    </div>

    <!-- Contact Information -->
    <div class="contact-info">
        <p>[CONTACT INFORMATION]</p>
        <p>[@] Contact: gustav.krupp@proton.me</p>
        <p>[#] GPG Fingerprint: <span class="gpg-fingerprint">1234 5678 90AB CDEF 1234 5678 90AB CDEF 1234 5678</span></p>
    </div>

    <!-- Footer Menu -->
    <div class="menu">
        [<span>STATUS: OFFLINE</span>]•[<span>USERS: 0</span>]•[<span>UPTIME: 00:00:00</span>]•[<span>TOR: ACTIVE</span>]
    </div>
</body>
</html>`;
        
        this.sendResponse(res, 200, 'text/html', html);
    }

    // Страница невалидного токена
    serveInvalidToken(res) {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Access Denied</title>
    <style>
        body { 
            font-family: Arial; 
            background: #0a0a0a;
            color: #e0e0e0;
            text-align: center; 
            margin: 100px auto;
            max-width: 500px;
            padding: 20px;
        }
        .denied-box {
            background: #2a1a1a;
            border: 1px solid #663333;
            border-radius: 8px;
            padding: 40px;
        }
        h2 { color: #ff6b6b; margin-bottom: 20px; }
        a { 
            color: #4da6ff; 
            text-decoration: none;
            margin-top: 20px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="denied-box">
        <h2>🚫 Access Denied</h2>
        <p>Your access token is invalid or has expired.</p>
        <p>Please purchase access to continue.</p>
        <a href="/">← Purchase Access</a>
    </div>
</body>
</html>`;
        
        this.sendResponse(res, 403, 'text/html', html);
    }

    // Общая страница ошибок
    serveError(res, statusCode, message) {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Error ${statusCode}</title>
    <style>
        body { 
            font-family: Arial; 
            background: #0a0a0a;
            color: #e0e0e0;
            text-align: center; 
            margin: 100px auto;
            max-width: 500px;
            padding: 20px;
        }
        .error-box {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 40px;
        }
        h2 { color: #ff6b6b; margin-bottom: 20px; }
        a { color: #4da6ff; text-decoration: none; }
    </style>
</head>
<body>
    <div class="error-box">
        <h2>Error ${statusCode}</h2>
        <p>${message}</p>
        <a href="/">← Return to Main Page</a>
    </div>
</body>
</html>`;
        
        this.sendResponse(res, statusCode, 'text/html', html);
    }

    // Определение Content-Type
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
            '.txt': 'text/plain'
        };
        
        return contentTypes[ext] || 'application/octet-stream';
    }

    // Отправка ответа
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
        try {
            return JSON.parse(fs.readFileSync('./payments.json', 'utf8'));
        } catch {
            return {};
        }
    }
}

// Запуск сервера
new TorBlogServer();