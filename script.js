// --- Add these DOM Element selectors ---
const leaderboardToggleButton = document.getElementById('leaderboard-toggle-button');
const leaderboardSidebar = document.getElementById('leaderboard-sidebar');
const leaderboardList = document.getElementById('leaderboard-list');
const clearScoresButton = document.getElementById('clear-scores-button');
const highScoreEntry = document.getElementById('high-score-entry');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreButton = document.getElementById('submit-score-button');

// --- Add these Constants ---
const MAX_HIGH_SCORES = 10; // Show top 10 scores
const RANKING_STORAGE_KEY = 'helicopterGameHighScores_v1'; // Unique key for localStorage

// --- Your existing DOM Elements & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const finalScoreDisplay = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOver');
const pauseOverlay = document.getElementById('pauseOverlay');
const loadingIndicator = document.getElementById('loadingIndicator');
const restartButton = document.getElementById('restartButton'); // Original restart
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
let helicopterY, helicopterVelocityY, obstacles = [], score, bestScore = 0, frameCount, isGameOver, isPaused, isLifting, animationFrameId;
let currentHelicopterWidth, currentHelicopterHeight, currentObstacleWidth, currentObstacleGap, currentObstacleMinHeight, helicopterX;

// --- Assets ---
const helicopterImage = new Image();
const backgroundImage = new Image(); // Still loaded for asset counting
const obstacleImage = new Image();
let assetsLoaded = 0;
const totalAssets = 3; // Helicopter, Background (count), Obstacle

// Asset Paths (Make sure these are correct)
helicopterImage.src = 'assets/helicopter_icon.png';
backgroundImage.src = 'assets/sky.gif';
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

// --- MODIFY assetLoaded ---
function assetLoaded() {
    assetsLoaded++;
    console.log(`Asset loaded (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded.");
        loadingIndicator.classList.add('hidden');
        displayHighScores(); // <<-- Load scores when assets ready
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

    bestScore = localStorage.getItem('helicopterBestScore') || 0; // Your personal best key
    bestScoreDisplay.textContent = `Best: ${bestScore}`;
    scoreDisplay.textContent = `Score: 0`;

    // Reset UI States
    gameOverScreen.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    highScoreEntry.classList.add('hidden');    // Hide name input
    submitScoreButton.classList.add('hidden'); // Hide submit button
    restartButton.classList.remove('hidden');  // Show normal restart button
    leaderboardSidebar.classList.remove('open'); // Ensure sidebar closed
    leaderboardToggleButton.classList.remove('open');
    pauseButton.textContent = 'Pause';
    pauseButton.disabled = false;
    pauseButton.classList.remove('paused');

    obstacles = [];
    generateObstacle();
    if (obstacles.length > 0) obstacles[0].x = canvas.width * 0.9;

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

// --- Game Loop ---
function gameLoop() {
     if (isGameOver) {
        showGameOver(); // Ensure game over screen is shown
        return; // Stop the loop
    }
    if (isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop); // Keep checking for unpause
        return; // Skip updates and drawing
    }

    updateHelicopter();
    updateObstacles();
    checkCollisions();

    // Rendering Order
    drawBackground();
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
function drawBackground() { ctx.clearRect(0, 0, canvas.width, canvas.height); } // Assumes CSS background
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
function drawPauseScreen() { redrawStaticElements(); }
function redrawStaticElements() { drawBackground(); drawObstacles(); drawHelicopter(); }

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
function rectsOverlap(rect1, rect2) { return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y ); }

// --- Game State Management ---
function togglePause() {
     if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        leaderboardSidebar.classList.remove('open'); // Close sidebar on pause
        leaderboardToggleButton.classList.remove('open');
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

    leaderboardSidebar.classList.remove('open'); // Close sidebar on game over
    leaderboardToggleButton.classList.remove('open');

    if (crashSound) { crashSound.currentTime = 0; crashSound.play().catch(e => console.error("Error playing sound:", e)); }

    // Update Personal Best (if needed)
    if (score > bestScore) {
        bestScore = score; localStorage.setItem('helicopterBestScore', bestScore);
        bestScoreDisplay.textContent = `Best: ${bestScore}`;
    }

    // --- Check High Score Ranking ---
    const highScores = loadHighScores();
    const lowestQualifyingScore = highScores.length < MAX_HIGH_SCORES ? 0 : highScores[MAX_HIGH_SCORES - 1].score;

    if (score > 0 && score >= lowestQualifyingScore) {
        console.log("New High Score achieved!");
        highScoreEntry.classList.remove('hidden');
        submitScoreButton.classList.remove('hidden');
        restartButton.classList.add('hidden'); // Hide normal restart
        playerNameInput.value = '';
        setTimeout(() => playerNameInput.focus(), 100); // Focus after slight delay
    } else {
        highScoreEntry.classList.add('hidden');
        submitScoreButton.classList.add('hidden');
        restartButton.classList.remove('hidden'); // Show normal restart
    }

    // Game loop will call showGameOver
}
function showGameOver() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Stop loop *before* showing screen
    animationFrameId = null;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden'); // Now show the game over screen
}
function restartGame() {
    gameOverScreen.classList.add('hidden'); // Hide immediately
    initGame(); // Re-initialize
}

// --- Leaderboard Functions ---
function loadHighScores() {
    try {
        const scoresJSON = localStorage.getItem(RANKING_STORAGE_KEY);
        const scores = scoresJSON ? JSON.parse(scoresJSON) : [];
        scores.sort((a, b) => b.score - a.score);
        return scores;
    } catch (e) { console.error("Error loading high scores:", e); localStorage.removeItem(RANKING_STORAGE_KEY); return []; }
}
function saveHighScores(scores) {
    try {
        scores.sort((a, b) => b.score - a.score);
        const scoresToSave = scores.slice(0, MAX_HIGH_SCORES);
        localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(scoresToSave));
    } catch (e) { console.error("Error saving high scores:", e); }
}
function displayHighScores() {
    const highScores = loadHighScores();
    leaderboardList.innerHTML = '';
    if (highScores.length === 0) {
        const li = document.createElement('li'); li.textContent = 'No scores yet!'; li.classList.add('empty-message'); leaderboardList.appendChild(li); return;
    }
    highScores.forEach((entry) => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span'); nameSpan.className = 'player-name'; nameSpan.textContent = entry.name;
        const scoreSpan = document.createElement('span'); scoreSpan.className = 'player-score'; scoreSpan.textContent = entry.score;
        li.appendChild(nameSpan); li.appendChild(scoreSpan); leaderboardList.appendChild(li);
    });
}
function submitHighScore() {
    let playerName = playerNameInput.value.trim();
    if (!playerName) playerName = "Player";
    playerName = playerName.substring(0, 10);
    const newScoreEntry = { name: playerName, score: score };
    const highScores = loadHighScores(); highScores.push(newScoreEntry); saveHighScores(highScores); displayHighScores();
    restartGame();
}
function clearHighScores() {
    if (confirm("Are you sure you want to clear all high scores?")) {
        try { localStorage.removeItem(RANKING_STORAGE_KEY); displayHighScores(); }
        catch (e) { console.error("Error clearing high scores:", e); }
    }
}

// --- Event Listeners ---
function handleInputStart(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.type === 'touchstart') event.preventDefault();
    const isSidebarClick = leaderboardSidebar.contains(event.target);
    const isToggleClick = event.target === leaderboardToggleButton;
    const isButton = event.target.closest('button');
    const isInput = event.target === playerNameInput;
    if (isSidebarClick || isToggleClick) return;
    if (isGameOver && !isButton && !isInput) { if (restartButton.offsetParent !== null) { restartGame(); } return; }
    if (isPaused && !isButton) { togglePause(); }
    else if (!isGameOver && !isPaused && !isButton) { isLifting = true; }
}
function handleInputEnd(event) { if (event.type === 'touchend') event.preventDefault(); isLifting = false; }
function handleKeyDown(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.target === playerNameInput) { if(event.key === 'Enter') submitHighScore(); return; }
    if (event.code === 'Space') event.preventDefault();
    if (leaderboardSidebar.classList.contains('open')) return; // Ignore game keys if sidebar open
    if (event.code === 'Space') { handleInputStart(event); }
    else if (isGameOver && event.code === 'Enter' && restartButton.offsetParent !== null) { restartGame(); }
    else if (!isGameOver && event.code === 'KeyP') { togglePause(); }
}
function handleKeyUp(event) {
    if (assetsLoaded < totalAssets) return;
    if (event.target === playerNameInput) return;
    if (event.code === 'Space') { handleInputEnd(event); }
}

// Assign Listeners
leaderboardToggleButton.addEventListener('click', () => { leaderboardSidebar.classList.toggle('open'); leaderboardToggleButton.classList.toggle('open'); });
clearScoresButton.addEventListener('click', clearHighScores);
submitScoreButton.addEventListener('click', submitHighScore);
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
