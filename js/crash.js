// Web Audio Synthesizer
const AudioEngine = {
    ctx: null, enabled: true,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playBeep(freq, type = 'sine', duration = 0.1) {
        if (!this.enabled || !this.ctx) return;
        try {
            let osc = this.ctx.createOscillator(); let gain = this.ctx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    },
    playCrash() {
        if (!this.enabled || !this.ctx) return;
        try {
            let osc = this.ctx.createOscillator(); let gain = this.ctx.createGain();
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(260, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + 0.6);
        } catch(e) {}
    }
};

let currentBet = 0; let hasBet = false; let cashedOut = false;
let gameState = 'WAITING'; let multiplier = 1.00; let crashPoint = 1.00;
let startTime = 0; let crashTimerInterval = null; let animationFrame = null;
let historyArr = [1.24, 3.45, 1.05, 12.80, 2.10, 1.85, 5.60, 1.12];

let rocketPos = { x: 0, y: 0, angle: -Math.PI / 4, scale: 1, alpha: 1 };
let crashVy = 0; let flyInProgress = 0;

const canvas = document.getElementById('crashCanvas');
const stageBox = document.getElementById('stageBox');
const ctx = canvas.getContext('2d');
let trailParticles = []; let speedLines = []; let stars = [];

const betInput = document.getElementById('betInput');
const autoCashoutInput = document.getElementById('autoCashoutInput');
const autoCashoutToggle = document.getElementById('autoCashoutToggle');
const autoBetToggle = document.getElementById('autoBetToggle');
const actionBtn = document.getElementById('actionBtn');
const multiplierDisplay = document.getElementById('multiplierDisplay');
const statusDisplay = document.getElementById('statusDisplay');
const historyBar = document.getElementById('historyBar');
const betsList = document.getElementById('betsList');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const countdownNum = document.getElementById('countdownNum');
const progressBarFill = document.getElementById('progressBarFill');

function openCrashGame() { 
    document.getElementById('crashGame').classList.add('active'); 
    resizeCanvas();
    if(gameState === 'WAITING' && !crashTimerInterval) prepareNewRound();
}
function closeCrashGame() { document.getElementById('crashGame').classList.remove('active'); }

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    initStars(rect.width, rect.height); initSpeedLines(rect.width, rect.height);
}

function initStars(w, h) {
    stars = [];
    for(let i = 0; i < 60; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, size: Math.random() * 2 + 0.5, alpha: Math.random() * 0.7 + 0.3, speed: Math.random() * 0.8 + 0.2 });
}
function initSpeedLines(w, h) {
    speedLines = [];
    for(let i = 0; i < 20; i++) speedLines.push({ x: Math.random() * w, y: Math.random() * h, length: Math.random() * 40 + 20, speed: Math.random() * 12 + 8, alpha: Math.random() * 0.4 + 0.1 });
}
window.addEventListener('resize', resizeCanvas);

soundToggleBtn.addEventListener('click', () => {
    AudioEngine.init(); AudioEngine.enabled = !AudioEngine.enabled;
    soundToggleBtn.style.color = AudioEngine.enabled ? 'var(--accent-gold)' : '#7e8596';
});

function adjustBet(factor) { let val = parseFloat(betInput.value) || 0; betInput.value = Math.max(1, (val * factor)).toFixed(2); }
function addBet(amount) { let val = parseFloat(betInput.value) || 0; betInput.value = (val + amount).toFixed(2); }

function renderHistory() {
    historyBar.innerHTML = '';
    historyArr.slice(-12).reverse().forEach(m => {
        const el = document.createElement('div');
        let cls = 'low'; if (m >= 2.0) cls = 'mid'; if (m >= 10.0) cls = 'high';
        el.className = `history-item ${cls}`; el.textContent = `${m.toFixed(2)}x`; historyBar.appendChild(el);
    });
}
renderHistory();

const botNames = ['CyberRider', 'Vortex99', 'NeonJack', 'AstraBet', 'CryptoPro', 'Satoshi_G', 'RocketX'];
let liveBots = [];
function generateBots() {
    liveBots = botNames.map(name => ({ name, bet: (Math.random() * 60 + 5).toFixed(2), cashoutAt: (1.1 + Math.random() * 4.5).toFixed(2), cashed: false }));
    renderBots();
}
function renderBots() {
    betsList.innerHTML = '';
    liveBots.forEach(bot => {
        const row = document.createElement('div');
        row.className = `bet-row ${bot.cashed ? 'cashed' : ''}`;
        row.innerHTML = `<div class="player-info"><div class="avatar-crash">${bot.name[0]}</div><span class="user-name">${bot.name}</span></div><div>$${bot.bet}</div><div class="bet-status ${bot.cashed ? 'win' : ''}">${bot.cashed ? `x${bot.cashoutAt}` : 'В игре'}</div>`;
        betsList.appendChild(row);
    });
}

function spawnTrailParticle(x, y, angle) {
    const spread = (Math.random() - 0.5) * 0.4; const pAngle = angle + Math.PI + spread; const speed = Math.random() * 5 + 3;
    trailParticles.push({ x, y, vx: Math.cos(pAngle) * speed, vy: Math.sin(pAngle) * speed, radius: Math.random() * 6 + 3, alpha: 1, color: Math.random() > 0.3 ? '#ffd700' : (Math.random() > 0.5 ? '#ff4500' : '#00f0ff') });
}

function drawProfessionalRocket(ctx, scale, alpha) {
    ctx.save(); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
    const flameLen = 28 + Math.random() * 12; const flameGrad = ctx.createLinearGradient(-12, 0, -12 - flameLen, 0);
    flameGrad.addColorStop(0, '#00ffff'); flameGrad.addColorStop(0.2, '#ffd700'); flameGrad.addColorStop(0.6, '#ff3300'); flameGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-12 - flameLen, 0); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fillStyle = flameGrad; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 15; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -2.5); ctx.lineTo(-10 - flameLen * 0.5, 0); ctx.lineTo(-10, 2.5); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowBlur = 0;
    const finGrad = ctx.createLinearGradient(-12, -14, -4, 14); finGrad.addColorStop(0, '#ffaa00'); finGrad.addColorStop(1, '#990000');
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-16, -15); ctx.lineTo(-4, -6); ctx.closePath(); ctx.fillStyle = finGrad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-16, 15); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fillStyle = finGrad; ctx.fill();
    const bodyGrad = ctx.createLinearGradient(0, -9, 0, 9); bodyGrad.addColorStop(0, '#ffffff'); bodyGrad.addColorStop(0.3, '#d0d5e0'); bodyGrad.addColorStop(0.7, '#485065'); bodyGrad.addColorStop(1, '#1e222e');
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.bezierCurveTo(12, -9, -10, -9, -12, -6); ctx.lineTo(-12, 6); ctx.bezierCurveTo(-10, 9, 12, 9, 22, 0); ctx.closePath(); ctx.fillStyle = bodyGrad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.bezierCurveTo(12, -9, -10, -9, -12, -6); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    const noseGrad = ctx.createLinearGradient(8, -5, 22, 0); noseGrad.addColorStop(0, '#ffd700'); noseGrad.addColorStop(1, '#ff8c00');
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.bezierCurveTo(16, -5, 10, -5, 10, -5); ctx.lineTo(10, 5); ctx.bezierCurveTo(10, 5, 16, 5, 22, 0); ctx.closePath(); ctx.fillStyle = noseGrad; ctx.fill();
    const visorGrad = ctx.createLinearGradient(2, -3, 8, 3); visorGrad.addColorStop(0, '#00ffff'); visorGrad.addColorStop(1, '#0055ff');
    ctx.beginPath(); ctx.ellipse(5, -1, 5, 3.2, 0, 0, Math.PI * 2); ctx.fillStyle = visorGrad; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(4, -2, 2, 1, Math.PI / 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fill();
    ctx.fillStyle = '#111319'; ctx.fillRect(-12, -5, 2, 10);
    ctx.restore();
}

function drawCanvas() {
    const w = canvas.parentElement.clientWidth; const h = canvas.parentElement.clientHeight;
    ctx.clearRect(-50, -50, w * 2, h * 2);
    stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.fill();
        if (gameState === 'RUNNING' || gameState === 'ENTRANCE') { s.x -= s.speed * (multiplier * 0.9); s.y += s.speed * (multiplier * 0.6); if (s.x < 0) s.x = w; if (s.y > h) s.y = 0; }
    });
    if (gameState === 'RUNNING') {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'; ctx.lineWidth = 1;
        speedLines.forEach(l => {
            ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x - l.length, l.y + l.length * 0.6); ctx.stroke();
            l.x -= l.speed * (multiplier * 0.8); l.y += l.speed * 0.5; if (l.x < 0) l.x = w + 50; if (l.y > h) l.y = -20;
        });
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; ctx.lineWidth = 1;
    const gridOffset = (gameState === 'RUNNING') ? (Date.now() / 15) % 30 : 0;
    for (let x = -gridOffset; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = gridOffset; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (gameState === 'ENTRANCE') {
        rocketPos.x = -60 + ((w / 2) + 60) * flyInProgress; rocketPos.y = h + 60 - (h + 60 - (h / 2)) * flyInProgress; rocketPos.angle = -Math.PI / 4; rocketPos.scale = 1.0; rocketPos.alpha = 1.0;
    } else if (gameState === 'RUNNING') {
        const time = Date.now() / 80; const pulseScale = 1.0 + Math.sin(time * 2.0) * 0.08 + (multiplier - 1) * 0.015;
        rocketPos.x = (w / 2) + Math.sin(time * 2.5) * 3; rocketPos.y = (h / 2) + Math.cos(time * 3.1) * 3; rocketPos.angle = -Math.PI / 4 + Math.sin(time * 1.5) * 0.04; rocketPos.scale = Math.min(1.8, pulseScale); rocketPos.alpha = 1.0;
        for(let i = 0; i < 2; i++) spawnTrailParticle(rocketPos.x, rocketPos.y, rocketPos.angle);
    } else if (gameState === 'CRASHING') {
        rocketPos.angle += (-Math.PI / 2 - rocketPos.angle) * 0.15; crashVy += 1.8; rocketPos.y -= crashVy; rocketPos.alpha -= 0.025;
        spawnTrailParticle(rocketPos.x, rocketPos.y, rocketPos.angle);
    }
    trailParticles.forEach((p, idx) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.alpha); ctx.fill(); ctx.globalAlpha = 1.0;
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.03; if (p.alpha <= 0) trailParticles.splice(idx, 1);
    });
    if (gameState === 'RUNNING' || gameState === 'ENTRANCE' || gameState === 'CRASHING') {
        ctx.save(); ctx.translate(rocketPos.x, rocketPos.y); ctx.rotate(rocketPos.angle); drawProfessionalRocket(ctx, rocketPos.scale, rocketPos.alpha); ctx.restore();
    }
}

function gameLoop() {
    drawCanvas();
    if (gameState === 'ENTRANCE') {
        flyInProgress += 0.03; if (flyInProgress >= 1.0) { flyInProgress = 1.0; launchFlight(); return; }
        animationFrame = requestAnimationFrame(gameLoop);
    } else if (gameState === 'RUNNING') {
        const elapsed = (Date.now() - startTime) / 1000; multiplier = Math.max(1.00, Math.exp(0.18 * elapsed));
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        liveBots.forEach(bot => { if (!bot.cashed && multiplier >= parseFloat(bot.cashoutAt)) { bot.cashed = true; renderBots(); } });
        if (hasBet && !cashedOut && autoCashoutToggle.checked) {
            const autoVal = parseFloat(autoCashoutInput.value); if (autoVal && multiplier >= autoVal) doCashout();
        }
        if (multiplier >= crashPoint) { triggerCrash(); animationFrame = requestAnimationFrame(gameLoop); return; }
        animationFrame = requestAnimationFrame(gameLoop);
    } else if (gameState === 'CRASHING') {
        animationFrame = requestAnimationFrame(gameLoop);
    }
}

function prepareNewRound() {
    gameState = 'WAITING'; multiplier = 1.00; hasBet = false; cashedOut = false; crashVy = 0;
    trailParticles = []; multiplierDisplay.className = 'multiplier-val'; multiplierDisplay.textContent = '1.00x'; statusDisplay.textContent = 'PREPARING NEXT ROUND...';
    loadingOverlay.className = 'loading-overlay active';
    if (autoBetToggle.checked && window.balance >= parseFloat(betInput.value)) placeBet();
    else { actionBtn.textContent = 'PLACE BET'; actionBtn.className = 'action-btn bet'; }
    generateBots();
    let countdown = 5; countdownNum.textContent = countdown; progressBarFill.style.width = '0%';
    let totalTime = 5000; let elapsed = 0;
    crashTimerInterval = setInterval(() => {
        elapsed += 100; progressBarFill.style.width = `${(elapsed / totalTime) * 100}%`;
        if (elapsed % 1000 === 0) { countdown--; if (countdown >= 0) countdownNum.textContent = countdown; }
        if (elapsed >= totalTime) {
            clearInterval(crashTimerInterval); crashTimerInterval = null;
            loadingOverlay.className = 'loading-overlay';
            gameState = 'ENTRANCE'; flyInProgress = 0; gameLoop();
        }
    }, 100);
}

function placeBet() {
    const bet = parseFloat(betInput.value);
    if(!bet || bet < 1 || bet > window.balance) return;
    window.balance -= bet; window.updateBalance();
    currentBet = bet; hasBet = true;
    actionBtn.textContent = 'CASH OUT'; actionBtn.className = 'action-btn cashout';
}

function doCashout() {
    if(!hasBet || cashedOut || gameState !== 'RUNNING') return;
    cashedOut = true; const win = currentBet * multiplier;
    window.balance += win; window.updateBalance();
    actionBtn.textContent = 'CASHED OUT'; actionBtn.className = 'action-btn disabled';
    showToast(`Cashed out at x${multiplier.toFixed(2)}!`);
}

function triggerCrash() {
    gameState = 'CRASHING'; AudioEngine.playCrash();
    multiplierDisplay.classList.add('crashed'); statusDisplay.textContent = 'CRASHED!';
    if(hasBet && !cashedOut) { actionBtn.textContent = 'ROUND LOST'; actionBtn.className = 'action-btn disabled'; }
    historyArr.push(multiplier); renderHistory();
    setTimeout(prepareNewRound, 3000);
}

function launchFlight() {
    gameState = 'RUNNING'; startTime = Date.now();
    // Inverse distribution: every higher multiplier is less likely than the last.
    // Approximate odds of reaching a multiplier x are 97% / x (10x ≈ 9.7%, 100x ≈ 0.97%).
    const roll = Math.max(Math.random(), 0.00097);
    crashPoint = Math.min(1000, Math.max(1.01, Math.floor((0.97 / roll) * 100) / 100));
    statusDisplay.textContent = 'IN FLIGHT...';
    // The entrance frame returns immediately after launching; schedule the first
    // running frame so the multiplier and crash detection continue updating.
    animationFrame = requestAnimationFrame(gameLoop);
}

actionBtn.addEventListener('click', () => {
    if (!hasBet && gameState === 'WAITING') placeBet();
    else if (hasBet && !cashedOut && gameState === 'RUNNING') doCashout();
});
