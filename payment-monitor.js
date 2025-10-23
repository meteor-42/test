const fs = require('fs');
const { exec } = require('child_process');
const AccessControl = require('./auth');

class PaymentMonitor {
    constructor() {
        this.paymentsFile = './payments.json';
        this.accessControl = new AccessControl();
        this.loadPayments();
    }

    loadPayments() {
        try {
            this.payments = JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8'));
        } catch {
            this.payments = {};
            this.savePayments();
        }
    }

    savePayments() {
        fs.writeFileSync(this.paymentsFile, JSON.stringify(this.payments, null, 2));
    }

    // Основной метод проверки платежей
    checkPayments() {
        console.log('🔍 Checking for new payments...');
        
        this.getTransactions((error, transactions) => {
            if (error) {
                console.error('❌ Failed to get transactions:', error);
                return;
            }

            const relevantTxs = transactions.filter(tx => 
                tx.memo && 
                tx.memo.startsWith('BLOG-ACCESS-') && 
                tx.amount >= 10
            );

            if (relevantTxs.length > 0) {
                console.log(`💰 Found ${relevantTxs.length} relevant transactions`);
                relevantTxs.forEach(tx => this.processTransaction(tx));
            }
        });
    }

    // Получение транзакций через IronFish CLI
    getTransactions(callback) {
        exec('ironfish wallet:transactions', (error, stdout, stderr) => {
            if (error) {
                callback(error, null);
                return;
            }

            if (stderr) {
                console.error('IronFish stderr:', stderr);
            }

            const transactions = this.parseTransactionOutput(stdout);
            callback(null, transactions);
        });
    }

    // Парсинг вывода IronFish CLI
    parseTransactionOutput(output) {
        const transactions = [];
        const lines = output.split('\n');
        
        let currentTx = null;
        let inTransactionBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Начало новой транзакции
            if (trimmed.startsWith('Transaction:')) {
                if (currentTx) {
                    transactions.push(currentTx);
                }
                currentTx = { hash: '', amount: 0, memo: '', status: '' };
                inTransactionBlock = true;
                continue;
            }

            if (!inTransactionBlock || !currentTx) continue;

            // Извлечение данных транзакции
            if (trimmed.startsWith('Hash:')) {
                currentTx.hash = trimmed.replace('Hash:', '').trim();
            }
            else if (trimmed.startsWith('Amount:')) {
                const amountStr = trimmed.replace('Amount:', '').trim();
                const amountMatch = amountStr.match(/([\d.]+)\s+IRON/);
                if (amountMatch) {
                    currentTx.amount = parseFloat(amountMatch[1]);
                }
            }
            else if (trimmed.startsWith('Memo:')) {
                currentTx.memo = trimmed.replace('Memo:', '').trim();
            }
            else if (trimmed.startsWith('Status:')) {
                currentTx.status = trimmed.replace('Status:', '').trim();
            }
            // Конец блока транзакции
            else if (trimmed === '' && currentTx.hash) {
                transactions.push(currentTx);
                currentTx = null;
                inTransactionBlock = false;
            }
        }

        // Добавляем последнюю транзакцию
        if (currentTx && currentTx.hash) {
            transactions.push(currentTx);
        }

        return transactions.filter(tx => tx.status === 'confirmed' || tx.status === 'pending');
    }

    // Обработка отдельной транзакции
    processTransaction(tx) {
        // Проверяем, не обрабатывали ли уже эту транзакцию
        if (this.payments[tx.hash]) {
            return;
        }

        console.log(`🔄 Processing transaction: ${tx.hash}`);
        console.log(`   Memo: ${tx.memo}, Amount: ${tx.amount} IRON, Status: ${tx.status}`);

        // Для confirmed транзакций сразу создаем доступ
        if (tx.status === 'confirmed') {
            this.grantAccess(tx);
        }
        // Для pending транзакций проверяем позже
        else if (tx.status === 'pending') {
            console.log(`   ⏳ Transaction pending, will check later: ${tx.hash}`);
            this.payments[tx.hash] = {
                memo: tx.memo,
                amount: tx.amount,
                status: 'pending',
                first_seen: Date.now()
            };
            this.savePayments();
        }
    }

    // Создание доступа
    grantAccess(tx) {
        const accessToken = this.accessControl.createAccess(tx.memo);
        
        this.payments[tx.hash] = {
            memo: tx.memo,
            amount: tx.amount,
            status: 'confirmed',
            access_token: accessToken,
            processed_at: Date.now(),
            confirmed_at: Date.now()
        };
        
        this.savePayments();
        console.log(`✅ Access granted for memo: ${tx.memo}`);
        console.log(`   Token: ${accessToken}`);
    }

    // Проверка pending транзакций
    checkPendingTransactions() {
        const pendingTxs = Object.entries(this.payments)
            .filter(([hash, data]) => data.status === 'pending')
            .map(([hash, data]) => ({ hash, ...data }));

        if (pendingTxs.length > 0) {
            console.log(`🔍 Checking ${pendingTxs.length} pending transactions...`);
            
            this.getTransactions((error, currentTxs) => {
                if (error) return;

                pendingTxs.forEach(pending => {
                    const currentTx = currentTxs.find(tx => tx.hash === pending.hash);
                    
                    if (currentTx && currentTx.status === 'confirmed') {
                        console.log(`✅ Transaction confirmed: ${pending.hash}`);
                        this.grantAccess({
                            hash: pending.hash,
                            memo: pending.memo,
                            amount: pending.amount,
                            status: 'confirmed'
                        });
                    }
                    // Если транзакция висит pending слишком долго
                    else if (Date.now() - pending.first_seen > 30 * 60 * 1000) { // 30 минут
                        console.log(`❌ Transaction stuck: ${pending.hash}`);
                        delete this.payments[pending.hash];
                        this.savePayments();
                    }
                });
            });
        }
    }

    startMonitoring() {
        console.log('🚀 Starting payment monitoring system...');
        
        // Основная проверка каждые 30 секунд
        setInterval(() => {
            this.checkPayments();
        }, 30000);
        
        // Проверка pending транзакций каждые 2 минуты
        setInterval(() => {
            this.checkPendingTransactions();
        }, 120000);
        
        // Очистка старых записей раз в день
        setInterval(() => {
            this.cleanupOldRecords();
        }, 24 * 60 * 60 * 1000);
        
        // Первая проверка
        setTimeout(() => {
            this.checkPayments();
            this.checkPendingTransactions();
        }, 5000);
    }

    cleanupOldRecords() {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        
        let cleaned = 0;
        Object.keys(this.payments).forEach(hash => {
            if (this.payments[hash].processed_at && this.payments[hash].processed_at < thirtyDaysAgo) {
                delete this.payments[hash];
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            this.savePayments();
            console.log(`🧹 Cleaned ${cleaned} old payment records`);
        }
    }
}

module.exports = PaymentMonitor;