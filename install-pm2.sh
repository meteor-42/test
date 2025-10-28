#!/bin/bash

# [INSTALL] XMR Tor Paywall - Installation script for CentOS/RHEL/Rocky Linux with PM2
# With support for importing existing wallet and Tor keys
# Usage: sudo bash install-pm2.sh

set -e

echo "[INSTALL] Starting XMR Tor Paywall installation for CentOS/RHEL/Rocky Linux with PM2..."
echo ""

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] Run script with root privileges: sudo bash install-pm2.sh"
    exit 1
fi

# Check system
if ! command -v dnf &> /dev/null; then
    echo "[ERROR] This script is for CentOS/RHEL/Rocky Linux only"
    echo "[ERROR] dnf command not found"
    exit 1
fi

# Determine user
REAL_USER=${SUDO_USER:-$(whoami)}
USER_HOME=$(eval echo ~$REAL_USER)
echo "[USER] Installing for user: $REAL_USER"
echo "[HOME] Home directory: $USER_HOME"
echo ""

# 1. System update
echo "[PACKAGE] Updating system..."
dnf update -y

# 2. Install Node.js
echo "[PACKAGE] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    dnf install -y nodejs
fi
echo "[OK] Node.js $(node --version) installed"

# 3. Install PM2 globally
echo "[PACKAGE] Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "[OK] PM2 $(pm2 --version) installed"

# Setup PM2 startup script
pm2 startup systemd -u $REAL_USER --hp $USER_HOME
echo "[OK] PM2 startup configured"

# 4. Install Tor
echo "[PACKAGE] Installing Tor..."
if ! command -v tor &> /dev/null; then
    dnf install -y epel-release
    dnf install -y tor
fi
echo "[OK] Tor installed"

# 5. Install dependencies
echo "[PACKAGE] Installing dependencies..."
dnf install -y wget tar bzip2 curl jq

# 6. Download and install Monero
echo "[PACKAGE] Installing Monero Wallet RPC..."
if [ ! -f /usr/local/bin/monero-wallet-rpc ]; then
    cd /tmp
    wget -q https://downloads.getmonero.org/cli/linux64 -O monero.tar.bz2
    tar -xjf monero.tar.bz2
    find . -name "monero-wallet-rpc" -exec cp {} /usr/local/bin/ \;
    find . -name "monero-wallet-cli" -exec cp {} /usr/local/bin/ \;
    chmod +x /usr/local/bin/monero-wallet-*
    rm -rf monero* linux64
fi
echo "[OK] Monero Wallet RPC installed"
echo ""

# 7. IMPORT/CREATE WALLET
echo "========================================="
echo "[XMR] MONERO WALLET SETUP"
echo "========================================="
echo ""
echo "Do you have an existing wallet?"
echo "1) Yes, I have a seed phrase (25 words)"
echo "2) Yes, I have wallet files (.keys)"
echo "3) No, create a new wallet"
echo ""
read -p "Choose option (1/2/3): " WALLET_CHOICE

WALLET_DIR="$USER_HOME/.monero-wallet"
WALLET_FILE="$WALLET_DIR/payment-wallet"

mkdir -p "$WALLET_DIR"
chown $REAL_USER:$REAL_USER "$WALLET_DIR"

case $WALLET_CHOICE in
    1)
        echo ""
        echo "[INFO] Restoring wallet from seed phrase..."
        echo "WARNING: Make sure you are running this in a secure environment!"
        echo ""
        sudo -u $REAL_USER monero-wallet-cli --generate-from-seed "$WALLET_FILE"
        echo ""
        echo "[OK] Wallet restored from seed phrase"
        ;;
    2)
        echo ""
        read -p "Enter path to wallet files directory: " BACKUP_DIR
        if [ ! -f "$BACKUP_DIR/payment-wallet" ] || [ ! -f "$BACKUP_DIR/payment-wallet.keys" ]; then
            echo "[ERROR] Wallet files not found in $BACKUP_DIR"
            exit 1
        fi
        cp "$BACKUP_DIR/payment-wallet" "$WALLET_FILE"
        cp "$BACKUP_DIR/payment-wallet.keys" "$WALLET_FILE.keys"
        chown $REAL_USER:$REAL_USER "$WALLET_FILE"*
        chmod 600 "$WALLET_FILE"*
        echo "[OK] Wallet imported from backup"
        ;;
    3)
        echo ""
        echo "[INFO] Creating new wallet..."
        echo "WARNING: SAVE YOUR SEED PHRASE!"
        echo ""
        sudo -u $REAL_USER monero-wallet-cli --generate-new-wallet "$WALLET_FILE"
        echo ""
        echo "[OK] New wallet created"
        ;;
    *)
        echo "[ERROR] Invalid choice"
        exit 1
        ;;
esac

# Get wallet address
echo ""
echo "[INFO] Getting wallet address..."
read -sp "Enter wallet password: " WALLET_PASSWORD
echo ""

XMR_ADDRESS=$(echo "address" | sudo -u $REAL_USER monero-wallet-cli --wallet-file "$WALLET_FILE" --password "$WALLET_PASSWORD" --command address 2>/dev/null | grep "^4" | head -1 || echo "")

if [ -z "$XMR_ADDRESS" ]; then
    echo "[WARNING] Could not automatically get address"
    read -p "Enter XMR address manually: " XMR_ADDRESS
fi

echo "[OK] XMR address: $XMR_ADDRESS"
echo ""

# 8. TOR HIDDEN SERVICE SETUP
echo "========================================="
echo "[TOR] TOR HIDDEN SERVICE SETUP"
echo "========================================="
echo ""
echo "Do you have an existing Tor hidden service?"
echo "1) Yes, I have a backup (hostname + keys)"
echo "2) No, create a new one"
echo ""
read -p "Choose option (1/2): " TOR_CHOICE

TOR_SERVICE_DIR="/var/lib/tor/blog_service"

case $TOR_CHOICE in
    1)
        echo ""
        read -p "Enter path to Tor keys backup directory: " TOR_BACKUP_DIR
        if [ ! -f "$TOR_BACKUP_DIR/hostname" ]; then
            echo "[ERROR] hostname file not found in $TOR_BACKUP_DIR"
            exit 1
        fi

        mkdir -p "$TOR_SERVICE_DIR"
        cp "$TOR_BACKUP_DIR/hostname" "$TOR_SERVICE_DIR/"
        cp "$TOR_BACKUP_DIR/hs_ed25519_secret_key" "$TOR_SERVICE_DIR/" 2>/dev/null || true
        cp "$TOR_BACKUP_DIR/hs_ed25519_public_key" "$TOR_SERVICE_DIR/" 2>/dev/null || true

        # Determine Tor user for CentOS/RHEL
        TOR_USER="toranon"
        if ! id "$TOR_USER" &>/dev/null; then
            TOR_USER="tor"
        fi

        chown -R $TOR_USER:$TOR_USER "$TOR_SERVICE_DIR"
        chmod 700 "$TOR_SERVICE_DIR"
        chmod 600 "$TOR_SERVICE_DIR"/*

        ONION_ADDRESS=$(cat "$TOR_SERVICE_DIR/hostname")
        echo "[OK] Tor hidden service imported"
        echo "[OK] Onion address: $ONION_ADDRESS"
        ;;
    2)
        echo ""
        echo "[INFO] Creating new Tor hidden service..."
        mkdir -p "$TOR_SERVICE_DIR"

        # Determine Tor user for CentOS/RHEL
        TOR_USER="toranon"
        if ! id "$TOR_USER" &>/dev/null; then
            TOR_USER="tor"
        fi

        chown -R $TOR_USER:$TOR_USER "$TOR_SERVICE_DIR"
        chmod 700 "$TOR_SERVICE_DIR"
        echo "[OK] Directory created (onion address will be generated when Tor starts)"
        ONION_ADDRESS="will-be-generated.onion"
        ;;
    *)
        echo "[ERROR] Invalid choice"
        exit 1
        ;;
esac

# 9. Configure torrc
echo ""
echo "[TOR] Configuring Tor..."
TOR_CONFIG="/etc/tor/torrc"
if ! grep -q "HiddenServiceDir $TOR_SERVICE_DIR" "$TOR_CONFIG"; then
    cat >> "$TOR_CONFIG" << EOF

# XMR Paywall Hidden Service
HiddenServiceDir $TOR_SERVICE_DIR/
HiddenServicePort 80 127.0.0.1:8080
EOF
    echo "[OK] Tor configuration updated"
fi

# Start Tor
systemctl enable tor
systemctl restart tor
sleep 5

# Get onion address (if creating new)
if [ "$TOR_CHOICE" = "2" ] && [ -f "$TOR_SERVICE_DIR/hostname" ]; then
    ONION_ADDRESS=$(cat "$TOR_SERVICE_DIR/hostname")
    echo "[OK] New Onion address: $ONION_ADDRESS"
fi

# 10. Install Node.js dependencies
echo "[PACKAGE] Installing Node.js dependencies..."
cd "$(dirname "$0")"
sudo -u $REAL_USER npm install

# 11. Update .env file
echo "[CONFIG] Updating configuration..."
sed -i "s|ONION_ADDRESS=.*|ONION_ADDRESS=$ONION_ADDRESS|g" .env
sed -i "s|XMR_ADDRESS=.*|XMR_ADDRESS=$XMR_ADDRESS|g" .env
chmod 600 .env
chown $REAL_USER:$REAL_USER .env

# 12. Update PM2 ecosystem config with wallet password
echo "[PM2] Configuring PM2 ecosystem..."
sed -i "s|YOUR_WALLET_PASSWORD|$WALLET_PASSWORD|g" ecosystem.config.js
sed -i "s|~/.monero-wallet/payment-wallet|$WALLET_FILE|g" ecosystem.config.js

# 13. Configure firewall
echo "[FIREWALL] Configuring firewall (firewalld)..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --remove-port=8080/tcp 2>/dev/null || true
    firewall-cmd --permanent --remove-port=18083/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "[OK] Firewall configured (ports 8080 and 18083 closed)"
fi

# 14. SELinux
if command -v getenforce &> /dev/null && [ "$(getenforce)" != "Disabled" ]; then
    echo "[SELINUX] Configuring SELinux..."
    semanage port -a -t http_port_t -p tcp 8080 2>/dev/null || semanage port -m -t http_port_t -p tcp 8080
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    echo "[OK] SELinux configured"
fi

# 15. Start services with PM2
echo "[PM2] Starting services..."
sudo -u $REAL_USER pm2 start ecosystem.config.js
sudo -u $REAL_USER pm2 save

# 16. Create backup script
echo "[BACKUP] Creating backup script..."
cat > /usr/local/bin/xmr-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/xmr"
mkdir -p "$BACKUP_DIR"

# Backup application
tar -czf "$BACKUP_DIR/xmr-backup-$DATE.tar.gz" \
    -C $(dirname "$0")/../../var/www/xmr \
    .env payments.json 2>/dev/null || true

# Backup Tor keys
tar -czf "$BACKUP_DIR/tor-backup-$DATE.tar.gz" \
    -C /var/lib/tor/blog_service \
    hostname hs_ed25519_secret_key hs_ed25519_public_key 2>/dev/null || true

# Delete old (>30 days)
find "$BACKUP_DIR" -name "*-backup-*.tar.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/*-backup-$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/xmr-backup.sh

# 17. Check status
sleep 3
echo ""
echo "=================================="
echo "[OK] INSTALLATION COMPLETE!"
echo "=================================="
echo ""
echo "[STATUS] Services status:"
sudo -u $REAL_USER pm2 list
echo ""
echo "[TOR] Your Onion address: $ONION_ADDRESS"
echo "[XMR] XMR address: $XMR_ADDRESS"
echo ""
echo "[NEXT] Next steps:"
echo "1. Check configuration: nano .env"
echo "2. Restart if needed: pm2 restart all"
echo "3. Check logs: pm2 logs"
echo ""
echo "[BACKUP] Backup:"
echo "- Wallet seed phrase: STORE IN A SAFE PLACE!"
echo "- Tor keys: sudo /usr/local/bin/xmr-backup.sh"
echo "- Auto backup: add to crontab"
echo "  crontab -e -> 0 3 * * * /usr/local/bin/xmr-backup.sh"
echo ""
echo "[COMMANDS] Useful commands:"
echo "- Logs: pm2 logs"
echo "- Status: pm2 status"
echo "- Restart: pm2 restart all"
echo "- Stop: pm2 stop all"
echo "- Backup: sudo /usr/local/bin/xmr-backup.sh"
echo ""
echo "[WARNING] IMPORTANT:"
echo "- Never publish .env file"
echo "- Store seed phrase in a safe place (NOT on server!)"
echo "- Regularly backup Tor keys"
echo "- Regularly withdraw funds from payment wallet"
echo ""
echo "**Stay anonymous. Stay secure.** [LOCK]"
