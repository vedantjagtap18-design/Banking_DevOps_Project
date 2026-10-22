const express = require('express');
const path = require('path');
const {
  register,
  transactionCounter,
  transferDurationHistogram,
  balanceGauge,
  loginCounter,
  httpRequestCounter,
  activeUsersGauge
} = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3000;

// In-Memory Database for demonstration
const mockUser = {
  username: 'john_doe',
  password: 'Password@123',
  fullName: 'Johnathan Doe',
  accountNumber: 'ACC-88329104',
  balance: 5400.00,
  transactions: [
    { id: 'TXN-1001', type: 'Deposit', amount: 5000.00, recipient: 'Payroll Direct Deposit', date: '2026-10-20', status: 'Completed' },
    { id: 'TXN-1002', type: 'Transfer', amount: 250.00, recipient: 'Electric Utilities', date: '2026-10-21', status: 'Completed' },
    { id: 'TXN-1003', type: 'Deposit', amount: 650.00, recipient: 'Freelance Payout', date: '2026-10-22', status: 'Completed' }
  ]
};

// Initialize metrics
balanceGauge.set({ account_id: mockUser.accountNumber }, mockUser.balance);
activeUsersGauge.set(1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics collection middleware for all incoming HTTP requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    httpRequestCounter.inc({
      method: req.method,
      route: route || req.path,
      status_code: res.statusCode
    });
  });
  next();
});

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// Prometheus Metrics Endpoint (Scraped by Prometheus server)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Kubernetes Liveness & Readiness Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime()
  });
});

// 1. Authentication Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === mockUser.username && password === mockUser.password) {
    loginCounter.inc({ status: 'success' });
    activeUsersGauge.inc();
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        username: mockUser.username,
        fullName: mockUser.fullName,
        accountNumber: mockUser.accountNumber
      }
    });
  } else {
    loginCounter.inc({ status: 'failed' });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify your username and password.'
    });
  }
});

// 2. Account Information & Balance Endpoint
app.get('/api/account', (req, res) => {
  res.json({
    accountNumber: mockUser.accountNumber,
    fullName: mockUser.fullName,
    balance: mockUser.balance,
    transactions: mockUser.transactions
  });
});

// 3. Fund Transfer Endpoint with Business Validation
app.post('/api/transfer', (req, res) => {
  const endTimer = transferDurationHistogram.startTimer();
  const { recipient, amount, note } = req.body;
  const parsedAmount = parseFloat(amount);

  // Validation: Positive amount
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    transactionCounter.inc({ type: 'transfer', status: 'failed' });
    endTimer();
    return res.status(400).json({
      success: false,
      message: 'Transfer amount must be a positive number greater than $0.00'
    });
  }

  // Validation: Recipient specified
  if (!recipient || recipient.trim().length === 0) {
    transactionCounter.inc({ type: 'transfer', status: 'failed' });
    endTimer();
    return res.status(400).json({
      success: false,
      message: 'Recipient account or name is required'
    });
  }

  // Validation: Insufficient Funds (Overdraft protection)
  if (parsedAmount > mockUser.balance) {
    transactionCounter.inc({ type: 'transfer', status: 'failed' });
    endTimer();
    return res.status(422).json({
      success: false,
      message: `Insufficient funds. Your available balance is $${mockUser.balance.toFixed(2)}, cannot transfer $${parsedAmount.toFixed(2)}.`
    });
  }

  // Process Transfer
  mockUser.balance -= parsedAmount;
  const newTxn = {
    id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'Transfer',
    amount: parsedAmount,
    recipient: recipient.trim(),
    note: note || 'Online transfer',
    date: new Date().toISOString().split('T')[0],
    status: 'Completed'
  };

  mockUser.transactions.unshift(newTxn);

  // Update Prometheus Metrics
  balanceGauge.set({ account_id: mockUser.accountNumber }, mockUser.balance);
  transactionCounter.inc({ type: 'transfer', status: 'success' });
  endTimer();

  return res.status(200).json({
    success: true,
    message: `Successfully transferred $${parsedAmount.toFixed(2)} to ${recipient}`,
    newBalance: mockUser.balance,
    transaction: newTxn
  });
});

// 4. Incident Simulation Endpoint (For Grafana / Alerting Testing)
let failureModeActive = false;
app.post('/api/simulate-incident', (req, res) => {
  const { enable } = req.body;
  failureModeActive = Boolean(enable);
  return res.json({
    message: failureModeActive ? 'High 500 error mode enabled' : 'Normal mode restored',
    failureModeActive
  });
});

// Middleware to inject 500 errors if failure mode is active (for Grafana demo)
app.use((req, res, next) => {
  if (failureModeActive && req.path.startsWith('/api/') && !req.path.includes('simulate-incident')) {
    return res.status(500).json({
      error: 'Simulated Production Outage: Internal Database Gateway Timeout'
    });
  }
  next();
});

// Start Server only if executed directly
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`[Banking Service] Secure application running at http://localhost:${PORT}`);
    console.log(`[Prometheus] Metrics available at http://localhost:${PORT}/metrics`);
  });

  // Graceful Shutdown for Kubernetes
  process.on('SIGTERM', () => {
    console.log('[Banking Service] SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('[Banking Service] Process terminated.');
    });
  });
}

module.exports = app;
