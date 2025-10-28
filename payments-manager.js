// payments-manager.js
// Unified module for managing payments - eliminates code duplication
const fs = require('fs');

class PaymentsManager {
    constructor(paymentsFile = './payments.json') {
        this.paymentsFile = paymentsFile;
    }

    load() {
        try {
            return JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8'));
        } catch {
            return {};
        }
    }

    save(payments) {
        fs.writeFileSync(this.paymentsFile, JSON.stringify(payments, null, 2));
    }

    findByToken(token) {
        const payments = this.load();
        return Object.values(payments).find(
            p => p && p.status === 'confirmed' && p.access_token === token
        );
    }

    findByMemo(memo) {
        const payments = this.load();
        return Object.values(payments).find(
            p => p && p.memo === memo && p.status === 'confirmed'
        );
    }

    getPendingPayments(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const payments = this.load();
        return Object.values(payments).filter(p =>
            p && p.status === 'pending' &&
            (now - p.created_at) < maxAgeMs
        );
    }

    cleanupOldPayments(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const payments = this.load();
        let cleaned = 0;

        for (const memo in payments) {
            const payment = payments[memo];
            if (payment && payment.status === 'pending' && (now - payment.created_at) > maxAgeMs) {
                delete payments[memo];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.save(payments);
            console.log(`🗑️  Cleaned up ${cleaned} old pending payments`);
        }

        return cleaned;
    }
}

module.exports = PaymentsManager;
