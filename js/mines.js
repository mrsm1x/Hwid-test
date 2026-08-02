(() => {
  const TOTAL_TILES = 25;
  const HOUSE_EDGE = 0.97;
  const state = { active: false, bet: 0, mines: 3, revealed: 0, multiplier: 1, board: [] };

  const grid = document.getElementById('minesGrid');
  const betInput = document.getElementById('minesBetInput');
  const minesSelect = document.getElementById('minesSelect');
  const actionButton = document.getElementById('minesActionBtn');
  const randomButton = document.getElementById('minesRandomTileBtn');
  const ratioValue = document.getElementById('minesRatioVal');
  const multiplierValue = document.getElementById('minesMultiplierVal');
  const winValue = document.getElementById('minesWinVal');
  const resultBanner = document.getElementById('minesResultBanner');
  const resultTitle = document.getElementById('minesResultTitle');
  const resultValue = document.getElementById('minesResultValue');
  const betsList = document.getElementById('minesBetsList');
  const soundButton = document.getElementById('minesSoundToggleBtn');

  const gemSvg = '<svg class="gem-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2 9l10 13L22 9 12 2Zm0 3.2L18.4 9 12 18.2 5.6 9 12 5.2Z"/></svg>';
  const mineSvg = '<svg class="mine-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

  const audio = {
    context: null,
    enabled: true,
    init() { if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)(); },
    tone(frequency, duration, type = 'sine') {
      if (!this.enabled || !this.context) return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
      gain.gain.setValueAtTime(0.06, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(); oscillator.stop(this.context.currentTime + duration);
    }
  };

  function money(value) { return '$' + value.toFixed(2); }
  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    let result = 1;
    for (let i = 1; i <= r; i++) result = result * (n - i + 1) / i;
    return result;
  }
  function multiplierFor(revealed) {
    if (!revealed) return 1;
    const probability = nCr(TOTAL_TILES - state.mines, revealed) / nCr(TOTAL_TILES, revealed);
    return Math.max(1.01, Math.floor((HOUSE_EDGE / probability) * 100) / 100);
  }
  function updateStats() {
    ratioValue.textContent = state.mines + ' / ' + (TOTAL_TILES - state.mines);
    multiplierValue.textContent = state.multiplier.toFixed(2) + 'x';
    winValue.textContent = money(state.bet * state.multiplier);
  }
  function clearResult() { resultBanner.className = 'mines-result-banner'; }
  function showResult(title, value, kind) {
    resultTitle.textContent = title;
    resultValue.textContent = value;
    resultBanner.className = 'mines-result-banner active ' + kind;
  }
  function renderGrid() {
    grid.innerHTML = '';
    for (let index = 0; index < TOTAL_TILES; index++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'mine-tile disabled';
      tile.setAttribute('aria-label', 'Hidden tile ' + (index + 1));
      tile.addEventListener('click', () => revealTile(index));
      grid.appendChild(tile);
    }
  }
  function renderBots() {
    const names = ['NovaRay', 'GoldFox', 'LuckyMint', 'MoonBet', 'PixelAce'];
    betsList.innerHTML = '';
    names.forEach((name) => {
      const bet = (Math.random() * 55 + 5).toFixed(2);
      const won = Math.random() > 0.42;
      const row = document.createElement('div');
      row.className = 'bet-row' + (won ? ' cashed' : '');
      row.innerHTML = '<div class="player-info"><div class="avatar-crash">' + name[0] + '</div><span class="user-name">' + name + '</span></div><div>$' + bet + '</div><div class="bet-status ' + (won ? 'win' : '') + '">' + (won ? '+' + (1.2 + Math.random() * 3).toFixed(2) + 'x' : 'Mine') + '</div>';
      betsList.appendChild(row);
    });
  }
  function setControls(active) {
    betInput.disabled = active;
    minesSelect.disabled = active;
    randomButton.disabled = !active;
    actionButton.textContent = active ? (state.revealed ? 'CASH OUT ' + money(state.bet * state.multiplier) : 'PICK A GEM') : 'PLACE BET';
    actionButton.className = 'action-btn ' + (active && !state.revealed ? 'disabled' : active ? 'cashout' : 'bet');
  }
  function generateBoard() {
    state.board = Array(TOTAL_TILES).fill('GEM');
    let placed = 0;
    while (placed < state.mines) {
      const index = Math.floor(Math.random() * TOTAL_TILES);
      if (state.board[index] !== 'MINE') { state.board[index] = 'MINE'; placed++; }
    }
  }
  function startGame() {
    audio.init();
    const bet = Number.parseFloat(betInput.value);
    if (!Number.isFinite(bet) || bet < 1 || bet > window.balance) { showToast('Enter a valid bet within your balance'); return; }
    window.balance -= bet;
    updateBalance();
    state.active = true; state.bet = bet; state.revealed = 0; state.multiplier = 1;
    generateBoard(); clearResult(); renderGrid(); updateStats(); setControls(true);
    showToast('Choose a tile and cash out at any time');
  }
  function revealTile(index) {
    if (!state.active) return;
    const tile = grid.children[index];
    if (tile.classList.contains('revealed')) return;
    tile.classList.add('revealed');
    if (state.board[index] === 'MINE') {
      tile.classList.add('revealed-mine'); tile.innerHTML = mineSvg; audio.tone(100, .35, 'sawtooth');
      finishRound(false); return;
    }
    state.revealed++;
    state.multiplier = multiplierFor(state.revealed);
    tile.classList.add('revealed-gem'); tile.innerHTML = gemSvg; audio.tone(440 + state.revealed * 28, .12);
    updateStats(); setControls(true);
    if (state.revealed === TOTAL_TILES - state.mines) cashOut();
  }
  function revealBoard() {
    Array.from(grid.children).forEach((tile, index) => {
      tile.classList.add('disabled');
      if (tile.classList.contains('revealed')) return;
      tile.classList.add(state.board[index] === 'MINE' ? 'faded-mine' : 'faded-gem');
      tile.innerHTML = state.board[index] === 'MINE' ? mineSvg : gemSvg;
    });
  }
  function finishRound(won) {
    state.active = false;
    revealBoard(); setControls(false); renderBots();
    if (!won) { showResult('MINE HIT', '-' + money(state.bet), 'loss'); showToast('Mine hit — better luck next round'); }
  }
  function cashOut() {
    if (!state.active || !state.revealed) return;
    const payout = state.bet * state.multiplier;
    window.balance += payout; updateBalance(); audio.tone(720, .18); audio.tone(920, .22);
    showResult('CASHED OUT', '+' + money(payout - state.bet), 'win');
    finishRound(true); showToast('Cashed out at ' + state.multiplier.toFixed(2) + 'x');
  }
  function randomTile() {
    if (!state.active) return;
    const available = Array.from(grid.children).map((tile, index) => tile.classList.contains('revealed') ? null : index).filter((index) => index !== null);
    if (available.length) revealTile(available[Math.floor(Math.random() * available.length)]);
  }

  window.openMinesGame = () => document.getElementById('minesGame').classList.add('active');
  window.closeMinesGame = () => document.getElementById('minesGame').classList.remove('active');
  window.adjustMinesBet = (factor) => { if (!state.active) betInput.value = Math.max(1, (Number.parseFloat(betInput.value) || 0) * factor).toFixed(2); };
  window.addMinesBet = (amount) => { if (!state.active) betInput.value = ((Number.parseFloat(betInput.value) || 0) + amount).toFixed(2); };
  minesSelect.addEventListener('change', () => { if (!state.active) { state.mines = Number.parseInt(minesSelect.value, 10); updateStats(); } });
  actionButton.addEventListener('click', () => { if (!state.active) startGame(); else if (state.revealed) cashOut(); });
  randomButton.addEventListener('click', randomTile);
  soundButton.addEventListener('click', () => { audio.init(); audio.enabled = !audio.enabled; soundButton.style.color = audio.enabled ? 'var(--yellow-primary)' : 'var(--text-secondary)'; });

  renderGrid(); updateStats(); setControls(false); renderBots();
})();
