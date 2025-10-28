# 🔐 Безопасность на CentOS/Rocky Linux

Дополнительные меры безопасности для production развертывания.

---

## 🔥 Firewall (firewalld)

### Базовая настройка
```bash
# Установка firewalld (если не установлен)
sudo dnf install -y firewalld

# Запуск и автозапуск
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Разрешить только SSH (если нужен удаленный доступ)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload

# Проверка правил
sudo firewall-cmd --list-all
```

### Запретить внешний доступ к RPC
```bash
# Убедиться что порты 18083 и 8080 НЕ открыты внешне
sudo firewall-cmd --permanent --remove-port=8080/tcp || true
sudo firewall-cmd --permanent --remove-port=18083/tcp || true
sudo firewall-cmd --reload
```

---

## 🛡️ SELinux

### Проверка статуса
```bash
# Узнать режим SELinux
getenforce
# Должно быть: Enforcing (для максимальной безопасности)
```

### Настройка правил для приложения
```bash
# Разрешить Node.js работать с нестандартными портами
sudo semanage port -a -t http_port_t -p tcp 8080

# Разрешить сетевые подключения
sudo setsebool -P httpd_can_network_connect 1

# Разрешить Tor работать с сокетами
sudo setsebool -P tor_can_network_relay 1
```

### Создание custom policy (если нужно)
```bash
# Проверить нарушения SELinux
sudo ausearch -m avc -ts recent

# Сгенерировать policy из логов
sudo ausearch -m avc -ts recent | audit2allow -M xmr-paywall

# Применить policy
sudo semodule -i xmr-paywall.pp
```

---

## 🔒 SSH Hardening

### Отключить root login
```bash
sudo nano /etc/ssh/sshd_config
```

Изменить:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Перезапустить SSH:
```bash
sudo systemctl restart sshd
```

### Fail2Ban
```bash
# Установка
sudo dnf install -y epel-release
sudo dnf install -y fail2ban

# Создать конфигурацию
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Добавить:
```ini
[sshd]
enabled = true
port = ssh
logpath = /var/log/secure
maxretry = 3
bantime = 3600
```

Запустить:
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🔐 Права доступа к файлам

```bash
# Переход в директорию проекта
cd /var/www/xmr  # или где установлен проект

# Ограничить доступ к .env (только владелец может читать)
chmod 600 .env
chown $USER:$USER .env

# Ограничить доступ к payments.json
chmod 600 payments.json
chown $USER:$USER payments.json

# Установить правильные права на директории
chmod 755 public
chmod 755 public/downloads
chmod 644 public/*.css
chmod 644 public/templates/*.html

# Убедиться что исполняемые файлы не имеют write для group/other
chmod 755 *.js
```

---

## 🔍 Мониторинг и аудит

### Auditd (расширенный аудит)
```bash
# Установка
sudo dnf install -y audit

# Запуск
sudo systemctl enable auditd
sudo systemctl start auditd

# Добавить правила мониторинга
sudo auditctl -w /var/www/xmr/.env -p wa -k xmr-env-changes
sudo auditctl -w /var/www/xmr/payments.json -p wa -k xmr-payments-changes

# Просмотр логов
sudo ausearch -k xmr-env-changes
sudo ausearch -k xmr-payments-changes
```

### Logrotate
```bash
# Создать конфигурацию для rotation логов
sudo nano /etc/logrotate.d/xmr-paywall
```

Содержимое:
```
/var/log/xmr-paywall/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        systemctl reload xmr-paywall
    endscript
}
```

---

## 🛡️ Network Security

### Ограничить исходящие подключения
```bash
# Создать nftables правила (альтернатива iptables)
sudo nano /etc/nftables/xmr-security.nft
```

Содержимое:
```nft
#!/usr/sbin/nft -f

table inet filter {
    chain output {
        type filter hook output priority 0; policy drop;

        # Разрешить loopback
        oifname "lo" accept

        # Разрешить established connections
        ct state established,related accept

        # Разрешить DNS
        udp dport 53 accept

        # Разрешить Tor
        tcp dport 9050 accept
        tcp dport 9051 accept

        # Разрешить Monero RPC (локально)
        ip daddr 127.0.0.1 tcp dport 18083 accept

        # Разрешить HTTP/HTTPS для обновлений
        tcp dport { 80, 443 } accept
    }
}
```

Применить:
```bash
sudo nft -f /etc/nftables/xmr-security.nft
```

---

## 🔐 Автоматическое резервное копирование

### Создать скрипт бэкапа
```bash
sudo nano /usr/local/bin/xmr-backup.sh
```

Содержимое:
```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/xmr"
SOURCE_DIR="/var/www/xmr"

# Создать директорию для бэкапов
mkdir -p "$BACKUP_DIR"

# Бэкап критичных файлов
tar -czf "$BACKUP_DIR/xmr-backup-$DATE.tar.gz" \
    -C "$SOURCE_DIR" \
    .env payments.json \
    --exclude='node_modules' \
    --exclude='.git'

# Удалить старые бэкапы (старше 30 дней)
find "$BACKUP_DIR" -name "xmr-backup-*.tar.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/xmr-backup-$DATE.tar.gz"
```

Сделать исполняемым:
```bash
sudo chmod +x /usr/local/bin/xmr-backup.sh
```

### Добавить в cron (ежедневно в 3:00)
```bash
sudo crontab -e
```

Добавить:
```
0 3 * * * /usr/local/bin/xmr-backup.sh >> /var/log/xmr-backup.log 2>&1
```

---

## 🔒 Дополнительные меры

### 1. Обновления безопасности
```bash
# Настроить автоматические обновления безопасности
sudo dnf install -y dnf-automatic

sudo nano /etc/dnf/automatic.conf
```

Изменить:
```ini
[commands]
upgrade_type = security
apply_updates = yes
```

Запустить:
```bash
sudo systemctl enable dnf-automatic.timer
sudo systemctl start dnf-automatic.timer
```

### 2. Ограничение ресурсов systemd
```bash
sudo nano /etc/systemd/system/xmr-paywall.service
```

Добавить в секцию [Service]:
```ini
# Ограничения ресурсов
MemoryLimit=512M
CPUQuota=50%
TasksMax=50

# Защита файловой системы
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/xmr

# Network namespace
PrivateNetwork=false
RestrictAddressFamilies=AF_INET AF_INET6
```

Перезагрузить:
```bash
sudo systemctl daemon-reload
sudo systemctl restart xmr-paywall
```

### 3. Отключить ненужные сервисы
```bash
# Список всех сервисов
systemctl list-unit-files --type=service --state=enabled

# Отключить ненужные (примеры)
sudo systemctl disable cups
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon
```

---

## 📊 Проверка безопасности

### Скан портов
```bash
# Внутренний скан
sudo nmap -sT -O localhost

# Должны быть открыты только: 22 (SSH если нужен), и локальные порты
```

### Проверка прав доступа
```bash
# Поиск файлов с небезопасными правами
find /var/www/xmr -type f -perm /go+w
```

### Логи безопасности
```bash
# Просмотр логов безопасности
sudo tail -f /var/log/secure
sudo tail -f /var/log/audit/audit.log
```

---

## ✅ Чеклист безопасности

- [ ] Firewall настроен и активен
- [ ] SELinux в режиме Enforcing
- [ ] SSH доступ только по ключу
- [ ] Fail2Ban установлен и настроен
- [ ] .env и payments.json имеют права 600
- [ ] Автоматические обновления включены
- [ ] Резервное копирование настроено
- [ ] Auditd мониторит критичные файлы
- [ ] Tor Hidden Service работает
- [ ] Monero RPC доступен только локально
- [ ] Открыты только необходимые порты
- [ ] Ненужные сервисы отключены

---

**⚠️ ВАЖНО**: Это базовые меры безопасности. Для production окружения рекомендуется провести профессиональный security audit!
