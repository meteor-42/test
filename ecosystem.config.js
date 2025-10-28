module.exports = {
  apps: [
    {
      name: 'monero-wallet-rpc',
      script: '/usr/local/bin/monero-wallet-rpc',
      args: '--wallet-file ~/.monero-wallet/payment-wallet --password "YOUR_WALLET_PASSWORD" --rpc-bind-port 18083 --rpc-bind-ip 127.0.0.1 --disable-rpc-login --daemon-address node.moneroworld.com:18089 --trusted-daemon --log-file /var/log/monero-wallet-rpc.log',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 10000,
      error_file: '/var/log/pm2-monero-wallet-rpc-error.log',
      out_file: '/var/log/pm2-monero-wallet-rpc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'xmr-paywall',
      script: 'server.js',
      interpreter: 'node',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 10000,
      error_file: '/var/log/pm2-xmr-paywall-error.log',
      out_file: '/var/log/pm2-xmr-paywall-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production'
      },
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
