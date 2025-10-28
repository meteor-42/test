// xmr-monitor.js
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

class PaymentMonitor {
    constructor() {
        this.paymentsFile = process.env.PAYMENTS_FILE || './payments.json';
        this.payments = this.loadPayments();
        this.rpcUrl = process.env.XMR_RPC_URL;
        this.mainAddress = process.env.XMR_ADDRESS;
        this.viewKey = process.env.XMR_VIEW_KEY;
        this.amount = parseFloat(process.env.XMR_PAYMENT_AMOUNT) || 0.1;
    }

    startMonitoring() {
        setInterval(() => this.checkPayments(), 15000); // каждые 15 секунд
    }

    async checkPayments() {
        for (const memo in this.payments) {
            const payment = this.payments[memo];
            if (payment.status === 'pending') {
                const confirmed = await this.checkTransaction(payment.subaddressIndex, memo);
                if (confirmed) {
                    payment.status = 'confirmed';
                    payment.access_token = this.generateToken();
                    this.savePayments();
                }
            }
        }
    }

    async checkTransaction(subaddressIndex, memo) {
        try {
            const response = await axios.post(this.rpcUrl, {
                jsonrpc: "2.0",
                id: "0",
                method: "get_transfers",
                params: {
                    in: true,
                    account_index: 0,
                    subaddr_indices: [subaddressIndex]
                }
            });
            const transfers = response.data.result.in || [];
            return transfers.some(tx => tx.payment_id === memo && tx.amount >= this.amount * 1e12);
        } catch (e) {
            console.error('RPC error:', e.message);
            return false;
        }
    }

    addPayment(memo) {
        const subaddressIndex = Object.keys(this.payments).length + 1;
        const subaddress = `${this.mainAddress}+${subaddressIndex}`; // просто placeholder, реальная генерация через RPC
        const payment = { memo, subaddress, subaddressIndex, status: 'pending' };
        this.payments[memo] = payment;
        this.savePayments();
        return payment;
    }

    generateToken() {
        return Math.random().toString(36).substring(2, 12);
    }

    loadPayments() {
        try {
            return JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8'));
        } catch {
            return {};
        }
    }

    savePayments() {
        fs.writeFileSync(this.paymentsFile, JSON.stringify(this.payments, null, 2));
    }
}

module.exports = PaymentMonitor;
