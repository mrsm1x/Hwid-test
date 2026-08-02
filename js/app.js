window.balance = 1250.00;
// Remove the previous game markup after the replacement views have been mounted.
document.getElementById('legacyCrashGame')?.remove();
document.getElementById('legacyMinesGame')?.remove();
let activeInvestment = null;
let investmentInterval = null;
let timerInterval = null;
let payoutEndTime = Date.now() + (5 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000) + (34 * 60 * 1000) + (56 * 1000);

function formatMoney(amount) { return '$' + amount.toFixed(2); }
function updateBalance() { 
  document.getElementById('mainBalance').textContent = formatMoney(window.balance); 
}
function stepNumberInput(inputId, amount) {
  const input = document.getElementById(inputId);
  if (!input || input.disabled) return;
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  const current = Number.parseFloat(input.value) || 0;
  const next = Math.max(Number.isFinite(min) ? min : 0, Math.min(Number.isFinite(max) ? max : Infinity, current + amount));
  const decimals = ((input.step || '').split('.')[1] || '').length;
  input.value = decimals ? next.toFixed(decimals) : String(Math.round(next * 100) / 100);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
}

// Investment
function makeInvestment() {
  const amount = parseFloat(document.getElementById('investAmount').value);
  if (!amount || amount < 10) { showToast('Minimum investment is $10'); return; }
  if (amount > window.balance) { showToast('Insufficient balance'); return; }
  if (activeInvestment) { showToast('You already have an active investment'); return; }
  window.balance -= amount;
  updateBalance();
  activeInvestment = { amount: amount, startTime: Date.now(), endTime: Date.now() + 86400000 };
  document.getElementById('investInputSection').style.display = 'none';
  document.getElementById('activeInvestment').style.display = 'block';
  document.getElementById('investNowBtn').disabled = true;
  showToast('Investment of ' + formatMoney(amount) + ' locked for 24h');
  startInvestmentTimer();
}

function startInvestmentTimer() {
  if (investmentInterval) clearInterval(investmentInterval);
  if (timerInterval) clearInterval(timerInterval);
  investmentInterval = setInterval(() => {
    if (!activeInvestment) return;
    const elapsed = Date.now() - activeInvestment.startTime;
    const total = activeInvestment.endTime - activeInvestment.startTime;
    const progress = Math.min((elapsed / total) * 100, 100);
    const profit = activeInvestment.amount * 0.012 * (elapsed / total);
    document.getElementById('investProgress').style.width = progress + '%';
    document.getElementById('activeAmount').textContent = formatMoney(activeInvestment.amount + profit);
    document.getElementById('activeProfit').textContent = '+ ' + formatMoney(profit) + ' profit';
    if (elapsed >= total) {
      window.balance += activeInvestment.amount * 1.012;
      updateBalance();
      showToast('Investment matured! +' + formatMoney(activeInvestment.amount * 0.012) + ' profit added');
      activeInvestment = null;
      document.getElementById('investInputSection').style.display = 'block';
      document.getElementById('activeInvestment').style.display = 'none';
      document.getElementById('investNowBtn').disabled = false;
      document.getElementById('investAmount').value = '';
      clearInterval(investmentInterval);
      clearInterval(timerInterval);
    }
  }, 1000);
  timerInterval = setInterval(() => {
    if (!activeInvestment) return;
    const remaining = activeInvestment.endTime - Date.now();
    if (remaining <= 0) return;
    const h = Math.floor(remaining / 3600000).toString().padStart(2, '0');
    const m = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    document.getElementById('investTimer').textContent = h + ':' + m + ':' + s;
  }, 1000);
}

// Modals
function openModal(type) {
  const titles = { rules: 'Rules & Guidelines', license: 'License & Security', support: 'Support Center' };
  const bodies = {
    rules: 'Welcome to STAKE. All investments are locked for 24 hours with a guaranteed 1.2% return. Games use your main balance. Minimum bet is $1. All transactions are final.',
    license: 'STAKE operates under a secure gaming license. All games use provably fair algorithms. Your funds are protected with industry-standard encryption.',
    support: 'Need help? Contact our 24/7 support team at support@stake.app or via live chat. Average response time: under 5 minutes.'
  };
  document.getElementById('modalTitle').textContent = titles[type];
  document.getElementById('modalBody').textContent = bodies[type];
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(e) { if (!e || e.target === document.getElementById('modalOverlay')) document.getElementById('modalOverlay').classList.remove('active'); }
function openProfileModal() { document.getElementById('profileModal').classList.add('active'); }
function closeProfileModal(e) { if (!e || e.target === document.getElementById('profileModal')) document.getElementById('profileModal').classList.remove('active'); }
function saveProfile() {
  const newName = document.getElementById('profileUsername').value;
  document.getElementById('headerUsername').textContent = newName;
  document.getElementById('headerAvatar').textContent = newName.substring(0, 2).toUpperCase();
  showToast('Profile saved!');
  closeProfileModal();
}

// Rewards
function spinWheel() {
  const wheel = document.getElementById('fortuneWheel');
  const rotations = 5 + Math.random() * 5;
  const degrees = rotations * 360 + Math.random() * 360;
  wheel.style.transform = 'rotate(' + degrees + 'deg)';
  document.getElementById('spinBtn').disabled = true;
  setTimeout(() => {
    showToast('You won $0.50!');
    window.balance += 0.50;
    updateBalance();
  }, 4000);
}

function completeTask(btn, task) {
  btn.textContent = 'PENDING';
  btn.classList.add('pending');
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'CLAIMED';
    btn.classList.remove('pending');
    btn.classList.add('completed');
    const rewards = { telegram: 5, twitter: 3, referral: 10 };
    window.balance += rewards[task];
    updateBalance();
    showToast('Task completed! +' + formatMoney(rewards[task]));
  }, 2000);
}

// Payout Timer
setInterval(() => {
  const remaining = payoutEndTime - Date.now();
  if (remaining <= 0) { payoutEndTime = Date.now() + 7 * 24 * 60 * 60 * 1000; return; }
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000).toString().padStart(2, '0');
  const m = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  document.getElementById('payoutTimer').textContent = d + 'd ' + h + ':' + m + ':' + s;
}, 1000);
