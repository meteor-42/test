// Access control based on payments.json
const PaymentsManager = require('./payments-manager');
require('dotenv').config();

class AccessControl {
  constructor() {
    this.paymentsManager = new PaymentsManager(process.env.PAYMENTS_FILE || './payments.json');
  }

  checkAccess(token) {
    if (!token) return false;
    return !!this.paymentsManager.findByToken(token);
  }

  validateToken(token) {
    // Token should be alphanumeric, 10 characters
    return typeof token === 'string' && /^[a-z0-9]{10}$/i.test(token);
  }
}

module.exports = AccessControl;
