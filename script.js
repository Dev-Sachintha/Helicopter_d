// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const finalScoreDisplay = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOver');
const pauseOverlay = document.getElementById('pauseOverlay');
const loadingIndicator = document.getElementById('loadingIndicator');
const restartButton = document.getElementById('restartButton');
const pauseButton = document.getElementById('pauseButton');
const crashSound = document.getElementById('crashSound');
const canvasContainer = document.getElementById('canvas-container');

// --- Game Constants ---
const BASE_CANVAS_HEIGHT = 400;
const HELICOPTER_WIDTH_RATIO = 60 / BASE_CANVAS_HEIGHT;
const HELICOPTER_HEIGHT_RATIO = 25 / BASE_CANVAS_HEIGHT;
const OBSTACLE_WIDTH_RATIO = 70 / BASE_CANVAS_HEIGHT;
const OBSTACLE_GAP_RATIO = 140 / BASE_CANVAS_HEIGHT;
const OBSTACLE_MIN_HEIGHT_RATIO = 40 / BASE_CANVAS_HEIGHT;

const GRAVITY = 0.14;
const LIFT = -0.35;
const MAX_VELOCITY = 6;
const OBSTACLE_SPEED = 3.5;
const OBSTACLE_FREQUENCY = 100;

// --- Game State Variables ---
let helicopterY;
let helicopterVelocityY;
let obstacles;
let score;
let bestScore = 0;
let frameCount;
let isGameOver;
let isPaused;
let isLifting;
let animationFrameId;

// Variables for scaled dimensions
let currentHelicopterWidth;
let currentHelicopterHeight;
let currentObstacleWidth;
let currentObstacleGap;
let currentObstacleMinHeight;
let helicopterX;

// --- Assets ---
const helicopterImage = new Image();
const backgroundImage = new Image(); // Still loaded for asset counting
const obstacleImage = new Image();

let assetsLoaded = 0;
const totalAssets = 3; // Helicopter, Background (count), Obstacle

// Asset Paths
helicopterImage.src = 'assets/helicopter_icon.png';
backgroundImage.src = 'assets/sky.gif'; // Path needed for loading
obstacleImage.src = 'assets/obstacle.gif';

// --- Asset Loading ---
function assetLoadError(assetName) {
    console.error(`Failed to load ${assetName}`);
    loadingIndicator.innerHTML = `<div>Error loading ${assetName}</div>`;
}

helicopterImage.onload = assetLoaded;
backgroundImage.onload = assetLoaded;
obstacleImage.onload = assetLoaded;

helicopterImage.onerror = () => assetLoadError('helicopter image');
backgroundImage.onerror = () => assetLoadError('background image');
obstacleImage.onerror = () => assetLoadError('obstacle image');

function assetLoaded() {
    assetsLoaded++;
    console.log(`Asset loaded (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded.");
        loadingIndicator.classList.add('hidden');
        initGame();
        window.addEventListener('resize', debounce(handleResize, 150));
    }
}

// --- Debounce Function ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- Canvas Resizing ---
function resizeCanvas() {
    const displayWidth = canvasContainer.clientWidth;
    const displayHeight = canvasContainer.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

        currentHelicopterHeight = canvas.height * HELICOPTER_HEIGHT_RATIO;
        currentHelicopterWidth = canvas.height * HELICOPTER_WIDTH_RATIO;
        currentObstacleWidth = canvas.height * OBSTACLE_WIDTH_RATIO;
        currentObstacleGap = canvas.height * OBSTACLE_GAP_RATIO;
        currentObstacleMinHeight = canvas.height * OBSTACLE_MIN_HEIGHT_RATIO;
        helicopterX = canvas.width * 0.15;

        return true;
    }
    return false;
}

function handleResize() {
    console.log("Resize event detected");
    if (isGameOver) return;
    const resized = resizeCanvas();
    if (resized && !isPaused) {
        redrawStaticElements();
    } else if (resized && isPaused) {
        drawPauseScreen();
    }
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    resizeCanvas();

    helicopterY = canvas.height / 2 - currentHelicopterHeight / 2;
    helicopterVelocityY = 0;
    obstacles = [];
    score = 0;
    frameCount = 0;
    isGameOver = false;
    isPaused = false;
    isLifting = false;

    bestScore = localStorage.getItem('helicopterBestScore') || 0;
    bestScoreDisplay.textContent = `Best: ${bestScore}`;
    scoreDisplay.textContent = `Score: 0`;

    gameOverScreen.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    pauseButton.textContent = 'Pause';
    pauseButton.disabled = false;
    pauseButton.classList.remove('paused');

    obstacles = [];
    generateObstacle();
    if (obstacles.length > 0) obstacles[0].x = canvas.width * 0.9;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();
}

// --- Game Loop ---
function gameLoop() {
    if (isGameOver) {
        showGameOver();
        return;
    }
    if (isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }

    updateHelicopter();
    updateObstacles();
    checkCollisions();

    // *** Rendering ***
    drawBackground(); // Clears the canvas
    drawObstacles();
    drawHelicopter();

    score++;
    frameCount++;
    scoreDisplay.textContent = `Score: ${score}`;

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Update Functions ---
function updateHelicopter() {
    if (isLifting) helicopterVelocityY += LIFT;
    else helicopterVelocityY += GRAVITY;
    helicopterVelocityY = Math.max(Math.min(helicopterVelocityY, MAX_VELOCITY), -MAX_VELOCITY);
    helicopterY += helicopterVelocityY;
    if (helicopterY < 0 || helicopterY + currentHelicopterHeight > canvas.height) gameOver();
}

function updateObstacles() {
    if (frameCount > 0 && frameCount % OBSTACLE_FREQUENCY === 0) generateObstacle();
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= OBSTACLE_SPEED;
        if (obstacles[i].x + currentObstacleWidth < 0) obstacles.splice(i, 1);
    }
}

function generateObstacle() {
    const availableHeight = canvas.height - currentObstacleGap - (2 * currentObstacleMinHeight);
    if (availableHeight < 0) return;
    const topHeight = currentObstacleMinHeight + Math.random() * availableHeight;
    obstacles.push({ x: canvas.width, topHeight: topHeight, bottomY: topHeight + currentObstacleGap });
}

// --- Drawing Functions ---

// CORRECT: Clears the canvas for CSS background
function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawHelicopter() {
    if (helicopterImage.complete && helicopterImage.naturalWidth !== 0) {
        ctx.drawImage(helicopterImage, helicopterX, helicopterY, currentHelicopterWidth, currentHelicopterHeight);
    } else {
        ctx.fillStyle = '#FFA500'; // Fallback
        ctx.fillRect(helicopterX, helicopterY, currentHelicopterWidth, currentHelicopterHeight);
    }
}

function drawObstacles() {
    const drawAsImage = obstacleImage.complete && obstacleImage.naturalWidth !== 0;
    obstacles.forEach(obstacle => {
        const bottomHeight = canvas.height - obstacle.bottomY;
        if (drawAsImage) {
            ctx.drawImage(obstacleImage, obstacle.x, 0, currentObstacleWidth, obstacle.topHeight);
            ctx.drawImage(obstacleImage, obstacle.x, obstacle.bottomY, currentObstacleWidth, bottomHeight);
        } else { // Fallback
            ctx.fillStyle = '#2E8B57'; ctx.strokeStyle = '#1E5E3A'; ctx.lineWidth = 2;
            ctx.fillRect(obstacle.x, 0, currentObstacleWidth, obstacle.topHeight);
            ctx.strokeRect(obstacle.x, 0, currentObstacleWidth, obstacle.topHeight);
            ctx.fillRect(obstacle.x, obstacle.bottomY, currentObstacleWidth, bottomHeight);
            ctx.strokeRect(obstacle.x, obstacle.bottomY, currentObstacleWidth, bottomHeight);
        }
    });
}

function drawPauseScreen() {
    redrawStaticElements();
}

function redrawStaticElements() {
    drawBackground();
    drawObstacles();
    drawHelicopter();
}

// --- Collision Detection ---
function checkCollisions() {
    const heliRect = { x: helicopterX, y: helicopterY, width: currentHelicopterWidth, height: currentHelicopterHeight };
    for (const obstacle of obstacles) {
        const topRect = { x: obstacle.x, y: 0, width: currentObstacleWidth, height: obstacle.topHeight };
        const bottomRect = { x: obstacle.x, y: obstacle.bottomY, width: currentObstacleWidth, height: canvas.height - obstacle.bottomY };
        if (rectsOverlap(heliRect, topRect) || rectsOverlap(heliRect, bottomRect)) {
            gameOver(); return;
        }
    }
}

function rectsOverlap(rect1, rect2) {
    return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y );
}

// --- Game State Management ---
function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseButton.textContent = 'Resume'; pauseButton.classList.add('paused');
    } else {
        pauseOverlay.classList.add('hidden');
        pauseButton.textContent = 'Pause'; pauseButton.classList.remove('paused');
        redrawStaticElements();
    }
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true; isLifting = false; pauseButton.disabled = true;
    if (crashSound) { crashSound.currentTime = 0; crashSound.play().catch(e => console.error("Error playing sound:", e)); }
    if (score > bestScore) {
        bestScore = score; localStorage.setItem('helicopterBestScore', bestScore);
        bestScoreDisplay.textContent = `Best: ${bestScore}`;
    }
}

function showGameOver() {
    cancelAnimationFrame(animationFrameId); animationFrameId = null;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    gameOverScreen.classList.add('hidden');
    initGame();
}

// --- Event Listeners ---
function handleInputStart(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.type === 'touchstart') event.preventDefault();
    if (isGameOver && event.target !== pauseButton) { restartGame(); return; }
    if (isPaused && event.target !== pauseButton) { togglePause(); }
    else if (!isGameOver && !isPaused && event.target !== pauseButton) { isLifting = true; }
}

function handleInputEnd(event) {
    if (event.type === 'touchend') event.preventDefault();
    isLifting = false;
}

function handleKeyDown(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.code === 'Space') { event.preventDefault(); handleInputStart(event); }
    else if (isGameOver && event.code === 'Enter') { restartGame(); }
    else if (!isGameOver && event.code === 'KeyP') { togglePause(); }
}

function handleKeyUp(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.code === 'Space') { handleInputEnd(event); }
}

canvas.addEventListener('touchstart', handleInputStart, { passive: false });
canvas.addEventListener('touchend', handleInputEnd);
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) handleInputStart(e); });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) handleInputEnd(e); });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
restartButton.addEventListener('click', restartGame);
pauseButton.addEventListener('click', togglePause);

// --- Initial Load ---
console.log("Script loaded. Waiting for assets...");
