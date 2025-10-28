// rate-limiter.js
// Simple rate limiter to prevent DDoS and abuse

class RateLimiter {
    constructor(maxRequests = 5, windowMs = 60000) {
        this.requests = new Map();
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;

        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    check(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];

        // Remove old requests outside the time window
        const recentRequests = userRequests.filter(time => now - time < this.windowMs);

        if (recentRequests.length >= this.maxRequests) {
            return false; // Rate limit exceeded
        }

        recentRequests.push(now);
        this.requests.set(identifier, recentRequests);
        return true;
    }

    cleanup() {
        const now = Date.now();
        for (const [identifier, requests] of this.requests.entries()) {
            const recentRequests = requests.filter(time => now - time < this.windowMs);
            if (recentRequests.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, recentRequests);
            }
        }
    }

    reset(identifier) {
        this.requests.delete(identifier);
    }
}

module.exports = RateLimiter;
