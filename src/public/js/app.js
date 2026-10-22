// State
let currentUser = null;
let failureActive = false;

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginAlert = document.getElementById('login-alert');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

const welcomeMessage = document.getElementById('welcome-message');
const userAccountNumber = document.getElementById('user-account-number');
const accountBalance = document.getElementById('account-balance');
const logoutBtn = document.getElementById('logout-btn');

const transferForm = document.getElementById('transfer-form');
const transferRecipient = document.getElementById('transfer-recipient');
const transferAmount = document.getElementById('transfer-amount');
const transferNote = document.getElementById('transfer-note');
const transferAlert = document.getElementById('transfer-alert');
const transactionsTableBody = document.getElementById('transactions-table-body');
const refreshBtn = document.getElementById('refresh-btn');
const simulateOutageBtn = document.getElementById('simulate-outage-btn');

// Format Currency
function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Show Alert
function showAlert(element, message, type = 'danger') {
  element.className = `alert alert-${type}`;
  element.textContent = message;
  element.classList.remove('d-none');
}

function hideAlert(element) {
  element.classList.add('d-none');
  element.textContent = '';
}

// 1. Login Handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(loginAlert);

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(loginAlert, data.message || 'Authentication failed.', 'danger');
      return;
    }

    currentUser = data.user;
    loginSection.classList.add('d-none');
    dashboardSection.classList.remove('d-none');
    welcomeMessage.textContent = `Welcome back, ${currentUser.fullName}`;
    userAccountNumber.textContent = currentUser.accountNumber;

    await loadAccountData();
  } catch (err) {
    showAlert(loginAlert, 'Network connection error. Server unreachable.', 'danger');
  }
});

// 2. Fetch Account & Transactions
async function loadAccountData() {
  try {
    const res = await fetch('/api/account');
    if (!res.ok) throw new Error('Failed to fetch account');
    const data = await res.json();

    accountBalance.textContent = formatUSD(data.balance);
    renderTransactions(data.transactions);
  } catch (err) {
    console.error('Error fetching account data:', err);
  }
}

// 3. Render Transaction List
function renderTransactions(transactions) {
  transactionsTableBody.innerHTML = '';
  if (!transactions || transactions.length === 0) {
    transactionsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #9CA3AF;">No transactions found</td></tr>`;
    return;
  }

  transactions.forEach((tx) => {
    const tr = document.createElement('tr');
    const isDeposit = tx.type === 'Deposit';
    const amountClass = isDeposit ? 'badge-deposit' : 'badge-transfer';
    const amountPrefix = isDeposit ? '+' : '-';

    tr.innerHTML = `
      <td><code>${tx.id}</code></td>
      <td><strong>${tx.recipient}</strong></td>
      <td>${tx.date}</td>
      <td class="${amountClass}">${amountPrefix}${formatUSD(tx.amount)}</td>
      <td><span class="status-online">${tx.status}</span></td>
    `;
    transactionsTableBody.appendChild(tr);
  });
}

// 4. Fund Transfer Handler
transferForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(transferAlert);

  const recipient = transferRecipient.value.trim();
  const amount = parseFloat(transferAmount.value);
  const note = transferNote.value.trim();

  try {
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amount, note })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(transferAlert, data.message || 'Transfer failed.', 'danger');
      return;
    }

    showAlert(transferAlert, data.message, 'success');
    transferForm.reset();
    await loadAccountData();
  } catch (err) {
    showAlert(transferAlert, 'Failed to complete transaction. Server error.', 'danger');
  }
});

// Refresh button
refreshBtn.addEventListener('click', loadAccountData);

// Logout Handler
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  dashboardSection.classList.add('d-none');
  loginSection.classList.remove('d-none');
  loginForm.reset();
  hideAlert(loginAlert);
});

// Fault Injection Toggle (For Demoing Prometheus & Grafana alerts)
simulateOutageBtn.addEventListener('click', async () => {
  failureActive = !failureActive;
  try {
    const res = await fetch('/api/simulate-incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable: failureActive })
    });
    const data = await res.json();
    alert(`[Simulated Incident Mode] ${data.message}`);
    simulateOutageBtn.textContent = failureActive ? 'Disable Failure Injection' : 'Toggle Failure Injection (Demo)';
    simulateOutageBtn.className = failureActive ? 'btn btn-sm btn-outline mt-2' : 'btn btn-sm btn-danger mt-2';
  } catch (err) {
    console.error(err);
  }
});
