const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const http = require('http');

const PORT = process.env.TEST_PORT || 3001;
const APP_URL = `http://localhost:${PORT}`;
const SIMULATE_FAILURE = process.env.FAIL_TEST === 'true';

let serverInstance = null;
let driver = null;

// Helper to wait and get element text
async function getElementText(locator, timeout = 5000) {
  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return await el.getText();
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('   SELENIUM AUTOMATED FUNCTIONAL TEST SUITE - BANKING APP    ');
  console.log('=============================================================');
  console.log(`Target URL: ${APP_URL}`);
  console.log(`Failure Injection Mode: ${SIMULATE_FAILURE ? 'ACTIVE (Will deliberately fail)' : 'OFF (Clean Run)'}`);
  console.log('-------------------------------------------------------------\n');

  // Step 1: Start Express server for testing
  const app = require('../src/server');
  await new Promise((resolve) => {
    serverInstance = app.listen(PORT, () => {
      console.log(`[Test Harness] Temporary test server started on port ${PORT}`);
      resolve();
    });
  });

  // Step 2: Configure Headless Chrome
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');

  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  } catch (err) {
    console.error('[Error] Could not initialize Chrome WebDriver:', err.message);
    console.log('\n[Tip] Make sure Google Chrome or Chromium is installed on your system.');
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }

  let passedCount = 0;
  let failedCount = 0;

  try {
    // -------------------------------------------------------------
    // TEST 1: Negative Authentication (Invalid Credentials)
    // -------------------------------------------------------------
    process.stdout.write('TEST 1: Negative Login (Invalid Password Handling) ... ');
    await driver.get(APP_URL);

    await driver.findElement(By.id('username')).sendKeys('john_doe');
    await driver.findElement(By.id('password')).sendKeys('WrongPassword!');
    await driver.findElement(By.id('login-btn')).click();

    const alertText = await getElementText(By.id('login-alert'));
    assert(alertText.includes('Invalid credentials'), 'Expected error alert for wrong password');
    console.log('PASSED [✓]');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 2: Positive Authentication (Valid Credentials)
    // -------------------------------------------------------------
    process.stdout.write('TEST 2: Positive Login & Dashboard Navigation ... ');
    const userField = await driver.findElement(By.id('username'));
    await userField.clear();
    await userField.sendKeys('john_doe');

    const passField = await driver.findElement(By.id('password'));
    await passField.clear();
    await passField.sendKeys('Password@123');

    await driver.findElement(By.id('login-btn')).click();

    // Verify Dashboard displays
    const welcome = await getElementText(By.id('welcome-message'));
    assert(welcome.includes('Johnathan'), 'Expected welcome greeting for Johnathan');

    const balanceText = await getElementText(By.id('account-balance'));
    assert(balanceText.includes('$5,400.00'), `Expected initial balance $5,400.00, got ${balanceText}`);
    console.log('PASSED [✓]');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 3: Fund Transfer Operation & Balance Deduction
    // -------------------------------------------------------------
    process.stdout.write('TEST 3: Fund Transfer Execution ($150.00 to Alice) ... ');
    
    // Set transfer form fields reliably
    await driver.executeScript(() => {
      const recip = document.getElementById('transfer-recipient');
      const amount = document.getElementById('transfer-amount');
      const note = document.getElementById('transfer-note');
      
      recip.value = 'Alice Smith (ACC-449102)';
      recip.dispatchEvent(new Event('input', { bubbles: true }));
      recip.dispatchEvent(new Event('change', { bubbles: true }));

      amount.value = '150.00';
      amount.dispatchEvent(new Event('input', { bubbles: true }));
      amount.dispatchEvent(new Event('change', { bubbles: true }));

      note.value = 'Project Milestone Payout';
      note.dispatchEvent(new Event('input', { bubbles: true }));

      // Submit form
      const form = document.getElementById('transfer-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });

    const transferSuccessAlert = await getElementText(By.id('transfer-alert'), 8000);
    assert(transferSuccessAlert.includes('Successfully transferred'), 'Expected transfer success confirmation');

    // Wait and check updated balance
    await driver.sleep(600); // Allow DOM refresh
    const updatedBalanceText = await getElementText(By.id('account-balance'));
    assert(updatedBalanceText.includes('$5,250.00'), `Balance should be $5,250.00, found: ${updatedBalanceText}`);
    console.log('PASSED [✓]');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 4: Overdraft & Insufficient Funds Business Logic
    // -------------------------------------------------------------
    process.stdout.write('TEST 4: Overdraft Prevention (Transfer $99,999.00) ... ');
    
    await driver.executeScript(() => {
      const recip = document.getElementById('transfer-recipient');
      const amount = document.getElementById('transfer-amount');
      
      recip.value = 'Suspicious Account';
      recip.dispatchEvent(new Event('input', { bubbles: true }));
      recip.dispatchEvent(new Event('change', { bubbles: true }));

      amount.value = '99999.00';
      amount.dispatchEvent(new Event('input', { bubbles: true }));
      amount.dispatchEvent(new Event('change', { bubbles: true }));

      // Submit form
      const form = document.getElementById('transfer-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });

    const transferFailAlert = await getElementText(By.id('transfer-alert'), 8000);
    assert(transferFailAlert.includes('Insufficient funds'), 'Expected overdraft rejection message');

    const protectedBalance = await getElementText(By.id('account-balance'));
    assert(protectedBalance.includes('$5,250.00'), 'Balance should remain unchanged after rejected transfer');
    console.log('PASSED [✓]');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 5: Simulated Regression / Failure Demonstration
    // (Used to show Jenkins Quality Gate stopping the deployment)
    // -------------------------------------------------------------
    if (SIMULATE_FAILURE) {
      process.stdout.write('TEST 5: Regression Quality Gate Check ... ');
      failedCount++;
      throw new Error('[DELIBERATE FAILURE INJECTED] Selenium Test Failed: Banking transaction balance integrity constraint violated!');
    }

  } catch (err) {
    console.log('FAILED [✗]');
    console.error('\n--> Test Failure Details:', err.message);
    failedCount++;

    // Print browser console logs
    try {
      const logs = await driver.manage().logs().get('browser');
      console.log('\n--- BROWSER CONSOLE LOGS ---');
      logs.forEach(l => console.log(`[${l.level.name}] ${l.message}`));
      console.log('----------------------------\n');
    } catch (logErr) {
      // ignore
    }
  } finally {
    if (driver) {
      await driver.quit();
    }
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('-------------------------------------------------------------\n');

  if (failedCount > 0) {
    console.error('[CI GATE ALERT] Selenium tests failed. Exiting with status code 1 to abort CI/CD pipeline.');
    process.exit(1);
  } else {
    console.log('[CI GATE PASS] All Selenium functional tests succeeded! Ready for Docker packaging.');
    process.exit(0);
  }
}

runTestSuite();
