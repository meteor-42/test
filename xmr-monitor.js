// xmr-manager.js
// Unified Monero Payment Manager - объединяет xmr-monitor, auth, payments-manager
const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

class XMRManager {
    constructor() {
        // File storage
        this.paymentsFile = process.env.PAYMENTS_FILE || './payments.json';
        this.payments = this.loadPayments();

        // RPC settings
        this.rpcUrl = process.env.XMR_RPC_URL;
        this.rpcUsername = process.env.XMR_RPC_USERNAME || '';
        this.rpcPassword = process.env.XMR_RPC_PASSWORD || '';
        this.accountIndex = parseInt(process.env.XMR_ACCOUNT_INDEX || '0', 10);
        this.confirmationsRequired = parseInt(process.env.XMR_CONFIRMATIONS || '2', 10);

        // Wallet info
        this.mainAddress = process.env.XMR_ADDRESS || '';
        this.viewKey = process.env.XMR_VIEW_KEY || '';
        this.amountXmr = parseFloat(process.env.XMR_PAYMENT_AMOUNT || '0.1');
        this.amountAtomic = Math.round(this.amountXmr * 1e12);

        console.log(`💰 XMR Manager initialized: ${this.amountXmr} XMR required`);
    }

    // ========== MONITORING ==========

    startMonitoring() {
        console.log('🔍 Starting payment monitoring (every 15 seconds)...');
        setInterval(() => this.checkPayments(), 15000);
    }

    async checkPayments() {
        const pendingPayments = Object.entries(this.payments)
            .filter(([_, payment]) => payment.status === 'pending' && typeof payment.subaddressIndex === 'number');

        if (pendingPayments.length === 0) return;

        let updated = false;
        for (const [memo, payment] of pendingPayments) {
            const confirmed = await this.checkTransactionWithRetry(payment.subaddressIndex);
            if (confirmed) {
                payment.status = 'confirmed';
                payment.access_token = this.generateToken();
                payment.confirmed_at = Date.now();
                updated = true;
                console.log(`✅ Payment confirmed: ${memo} -> token: ${payment.access_token}`);
            }
        }

        if (updated) this.savePayments();
    }

    async checkTransactionWithRetry(subaddressIndex, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.checkTransaction(subaddressIndex);
            } catch (error) {
                if (i === retries - 1) {
                    console.error(`❌ Failed to check transaction after ${retries} attempts:`, error.message);
                    return false;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        return false;
    }

    async checkTransaction(subaddressIndex) {
        if (!this.rpcUrl) {
            console.warn('⚠️  XMR_RPC_URL not set; cannot check transactions');
            return false;
        }
        try {
            const response = await axios.post(
                this.rpcUrl,
                {
                    jsonrpc: "2.0",
                    id: "0",
                    method: "get_transfers",
                    params: {
                        in: true,
                        account_index: this.accountIndex,
                        subaddr_indices: [subaddressIndex]
                    }
                },
                this.rpcAuth()
            );
            const transfers = (response.data && response.data.result && response.data.result.in) || [];
            return transfers.some(tx => {
                const confirmations = (tx.confirmations || 0);
                const amount = Number(tx.amount || 0);
                const idx = tx.subaddr_index && typeof tx.subaddr_index.minor === 'number'
                    ? tx.subaddr_index.minor : subaddressIndex;
                return idx === subaddressIndex && confirmations >= this.confirmationsRequired && amount >= this.amountAtomic;
            });
        } catch (e) {
            console.error('❌ RPC error (get_transfers):', e.response?.data || e.message);
            throw e;
        }
    }

    async addPayment(memo) {
        if (this.payments[memo]) return this.payments[memo];

        let subaddressIndex = undefined;
        let subaddress = undefined;

        if (this.rpcUrl) {
            try {
                const resp = await axios.post(
                    this.rpcUrl,
                    {
                        jsonrpc: "2.0",
                        id: "0",
                        method: "create_address",
                        params: { account_index: this.accountIndex, label: memo }
                    },
                    this.rpcAuth()
                );
                subaddressIndex = resp.data?.result?.address_index;
                subaddress = resp.data?.result?.address;
                console.log(`📝 Created subaddress for ${memo}: index ${subaddressIndex}`);
            } catch (e) {
                console.error('❌ RPC error (create_address):', e.response?.data || e.message);
            }
        }

        if (typeof subaddressIndex !== 'number') {
            subaddressIndex = Object.keys(this.payments).length + 1;
            console.warn(`⚠️  Using fallback subaddress index: ${subaddressIndex}`);
        }
        if (!subaddress) {
            subaddress = this.mainAddress ? `${this.mainAddress}` : `ADDRESS_${subaddressIndex}`;
        }

        const payment = {
            memo,
            subaddress,
            subaddressIndex,
            status: 'pending',
            created_at: Date.now()
        };
        this.payments[memo] = payment;
        this.savePayments();
        return payment;
    }

    // ========== ACCESS CONTROL ==========

    checkAccess(token) {
        if (!token) return false;
        return !!this.findByToken(token);
    }

    validateToken(token) {
        return typeof token === 'string' && /^[a-z0-9]{10}$/i.test(token);
    }

    // ========== PAYMENTS SEARCH ==========

    findByToken(token) {
        return Object.values(this.payments).find(
            p => p && p.status === 'confirmed' && p.access_token === token
        );
    }

    findByMemo(memo) {
        return Object.values(this.payments).find(
            p => p && p.memo === memo && p.status === 'confirmed'
        );
    }

    getPendingPayments(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        return Object.values(this.payments).filter(p =>
            p && p.status === 'pending' &&
            (now - p.created_at) < maxAgeMs
        );
    }

    cleanupOldPayments(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;

        for (const memo in this.payments) {
            const payment = this.payments[memo];
            if (payment && payment.status === 'pending' && (now - payment.created_at) > maxAgeMs) {
                delete this.payments[memo];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.savePayments();
            console.log(`🗑️  Cleaned up ${cleaned} old pending payments`);
        }

        return cleaned;
    }

    // ========== UTILITIES ==========

    generateToken() {
        return Math.random().toString(36).substring(2, 12);
    }

    loadPayments() {
        try {
            const data = JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8'));
            console.log(`📊 Loaded ${Object.keys(data).length} payments from database`);
            return data;
        } catch {
            console.log('📊 Creating new payments database');
            return {};
        }
    }

    savePayments() {
        try {
            fs.writeFileSync(this.paymentsFile, JSON.stringify(this.payments, null, 2));
        } catch (e) {
            console.error('❌ Failed to save payments:', e.message);
        }
    }

    rpcAuth() {
        const config = {};
        if (this.rpcUsername || this.rpcPassword) {
            config.auth = { username: this.rpcUsername, password: this.rpcPassword };
        }
        return config;
    }
}

module.exports = XMRManager;
