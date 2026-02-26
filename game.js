const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Audio Context and Synth Functions
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playGameOverSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.0);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.0);
}

let bgmOscillator = null;
let bgmGainNode = null;

function playBackgroundMusic() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    stopBackgroundMusic(); // Ensure no duplicates

    bgmOscillator = audioCtx.createOscillator();
    bgmGainNode = audioCtx.createGain();

    bgmOscillator.type = 'sine';

    // Create a subtle rhythm by modulating frequency slightly
    bgmOscillator.frequency.setValueAtTime(65, audioCtx.currentTime); // Deep bass C2

    // Low volume
    bgmGainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

    bgmOscillator.connect(bgmGainNode);
    bgmGainNode.connect(audioCtx.destination);

    bgmOscillator.start();
}

function stopBackgroundMusic() {
    if (bgmOscillator) {
        bgmOscillator.stop();
        bgmOscillator.disconnect();
        bgmOscillator = null;
    }
    if (bgmGainNode) {
        bgmGainNode.disconnect();
        bgmGainNode = null;
    }
}

// UI Elements
const startScreen = document.getElementById('start-screen');
const hudScreen = document.getElementById('hud-screen');
const transitionScreen = document.getElementById('level-transition-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const levelTitle = document.getElementById('level-title');
const finalScore = document.getElementById('final-score');
const victoryScore = document.getElementById('victory-score');

// Buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);

// Game State
let gameState = 'START';
let animationId;
let score = 0;
let currentLevel = 1;
let frames = 0;

// Game Config for Levels
const levelConfig = {
    1: { enemySpeed: 1.5, spawnRate: 90, targetScore: 100, cols: '#ff0055', zigzag: false },
    2: { enemySpeed: 2.5, spawnRate: 60, targetScore: 300, cols: '#00ffcc', zigzag: false },
    3: { enemySpeed: 3.5, spawnRate: 40, targetScore: 600, cols: '#ffff00', zigzag: true }
};

// Input Handling
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key) || e.code === 'Space') {
        if (e.code === 'Space') keys.Space = true;
        else keys[e.key] = true;

        if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key) || e.code === 'Space') {
        if (e.code === 'Space') keys.Space = false;
        else keys[e.key] = false;
    }
});

// Entities
class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 6;
        this.color = '#2600ffff';
        this.lastShot = 0;
        this.fireRate = 200;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 10);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update() {
        if ((keys.w || keys.ArrowUp) && this.y > 0) this.y -= this.speed;
        if ((keys.s || keys.ArrowDown) && this.y + this.height < canvas.height) this.y += this.speed;
        if ((keys.a || keys.ArrowLeft) && this.x > 0) this.x -= this.speed;
        if ((keys.d || keys.ArrowRight) && this.x + this.width < canvas.width) this.x += this.speed;

        if (keys.Space) {
            const now = Date.now();
            if (now - this.lastShot > this.fireRate) {
                projectiles.push(new Projectile(this.x + this.width / 2, this.y));
                playShootSound();
                this.lastShot = now;
            }
        }
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.speed = 12;
        this.color = '#ff00ff';
        this.markedForDeletion = false;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y -= this.speed;
        if (this.y + this.radius < 0) this.markedForDeletion = true;
    }
}

class Enemy {
    constructor(speed, color, zigzag) {
        this.width = 30;
        this.height = 30;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = speed;
        this.color = color;
        this.markedForDeletion = false;
        this.zigzag = zigzag;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.width, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.zigzag) {
            this.x += Math.sin(this.angle) * 4;
            this.angle += 0.1;
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        }

        if (this.y > canvas.height) this.markedForDeletion = true;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 1;
        this.color = color;
        this.velocity = {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        };
        this.alpha = 1;
        this.markedForDeletion = false;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
        if (this.alpha <= 0) this.markedForDeletion = true;
    }
}

let player;
let projectiles = [];
let enemies = [];
let particles = [];
let stars = [];

function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1,
            alpha: Math.random()
        });
    }
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    ctx.globalAlpha = 1;
}

function switchScreen(activeScreen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (activeScreen) activeScreen.classList.add('active');
}

function startGame() {
    initStars();
    player = new Player();
    projectiles = [];
    enemies = [];
    particles = [];
    score = 0;
    currentLevel = 1;
    frames = 0;

    updateScoreBoard();
    switchScreen(hudScreen);
    gameState = 'PLAYING';

    playBackgroundMusic();

    if (animationId) cancelAnimationFrame(animationId);
    animate();
}

function updateScoreBoard() {
    scoreDisplay.innerText = `Skor: ${score}`;
    levelDisplay.innerText = `Seviye: ${currentLevel}`;
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function checkCollisions() {
    projectiles.forEach(projectile => {
        enemies.forEach(enemy => {
            if (projectile.x > enemy.x &&
                projectile.x < enemy.x + enemy.width &&
                projectile.y > enemy.y &&
                projectile.y < enemy.y + enemy.height) {

                projectile.markedForDeletion = true;
                enemy.markedForDeletion = true;

                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);

                score += 10;
                updateScoreBoard();
                checkLevelProgression();
            }
        });
    });

    enemies.forEach(enemy => {
        // Reduced hitbox for player
        if (player.x + 10 < enemy.x + enemy.width &&
            player.x + player.width - 10 > enemy.x &&
            player.y + 10 < enemy.y + enemy.height &&
            player.y + player.height - 10 > enemy.y) {

            createExplosion(player.x + player.width / 2, player.y + player.height / 2, player.color);
            endGame('GAMEOVER');
        }
    });
}

function checkLevelProgression() {
    if (gameState !== 'PLAYING') return;

    if (currentLevel === 1 && score >= levelConfig[1].targetScore) {
        startLevelTransition(2);
    } else if (currentLevel === 2 && score >= levelConfig[2].targetScore) {
        startLevelTransition(3);
    } else if (currentLevel === 3 && score >= levelConfig[3].targetScore) {
        endGame('VICTORY');
    }
}

function startLevelTransition(nextLevel) {
    gameState = 'TRANSITION';
    currentLevel = nextLevel;
    levelTitle.innerText = `SEVİYE ${currentLevel}`;
    switchScreen(transitionScreen);

    projectiles = [];
    enemies = [];

    setTimeout(() => {
        if (gameState === 'TRANSITION') {
            switchScreen(hudScreen);
            updateScoreBoard();
            gameState = 'PLAYING';
        }
    }, 2500);
}

function endGame(type) {
    gameState = type;
    projectiles = [];
    enemies = [];

    stopBackgroundMusic();
    if (type === 'GAMEOVER') {
        playGameOverSound();
    }

    setTimeout(() => {
        if (type === 'GAMEOVER') {
            finalScore.innerText = `Skorun: ${score}`;
            switchScreen(gameOverScreen);
        } else if (type === 'VICTORY') {
            victoryScore.innerText = `Final Skor: ${score}`;
            switchScreen(victoryScreen);
        }
    }, 1000);
}

function spawnEnemies() {
    const config = levelConfig[currentLevel];
    if (frames % config.spawnRate === 0) {
        enemies.push(new Enemy(config.enemySpeed, config.cols, config.zigzag));
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawStars();

    if (gameState === 'PLAYING') {
        player.update();
        player.draw();

        spawnEnemies();
        checkCollisions();
    }

    if (gameState === 'PLAYING' || gameState === 'GAMEOVER' || gameState === 'VICTORY') {
        if (gameState === 'PLAYING' && player) {
            player.draw();
        }

        projectiles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.markedForDeletion) projectiles.splice(index, 1);
        });

        enemies.forEach((e, index) => {
            if (gameState === 'PLAYING') e.update();
            e.draw();
            if (e.markedForDeletion) enemies.splice(index, 1);
        });
    }

    particles.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.markedForDeletion) particles.splice(index, 1);
    });

    frames++;
}

function animate() {
    if (gameState !== 'START') {
        gameLoop();
    }
    animationId = requestAnimationFrame(animate);
}

initStars();
animate();
