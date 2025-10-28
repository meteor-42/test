# ⚡ Быстрые команды

Шпаргалка для работы с XMR Tor Paywall.

---

## 🚀 Управление сервисами

```bash
# Запуск всех сервисов
sudo systemctl start tor
sudo systemctl start monero-wallet-rpc
sudo systemctl start xmr-paywall

# Остановка всех сервисов
sudo systemctl stop xmr-paywall
sudo systemctl stop monero-wallet-rpc
sudo systemctl stop tor

# Перезапуск
sudo systemctl restart xmr-paywall
sudo systemctl restart monero-wallet-rpc
sudo systemctl restart tor

# Проверка статуса
sudo systemctl status xmr-paywall
sudo systemctl status monero-wallet-rpc
sudo systemctl status tor

# Автозапуск при загрузке системы
sudo systemctl enable xmr-paywall
sudo systemctl enable monero-wallet-rpc
sudo systemctl enable tor
```

---

## 📊 Мониторинг и логи

```bash
# Логи в реальном времени
sudo journalctl -u xmr-paywall -f
sudo journalctl -u monero-wallet-rpc -f
sudo journalctl -u tor -f

# Последние 50 строк логов
sudo journalctl -u xmr-paywall -n 50
sudo journalctl -u monero-wallet-rpc -n 50
sudo journalctl -u tor -n 50

# Логи за последний час
sudo journalctl -u xmr-paywall --since "1 hour ago"

# Логи с определенной даты
sudo journalctl -u xmr-paywall --since "2024-01-01"

# Поиск ошибок
sudo journalctl -u xmr-paywall | grep -i error
sudo journalctl -u xmr-paywall | grep -i warning
```

---

## 🧅 Tor операции

```bash
# Получить onion адрес
sudo cat /var/lib/tor/web/hostname

# Проверить конфигурацию Tor
sudo cat /etc/tor/torrc | grep Hidden

# Права на директорию Tor
sudo chown -R debian-tor:debian-tor /var/lib/tor/web/
sudo chmod 700 /var/lib/tor/web/

# Тест через Tor
torsocks curl http://ваш-адрес.onion
```

---

## 💰 Monero RPC

```bash
# Проверка подключения
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_balance","params":{"account_index":0}}'

# Получить адрес кошелька
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_address","params":{"account_index":0}}'

# Список subaddresses
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_address","params":{"account_index":0,"address_index":[0,1,2,3,4,5]}}'

# Проверка входящих транзакций
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_transfers","params":{"in":true,"account_index":0}}'

# Высота блокчейна
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_height"}'
```

---

## 📁 Работа с файлами

```bash
# Просмотр .env (безопасно, без вывода в историю)
cat .env

# Редактировать .env
nano .env

# Проверить права
ls -la .env
# Должно быть: -rw------- (600)

# Установить правильные права
chmod 600 .env

# Просмотр payments.json
cat payments.json | jq

# Только подтвержденные платежи
cat payments.json | jq 'to_entries | map(select(.value.status == "confirmed"))'

# Только pending платежи
cat payments.json | jq 'to_entries | map(select(.value.status == "pending"))'

# Количество платежей
cat payments.json | jq 'length'

# Поиск по memo
cat payments.json | jq '.["TEST123"]'

# Резервная копия payments.json
cp payments.json payments.json.backup-$(date +%Y%m%d-%H%M%S)
```

---

## 🔍 Диагностика

```bash
# Проверка портов
sudo netstat -tulpn | grep 8080
sudo netstat -tulpn | grep 18083
sudo ss -tulpn | grep 8080

# Проверка процессов
ps aux | grep node
ps aux | grep monero
ps aux | grep tor

# Использование ресурсов
top -p $(pgrep -f "node server.js")
htop -p $(pgrep -f "monero-wallet-rpc")

# Проверка памяти
free -h

# Проверка диска
df -h

# Локальный тест сервера
curl http://127.0.0.1:8080
curl -I http://127.0.0.1:8080

# Тест RPC
curl http://127.0.0.1:18083/json_rpc

# DNS тест (должен НЕ работать - anon)
dig ваш-домен.com
```

---

## 🔐 Безопасность

```bash
# Проверка firewall
sudo ufw status verbose

# Разрешить только локальные подключения
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable

# Проверка открытых портов
sudo lsof -i -P -n | grep LISTEN

# Последние логины
last -a | head
lastb | head

# Проверка fail2ban (если установлен)
sudo fail2ban-client status
sudo fail2ban-client status sshd

# Поиск подозрительных подключений
sudo tail -f /var/log/auth.log | grep Failed
```

---

## 💾 Резервное копирование

```bash
# Создать бэкап
mkdir -p ~/backups/xmr-$(date +%Y%m%d)
cp /var/www/xmr/.env ~/backups/xmr-$(date +%Y%m%d)/
cp /var/www/xmr/payments.json ~/backups/xmr-$(date +%Y%m%d)/
cp -r /var/www/xmr/public/downloads ~/backups/xmr-$(date +%Y%m%d)/

# Автоматический бэкап (добавить в crontab)
# crontab -e
# 0 0 * * * /usr/bin/backup-xmr.sh

# Скрипт backup-xmr.sh
cat > /usr/local/bin/backup-xmr.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=~/backups/xmr-$DATE
mkdir -p $BACKUP_DIR
cp /var/www/xmr/payments.json $BACKUP_DIR/
echo "Backup created: $BACKUP_DIR"
EOF
chmod +x /usr/local/bin/backup-xmr.sh

# Восстановление из бэкапа
cp ~/backups/xmr-20240101/payments.json /var/www/xmr/
sudo systemctl restart xmr-paywall
```

---

## 🧪 Тестирование

```bash
# Создать тестовый платеж
cat > /tmp/test-payment.json << 'EOF'
{
  "TEST123": {
    "memo": "TEST123",
    "subaddress": "test-address",
    "subaddressIndex": 999,
    "status": "confirmed",
    "access_token": "testtoken123",
    "created_at": 1234567890000,
    "confirmed_at": 1234567890000
  }
}
EOF
cp /var/www/xmr/payments.json /var/www/xmr/payments.json.backup
cat /tmp/test-payment.json > /var/www/xmr/payments.json
sudo systemctl restart xmr-paywall

# Удалить тестовый платеж
mv /var/www/xmr/payments.json.backup /var/www/xmr/payments.json
sudo systemctl restart xmr-paywall

# Тест формы доступа
curl -X POST http://127.0.0.1:8080/check-access \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'memo_code=ACCESS-TEST123'
```

---

## 📦 Обновление

```bash
# Обновление Node.js пакетов
cd /var/www/xmr
npm update
npm audit fix

# Обновление системы
sudo dnf update
sudo dnf upgrade -y
sudo dnf autoremove -y

# Обновление Monero
# Скачать новую версию с getmonero.org
wget https://downloads.getmonero.org/cli/linux64
tar -xvf linux64
sudo systemctl stop monero-wallet-rpc
sudo mv monero-*/monero-wallet-rpc /usr/local/bin/
sudo systemctl start monero-wallet-rpc

# Проверка версий
node --version
monero-wallet-rpc --version
tor --version
```

---

## 🗑️ Очистка

```bash
# Очистка логов (старше 7 дней)
sudo journalctl --vacuum-time=7d

# Очистка старых платежей вручную
# Откройте payments.json и удалите старые pending записи

# Очистка временных файлов
sudo dnf clean
sudo dnf autoclean
rm -rf /tmp/*
```

---

## 🆘 Экстренное восстановление

```bash
# Полный перезапуск всех сервисов
sudo systemctl restart tor monero-wallet-rpc xmr-paywall

# Сброс к начальному состоянию (ОСТОРОЖНО!)
sudo systemctl stop xmr-paywall
mv /var/www/xmr/payments.json /var/www/xmr/payments.json.old
echo '{}' > /var/www/xmr/payments.json
sudo systemctl start xmr-paywall

# Восстановление из Git
cd /var/www/xmr
git stash
git pull
npm install
sudo systemctl restart xmr-paywall

# Проверка целостности установки
cd /var/www/xmr
npm install
node -c server.js  # Проверка синтаксиса
node -c auth.js
node -c xmr-monitor.js
```

---

## 📱 Однострочники

```bash
# Все статусы сразу
for svc in tor monero-wallet-rpc xmr-paywall; do echo "=== $svc ==="; sudo systemctl status $svc | grep Active; done

# Все логи с ошибками
for svc in tor monero-wallet-rpc xmr-paywall; do echo "=== $svc ==="; sudo journalctl -u $svc | grep -i error | tail -5; done

# Проверка всех подключений
echo "Tor: $(sudo systemctl is-active tor) | Monero: $(sudo systemctl is-active monero-wallet-rpc) | App: $(sudo systemctl is-active xmr-paywall)"

# Полная диагностика
echo "=== SERVICES ===" && \
sudo systemctl status tor monero-wallet-rpc xmr-paywall --no-pager | grep Active && \
echo "=== PORTS ===" && \
sudo netstat -tulpn | grep -E "8080|18083" && \
echo "=== PAYMENTS ===" && \
cat /var/www/xmr/payments.json | jq 'length' && \
echo "=== ONION ===" && \
sudo cat /var/lib/tor/web/hostname
```

---

## 💡 Полезные алиасы

Добавьте в `~/.bashrc`:

```bash
# XMR Paywall алиасы
alias xmr-status='sudo systemctl status tor monero-wallet-rpc xmr-paywall'
alias xmr-restart='sudo systemctl restart tor monero-wallet-rpc xmr-paywall'
alias xmr-logs='sudo journalctl -u xmr-paywall -f'
alias xmr-payments='cat /var/www/xmr/payments.json | jq'
alias xmr-onion='sudo cat /var/lib/tor/web/hostname'
alias xmr-backup='bash /usr/local/bin/backup-xmr.sh'

# Применить изменения
source ~/.bashrc
```

Теперь можно использовать:
```bash
xmr-status
xmr-restart
xmr-logs
xmr-payments
xmr-onion
xmr-backup
```

---

**Сохраните этот файл для быстрого доступа к командам!** ⚡
