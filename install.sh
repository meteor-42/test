#!/bin/bash

# 🚀 XMR Tor Paywall - Скрипт установки для CentOS/RHEL/Rocky Linux
# С поддержкой импорта существующего кошелька и Tor ключей
# Использование: sudo bash install.sh

set -e

echo "🔧 Начинаем установку XMR Tor Paywall для CentOS/RHEL/Rocky Linux..."
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install.sh"
    exit 1
fi

# Проверка системы
if ! command -v dnf &> /dev/null; then
    echo "❌ Этот скрипт предназначен только для CentOS/RHEL/Rocky Linux"
    echo "❌ Команда dnf не найдена"
    exit 1
fi

# Определение пользователя
REAL_USER=${SUDO_USER:-$(whoami)}
USER_HOME=$(eval echo ~$REAL_USER)
echo "👤 Установка для пользователя: $REAL_USER"
echo "🏠 Домашняя директория: $USER_HOME"
echo ""

# 1. Обновление системы
echo "📦 Обновление системы..."
dnf update -y

# 2. Установка Node.js
echo "📦 Установка Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    dnf install -y nodejs
fi
echo "✅ Node.js $(node --version) установлен"

# 3. Установка Tor
echo "📦 Установка Tor..."
if ! command -v tor &> /dev/null; then
    dnf install -y epel-release
    dnf install -y tor
fi
echo "✅ Tor установлен"

# 4. Установка зависимостей
echo "📦 Установка зависимостей..."
dnf install -y wget tar bzip2 curl jq

# 5. Скачивание и установка Monero
echo "📦 Установка Monero Wallet RPC..."
if [ ! -f /usr/local/bin/monero-wallet-rpc ]; then
    cd /tmp
    wget -q https://downloads.getmonero.org/cli/linux64 -O monero.tar.bz2
    tar -xjf monero.tar.bz2
    find . -name "monero-wallet-rpc" -exec cp {} /usr/local/bin/ \;
    find . -name "monero-wallet-cli" -exec cp {} /usr/local/bin/ \;
    chmod +x /usr/local/bin/monero-wallet-*
    rm -rf monero* linux64
fi
echo "✅ Monero Wallet RPC установлен"
echo ""

# 6. ИМПОРТ/СОЗДАНИЕ КОШЕЛЬКА
echo "========================================="
echo "💰 НАСТРОЙКА MONERO КОШЕЛЬКА"
echo "========================================="
echo ""
echo "У вас есть существующий кошелек?"
echo "1) Да, у меня есть seed фраза (25 слов)"
echo "2) Да, у меня есть файлы кошелька (.keys)"
echo "3) Нет, создать новый кошелек"
echo ""
read -p "Выберите вариант (1/2/3): " WALLET_CHOICE

WALLET_DIR="$USER_HOME/.monero-wallet"
WALLET_FILE="$WALLET_DIR/payment-wallet"

mkdir -p "$WALLET_DIR"
chown $REAL_USER:$REAL_USER "$WALLET_DIR"

case $WALLET_CHOICE in
    1)
        echo ""
        echo "📝 Восстановление кошелька из seed фразы..."
        echo "ВНИМАНИЕ: Убедитесь что вы запускаете это в безопасном окружении!"
        echo ""
        sudo -u $REAL_USER monero-wallet-cli --generate-from-seed "$WALLET_FILE"
        echo ""
        echo "✅ Кошелек восстановлен из seed фразы"
        ;;
    2)
        echo ""
        read -p "Введите путь к директории с файлами кошелька: " BACKUP_DIR
        if [ ! -f "$BACKUP_DIR/payment-wallet" ] || [ ! -f "$BACKUP_DIR/payment-wallet.keys" ]; then
            echo "❌ Файлы кошелька не найдены в $BACKUP_DIR"
            exit 1
        fi
        cp "$BACKUP_DIR/payment-wallet" "$WALLET_FILE"
        cp "$BACKUP_DIR/payment-wallet.keys" "$WALLET_FILE.keys"
        chown $REAL_USER:$REAL_USER "$WALLET_FILE"*
        chmod 600 "$WALLET_FILE"*
        echo "✅ Кошелек импортирован из backup"
        ;;
    3)
        echo ""
        echo "📝 Создание нового кошелька..."
        echo "ВНИМАНИЕ: ОБЯЗАТЕЛЬНО СОХРАНИТЕ SEED ФРАЗУ!"
        echo ""
        sudo -u $REAL_USER monero-wallet-cli --generate-new-wallet "$WALLET_FILE"
        echo ""
        echo "✅ Новый кошелек создан"
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

# Получить адрес кошелька
echo ""
echo "📋 Получаем адрес кошелька..."
read -sp "Введите пароль кошелька: " WALLET_PASSWORD
echo ""

XMR_ADDRESS=$(echo "address" | sudo -u $REAL_USER monero-wallet-cli --wallet-file "$WALLET_FILE" --password "$WALLET_PASSWORD" --command address 2>/dev/null | grep "^4" | head -1 || echo "")

if [ -z "$XMR_ADDRESS" ]; then
    echo "⚠️  Не удалось автоматически получить адрес"
    read -p "Введите XMR адрес вручную: " XMR_ADDRESS
fi

echo "✅ XMR адрес: $XMR_ADDRESS"
echo ""

# 7. НАСТРОЙКА TOR HIDDEN SERVICE
echo "========================================="
echo "🧅 НАСТРОЙКА TOR HIDDEN SERVICE"
echo "========================================="
echo ""
echo "У вас есть существующий Tor hidden service?"
echo "1) Да, у меня есть backup (hostname + ключи)"
echo "2) Нет, создать новый"
echo ""
read -p "Выберите вариант (1/2): " TOR_CHOICE

TOR_SERVICE_DIR="/var/lib/tor/blog_service"

case $TOR_CHOICE in
    1)
        echo ""
        read -p "Введите путь к директории с backup Tor ключей: " TOR_BACKUP_DIR
        if [ ! -f "$TOR_BACKUP_DIR/hostname" ]; then
            echo "❌ Файл hostname не найден в $TOR_BACKUP_DIR"
            exit 1
        fi

        mkdir -p "$TOR_SERVICE_DIR"
        cp "$TOR_BACKUP_DIR/hostname" "$TOR_SERVICE_DIR/"
        cp "$TOR_BACKUP_DIR/hs_ed25519_secret_key" "$TOR_SERVICE_DIR/" 2>/dev/null || true
        cp "$TOR_BACKUP_DIR/hs_ed25519_public_key" "$TOR_SERVICE_DIR/" 2>/dev/null || true

        # Определить пользователя Tor для CentOS/RHEL
        TOR_USER="toranon"
        if ! id "$TOR_USER" &>/dev/null; then
            TOR_USER="tor"
        fi

        chown -R $TOR_USER:$TOR_USER "$TOR_SERVICE_DIR"
        chmod 700 "$TOR_SERVICE_DIR"
        chmod 600 "$TOR_SERVICE_DIR"/*

        ONION_ADDRESS=$(cat "$TOR_SERVICE_DIR/hostname")
        echo "✅ Tor hidden service импортирован"
        echo "✅ Onion адрес: $ONION_ADDRESS"
        ;;
    2)
        echo ""
        echo "📝 Создание нового Tor hidden service..."
        mkdir -p "$TOR_SERVICE_DIR"

        # Определить пользователя Tor для CentOS/RHEL
        TOR_USER="toranon"
        if ! id "$TOR_USER" &>/dev/null; then
            TOR_USER="tor"
        fi

        chown -R $TOR_USER:$TOR_USER "$TOR_SERVICE_DIR"
        chmod 700 "$TOR_SERVICE_DIR"
        echo "✅ Директория создана (onion адрес будет сгенерирован при запуске Tor)"
        ONION_ADDRESS="будет-сгенерирован.onion"
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

# 8. Настройка torrc
echo ""
echo "🔧 Настройка Tor конфигурации..."
TOR_CONFIG="/etc/tor/torrc"
if ! grep -q "HiddenServiceDir $TOR_SERVICE_DIR" "$TOR_CONFIG"; then
    cat >> "$TOR_CONFIG" << EOF

# XMR Paywall Hidden Service
HiddenServiceDir $TOR_SERVICE_DIR/
HiddenServicePort 80 127.0.0.1:8080
EOF
    echo "✅ Tor конфигурация обновлена"
fi

# Запуск Tor
systemctl enable tor
systemctl restart tor
sleep 5

# Получение onion адреса (если создавали новый)
if [ "$TOR_CHOICE" = "2" ] && [ -f "$TOR_SERVICE_DIR/hostname" ]; then
    ONION_ADDRESS=$(cat "$TOR_SERVICE_DIR/hostname")
    echo "✅ Новый Onion адрес: $ONION_ADDRESS"
fi

# 9. Создание systemd сервиса для Monero RPC
echo ""
echo "🔧 Создание Monero Wallet RPC сервиса..."
cat > /etc/systemd/system/monero-wallet-rpc.service << EOF
[Unit]
Description=Monero Wallet RPC
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$USER_HOME
ExecStart=/usr/local/bin/monero-wallet-rpc \\
    --wallet-file $WALLET_FILE \\
    --password '$WALLET_PASSWORD' \\
    --rpc-bind-port 18083 \\
    --rpc-bind-ip 127.0.0.1 \\
    --disable-rpc-login \\
    --daemon-address node.moneroworld.com:18089 \\
    --trusted-daemon \\
    --log-file /var/log/monero-wallet-rpc.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 10. Установка зависимостей Node.js
echo "📦 Установка зависимостей Node.js..."
cd "$(dirname "$0")"
sudo -u $REAL_USER npm install

# 11. Обновление .env файла
echo "⚙️  Обновление конфигурации..."
sed -i "s|ONION_ADDRESS=.*|ONION_ADDRESS=$ONION_ADDRESS|g" .env
sed -i "s|XMR_ADDRESS=.*|XMR_ADDRESS=$XMR_ADDRESS|g" .env
chmod 600 .env
chown $REAL_USER:$REAL_USER .env

# 12. Создание systemd сервиса для приложения
echo "🔧 Создание XMR Paywall сервиса..."
cat > /etc/systemd/system/xmr-paywall.service << EOF
[Unit]
Description=XMR Tor Paywall Service
After=network.target tor.service monero-wallet-rpc.service
Requires=monero-wallet-rpc.service

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 13. Настройка firewall
echo "🔥 Настройка firewall (firewalld)..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --remove-port=8080/tcp 2>/dev/null || true
    firewall-cmd --permanent --remove-port=18083/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "✅ Firewall настроен (порты 8080 и 18083 закрыты)"
fi

# 14. SELinux
if command -v getenforce &> /dev/null && [ "$(getenforce)" != "Disabled" ]; then
    echo "🔐 Настройка SELinux..."
    semanage port -a -t http_port_t -p tcp 8080 2>/dev/null || semanage port -m -t http_port_t -p tcp 8080
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    echo "✅ SELinux настроен"
fi

# 15. Запуск сервисов
echo "🚀 Запуск сервисов..."
systemctl daemon-reload
systemctl enable monero-wallet-rpc
systemctl enable xmr-paywall
systemctl start monero-wallet-rpc
sleep 3
systemctl start xmr-paywall

# 16. Создание backup скрипта
echo "💾 Создание скрипта резервного копирования..."
cat > /usr/local/bin/xmr-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/xmr"
mkdir -p "$BACKUP_DIR"

# Backup приложения
tar -czf "$BACKUP_DIR/xmr-backup-$DATE.tar.gz" \
    -C $(dirname "$0")/../../var/www/xmr \
    .env payments.json 2>/dev/null || true

# Backup Tor ключей
tar -czf "$BACKUP_DIR/tor-backup-$DATE.tar.gz" \
    -C /var/lib/tor/blog_service \
    hostname hs_ed25519_secret_key hs_ed25519_public_key 2>/dev/null || true

# Удалить старые (>30 дней)
find "$BACKUP_DIR" -name "*-backup-*.tar.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/*-backup-$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/xmr-backup.sh

# 17. Проверка статуса
sleep 3
echo ""
echo "=================================="
echo "✅ УСТАНОВКА ЗАВЕРШЕНА!"
echo "=================================="
echo ""
echo "📊 Статус сервисов:"
systemctl status tor --no-pager | grep Active || true
systemctl status monero-wallet-rpc --no-pager | grep Active || true
systemctl status xmr-paywall --no-pager | grep Active || true
echo ""
echo "🧅 Ваш Onion адрес: $ONION_ADDRESS"
echo "💰 XMR адрес: $XMR_ADDRESS"
echo ""
echo "📝 Следующие шаги:"
echo "1. Проверьте конфигурацию: nano .env"
echo "2. При необходимости перезапустите: sudo systemctl restart xmr-paywall"
echo "3. Проверьте логи: sudo journalctl -u xmr-paywall -f"
echo ""
echo "💾 Резервное копирование:"
echo "- Seed фраза кошелька: ХРАНИТЕ В БЕЗОПАСНОМ МЕСТЕ!"
echo "- Tor ключи: sudo /usr/local/bin/xmr-backup.sh"
echo "- Автоматический backup: добавьте в crontab"
echo "  crontab -e -> 0 3 * * * /usr/local/bin/xmr-backup.sh"
echo ""
echo "🔍 Полезные команды:"
echo "- Логи: sudo journalctl -u xmr-paywall -f"
echo "- Статус: sudo systemctl status xmr-paywall"
echo "- Рестарт: sudo systemctl restart xmr-paywall"
echo "- Backup: sudo /usr/local/bin/xmr-backup.sh"
echo ""
echo "⚠️  ВАЖНО:"
echo "- Никогда не публикуйте файл .env"
echo "- Храните seed фразу в надежном месте (НЕ на сервере!)"
echo "- Регулярно делайте backup Tor ключей"
echo "- Регулярно выводите средства с платежного кошелька"
echo ""
echo "**Stay anonymous. Stay secure.** 🔒"
