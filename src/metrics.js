const client = require('prom-client');

// Initialize Prometheus Register
const register = new client.Registry();

// Add default process & node metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'banking_app_'
});

// Custom Metrics for Banking Application

// 1. Total Transactions Counter
const transactionCounter = new client.Counter({
  name: 'banking_transactions_total',
  help: 'Total number of banking transactions processed',
  labelNames: ['type', 'status'], // type: deposit, transfer; status: success, failed
  registers: [register]
});

// 2. Fund Transfer Duration Histogram
const transferDurationHistogram = new client.Histogram({
  name: 'banking_transfer_duration_seconds',
  help: 'Latency of fund transfer operations in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

// 3. Current Account Balance Gauge
const balanceGauge = new client.Gauge({
  name: 'banking_account_balance_dollars',
  help: 'Current account balance in USD for monitoring solvency and state',
  labelNames: ['account_id'],
  registers: [register]
});

// 4. Login Attempts Counter
const loginCounter = new client.Counter({
  name: 'banking_login_attempts_total',
  help: 'Total login attempts into the banking portal',
  labelNames: ['status'], // success, failed
  registers: [register]
});

// 5. HTTP Requests Counter for Reliability & Error Rate Tracking
const httpRequestCounter = new client.Counter({
  name: 'banking_http_requests_total',
  help: 'Total HTTP requests processed by endpoint and status code',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// 6. Active Users Gauge
const activeUsersGauge = new client.Gauge({
  name: 'banking_active_sessions',
  help: 'Number of currently active authenticated sessions',
  registers: [register]
});

module.exports = {
  register,
  transactionCounter,
  transferDurationHistogram,
  balanceGauge,
  loginCounter,
  httpRequestCounter,
  activeUsersGauge
};
