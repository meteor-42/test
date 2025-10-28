// Access control based on payments.json
const fs = require('fs');
require('dotenv').config();

class AccessControl {
  constructor() {
    this.paymentsFile = process.env.PAYMENTS_FILE || './payments.json';
  }

  loadPayments() {
    try {
      return JSON.parse(fs.readFileSync(this.paymentsFile, 'utf8'));
    } catch {
      return {};
    }
  }

  checkAccess(token) {
    if (!token) return false;
    const payments = this.loadPayments();
    return Object.values(payments).some(
      (p) => p && p.status === 'confirmed' && p.access_token === token
    );
  }
}

module.exports = AccessControl;
