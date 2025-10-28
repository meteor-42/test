#!/bin/bash

# 🚀 XMR Tor Paywall - Скрипт автоматической установки для CentOS/Rocky Linux
# Использование: sudo bash install-centos.sh

set -e

echo "🔧 Начинаем установку XMR Tor Paywall на CentOS/Rocky Linux..."

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install-centos.sh"
    exit 1
fi

# Определение пользователя
REAL_USER=${SUDO_USER:-$(whoami)}
echo "👤 Установка для пользователя: $REAL_USER"

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
echo "✅ Tor $(tor --version | head -1) установлен"

# 4. Установка зависимостей для Monero
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

# 6. Настройка Tor Hidden Service
echo "🧅 Настройка Tor Hidden Service..."
TOR_CONFIG="/etc/tor/torrc"
if ! grep -q "HiddenServiceDir /var/lib/tor/web/" "$TOR_CONFIG"; then
    cat >> "$TOR_CONFIG" << 'EOF'

# XMR Paywall Hidden Service
HiddenServiceDir /var/lib/tor/web/
HiddenServicePort 80 127.0.0.1:8080
EOF
    echo "✅ Tor Hidden Service настроен"
fi

# Создание директории для Tor
mkdir -p /var/lib/tor/web/
chown -R toranon:toranon /var/lib/tor/web/ 2>/dev/null || chown -R tor:tor /var/lib/tor/web/
chmod 700 /var/lib/tor/web/

# Запуск Tor
systemctl enable tor
systemctl restart tor
sleep 3

# Получение onion адреса
if [ -f /var/lib/tor/web/hostname ]; then
    ONION_ADDRESS=$(cat /var/lib/tor/web/hostname)
    echo "✅ Onion адрес: $ONION_ADDRESS"
else
    echo "⚠️  Onion адрес еще не сгенерирован. Подождите 30 секунд и проверьте: cat /var/lib/tor/web/hostname"
    ONION_ADDRESS="ваш-адрес.onion"
fi

# 7. Установка зависимостей Node.js
echo "📦 Установка зависимостей Node.js..."
cd "$(dirname "$0")"
npm install

# 8. Обновление .env файла
echo "⚙️  Обновление конфигурации..."
sed -i "s|ONION_ADDRESS=.*|ONION_ADDRESS=$ONION_ADDRESS|g" .env

# 9. Создание systemd сервиса для приложения
echo "🔧 Создание systemd сервиса..."
cat > /etc/systemd/system/xmr-paywall.service << EOF
[Unit]
Description=XMR Tor Paywall Service
After=network.target tor.service

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

# 10. Настройка firewall
echo "🔥 Настройка firewall..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

# 11. SELinux (если включен)
if command -v getenforce &> /dev/null && [ "$(getenforce)" != "Disabled" ]; then
    echo "🔐 Настройка SELinux..."
    semanage port -a -t http_port_t -p tcp 8080 2>/dev/null || true
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
fi

# 12. Запуск сервиса
echo "🚀 Запуск сервиса..."
systemctl daemon-reload
systemctl enable xmr-paywall
systemctl start xmr-paywall

# 13. Проверка статуса
sleep 2
echo ""
echo "=================================="
echo "✅ Установка завершена!"
echo "=================================="
echo ""
echo "📊 Статус сервисов:"
systemctl status tor --no-pager | grep Active
systemctl status xmr-paywall --no-pager | grep Active
echo ""
echo "🧅 Ваш Onion адрес: $ONION_ADDRESS"
echo ""
echo "📝 Следующие шаги:"
echo "1. Настройте Monero кошелек (см. TOR_SETUP.md)"
echo "2. Отредактируйте .env файл: nano .env"
echo "3. Перезапустите сервис: sudo systemctl restart xmr-paywall"
echo ""
echo "📖 Документация:"
echo "- README.md - Общая информация"
echo "- TOR_SETUP.md - Полная инструкция по настройке"
echo "- CMD.md - Полезные команды"
echo ""
echo "🔍 Полезные команды:"
echo "- Логи: sudo journalctl -u xmr-paywall -f"
echo "- Статус: sudo systemctl status xmr-paywall"
echo "- Рестарт: sudo systemctl restart xmr-paywall"
echo ""
