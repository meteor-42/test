const fs = require('fs');
const { exec } = require('child_process');

class AccessControl {
    constructor() {
        this.tokensFile = './tokens.json';
        this.loadTokens();
    }

    loadTokens() {
        try {
            this.tokens = JSON.parse(fs.readFileSync(this.tokensFile, 'utf8'));
        } catch {
            this.tokens = {};
            this.saveTokens();
        }
    }

    saveTokens() {
        fs.writeFileSync(this.tokensFile, JSON.stringify(this.tokens, null, 2));
    }

    // Создание доступа с дополнительной проверкой
    createAccess(memoCode) {
        // Проверяем, нет ли уже доступа для этого memo
        const existingToken = Object.keys(this.tokens).find(token => 
            this.tokens[token].memo_code === memoCode
        );
        
        if (existingToken) {
            console.log(`⚠️ Access already exists for memo: ${memoCode}`);
            return existingToken;
        }

        const accessToken = this.generateSecureToken();
        const expires = Date.now() + (30 * 24 * 60 * 60 * 1000);
        
        this.tokens[accessToken] = {
            memo_code: memoCode,
            created: Date.now(),
            expires: expires,
            visits: 0,
            last_visit: null
        };
        
        this.saveTokens();
        console.log(`🔑 New access token created for: ${memoCode}`);
        return accessToken;
    }

    checkAccess(token) {
        const access = this.tokens[token];
        if (!access) {
            console.log(`❌ Invalid token: ${token}`);
            return false;
        }
        
        // Проверка срока действия
        if (Date.now() > access.expires) {
            console.log(`⌛ Token expired: ${token}`);
            delete this.tokens[token];
            this.saveTokens();
            return false;
        }
        
        // Обновляем статистику
        access.visits++;
        access.last_visit = Date.now();
        this.saveTokens();
        
        console.log(`✅ Valid access: ${token}, visits: ${access.visits}`);
        return true;
    }

    generateSecureToken() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    // Валидация через IronFish (дополнительная проверка)
    validatePaymentWithIronFish(memoCode, callback) {
        exec('ironfish wallet:transactions', (error, stdout, stderr) => {
            if (error) {
                callback(error, null);
                return;
            }

            const transactions = this.parseTransactionOutput(stdout);
            const relevantTx = transactions.find(tx => 
                tx.memo === memoCode && 
                tx.amount >= 10 && 
                tx.status === 'confirmed'
            );

            callback(null, relevantTx);
        });
    }

    parseTransactionOutput(output) {
        // Та же логика парсинга, что и в payment-monitor
        const transactions = [];
        const lines = output.split('\n');
        
        let currentTx = null;
        let inTransactionBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('Transaction:')) {
                if (currentTx) transactions.push(currentTx);
                currentTx = { hash: '', amount: 0, memo: '', status: '' };
                inTransactionBlock = true;
                continue;
            }

            if (!inTransactionBlock || !currentTx) continue;

            if (trimmed.startsWith('Hash:')) {
                currentTx.hash = trimmed.replace('Hash:', '').trim();
            }
            else if (trimmed.startsWith('Amount:')) {
                const amountStr = trimmed.replace('Amount:', '').trim();
                const amountMatch = amountStr.match(/([\d.]+)\s+IRON/);
                if (amountMatch) currentTx.amount = parseFloat(amountMatch[1]);
            }
            else if (trimmed.startsWith('Memo:')) {
                currentTx.memo = trimmed.replace('Memo:', '').trim();
            }
            else if (trimmed.startsWith('Status:')) {
                currentTx.status = trimmed.replace('Status:', '').trim();
            }
            else if (trimmed === '' && currentTx.hash) {
                transactions.push(currentTx);
                currentTx = null;
                inTransactionBlock = false;
            }
        }

        if (currentTx && currentTx.hash) {
            transactions.push(currentTx);
        }

        return transactions;
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        Object.keys(this.tokens).forEach(token => {
            if (this.tokens[token].expires < now) {
                delete this.tokens[token];
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            this.saveTokens();
            console.log(`🧹 Cleaned ${cleaned} expired tokens`);
        }
        
        return cleaned;
    }

    // Статистика
    getStats() {
        const now = Date.now();
        const activeTokens = Object.values(this.tokens).filter(t => t.expires > now);
        
        return {
            total_tokens: Object.keys(this.tokens).length,
            active_tokens: activeTokens.length,
            total_visits: activeTokens.reduce((sum, t) => sum + t.visits, 0)
        };
    }
}

module.exports = AccessControl;