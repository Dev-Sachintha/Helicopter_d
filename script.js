// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const finalScoreDisplay = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOver');
const pauseOverlay = document.getElementById('pauseOverlay');
const loadingIndicator = document.getElementById('loadingIndicator'); // Added
const restartButton = document.getElementById('restartButton');
const pauseButton = document.getElementById('pauseButton');
const crashSound = document.getElementById('crashSound'); // Optional sound
const canvasContainer = document.getElementById('canvas-container'); // Added

// --- Game Constants ---
// Make sizes relative to initial canvas height (400) for scaling
const BASE_CANVAS_HEIGHT = 400;
const HELICOPTER_WIDTH_RATIO = 60 / BASE_CANVAS_HEIGHT;
const HELICOPTER_HEIGHT_RATIO = 25 / BASE_CANVAS_HEIGHT;
const OBSTACLE_WIDTH_RATIO = 70 / BASE_CANVAS_HEIGHT;
const OBSTACLE_GAP_RATIO = 140 / BASE_CANVAS_HEIGHT;
const OBSTACLE_MIN_HEIGHT_RATIO = 40 / BASE_CANVAS_HEIGHT; // Min height of top/bottom part

// Physics - keep these constant regardless of size for consistent feel
const GRAVITY = 0.14;
const LIFT = -0.35;
const MAX_VELOCITY = 6;
const OBSTACLE_SPEED = 3.5; // Speed pixels per frame
const OBSTACLE_FREQUENCY = 100; // Generate obstacle every X frames

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
let helicopterX; // Helicopter's X position, scaled slightly from edge

// --- Assets ---
const helicopterImage = new Image();
const backgroundImage = new Image();
let assetsLoaded = 0;
const totalAssets = 2;

// IMPORTANT: Make sure these paths are correct relative to your HTML file
helicopterImage.src = 'assets/helicopter_icon.png';
backgroundImage.src = 'assets/sky.gif'; // Or use a static image like 'assets/background.png'

// --- Asset Loading ---
function assetLoadError(assetName) {
    console.error(`Failed to load ${assetName}`);
    // Potentially show an error message to the user on the loading screen
    loadingIndicator.innerHTML = `<div>Error loading ${assetName}</div>`;
    // Don't start the game if essential assets fail
}

helicopterImage.onload = assetLoaded;
backgroundImage.onload = assetLoaded;
helicopterImage.onerror = () => assetLoadError('helicopter image');
backgroundImage.onerror = () => assetLoadError('background image');

function assetLoaded() {
    assetsLoaded++;
    console.log(`Asset loaded (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded.");
        // Hide loading indicator ONLY when assets are ready
        loadingIndicator.classList.add('hidden');
        initGame(); // Start game
        // Add resize listener *after* initial setup
        window.addEventListener('resize', debounce(handleResize, 150)); // Debounce resize
    }
}

// --- Debounce Function (for resize) ---
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
    // Get the actual size the canvas is displayed at
    const displayWidth = canvasContainer.clientWidth;
    const displayHeight = canvasContainer.clientHeight;

    // Check if the size actually changed to avoid unnecessary redraws
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

        // Recalculate dynamic sizes based on the new height
        currentHelicopterHeight = canvas.height * HELICOPTER_HEIGHT_RATIO;
        currentHelicopterWidth = canvas.height * HELICOPTER_WIDTH_RATIO; // Keep aspect ratio
        currentObstacleWidth = canvas.height * OBSTACLE_WIDTH_RATIO;
        currentObstacleGap = canvas.height * OBSTACLE_GAP_RATIO;
        currentObstacleMinHeight = canvas.height * OBSTACLE_MIN_HEIGHT_RATIO;
        helicopterX = canvas.width * 0.15; // Position helicopter 15% from left edge

        return true; // Indicate that resize happened
    }
    return false; // Indicate no resize
}

function handleResize() {
    console.log("Resize event detected");
    if (isGameOver) return; // Don't resize during game over screen

    const resized = resizeCanvas();

    if (resized && !isPaused) {
        // If running and resized, redraw immediately to avoid glitches
        // Optional: Could adjust obstacle positions slightly if needed,
        // but usually just redrawing with new dimensions is okay.
        redrawStaticElements();
    } else if (resized && isPaused) {
        // If paused and resized, just redraw the paused state
        drawPauseScreen();
    }
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    // Ensure canvas is sized correctly *before* first draw
    resizeCanvas(); // Set initial dimensions and scaled sizes

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
    pauseButton.disabled = false; // Re-enable button
    pauseButton.classList.remove('paused');

    obstacles = []; // Clear obstacles
    generateObstacle(); // Generate first obstacle
    if(obstacles.length > 0) obstacles[0].x = canvas.width * 0.9; // Start first obstacle closer

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();
}

// --- Game Loop ---
function gameLoop() {
    if (isGameOver) {
        showGameOver();
        return; // Stop loop
    }

    if (isPaused) {
        // If paused, we still need the animation frame to check for unpause
        animationFrameId = requestAnimationFrame(gameLoop);
        return; // Skip updates and drawing
    }

    // 1. Update Game State
    updateHelicopter();
    updateObstacles();
    checkCollisions();

    // 2. Render Game Objects
    // Clear canvas is handled by drawBackground covering everything
    drawBackground();
    drawObstacles();
    drawHelicopter();

    // 3. Increment counters & Update Score Display
    score++;
    frameCount++;
    scoreDisplay.textContent = `Score: ${score}`;

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Update Functions ---
function updateHelicopter() {
    if (isLifting) {
        helicopterVelocityY += LIFT;
    } else {
        helicopterVelocityY += GRAVITY;
    }

    helicopterVelocityY = Math.max(Math.min(helicopterVelocityY, MAX_VELOCITY), -MAX_VELOCITY);
    helicopterY += helicopterVelocityY;

    // Boundary checks (use current canvas height)
    if (helicopterY < 0 || helicopterY + currentHelicopterHeight > canvas.height) {
        gameOver();
    }
}

function updateObstacles() {
    // Generate new obstacles based on frame count
    if (frameCount > 0 && frameCount % OBSTACLE_FREQUENCY === 0) {
        generateObstacle();
    }

    // Move existing obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= OBSTACLE_SPEED;

        // Remove obstacles that have gone off-screen
        if (obstacles[i].x + currentObstacleWidth < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function generateObstacle() {
    // Ensure min height doesn't make gap impossible
    const availableHeight = canvas.height - currentObstacleGap - (2 * currentObstacleMinHeight);
    if (availableHeight < 0) {
        console.warn("Obstacle gap and min height too large for canvas height.");
        // Adjust gap or min height if needed, or skip generation
        return;
    }

    const topHeight = currentObstacleMinHeight + Math.random() * availableHeight;

    obstacles.push({
        x: canvas.width, // Start off-screen right
        topHeight: topHeight,
        bottomY: topHeight + currentObstacleGap
    });
}

// --- Drawing Functions ---
function drawBackground() {
    if (backgroundImage.complete && backgroundImage.naturalWidth !== 0) {
        // Simple stretch draw - covers the whole canvas
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback solid color
        ctx.fillStyle = '#87CEEB'; // Sky blue
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawHelicopter() {
    if (helicopterImage.complete && helicopterImage.naturalWidth !== 0) {
        ctx.drawImage(helicopterImage, helicopterX, helicopterY, currentHelicopterWidth, currentHelicopterHeight);
    } else {
        // Fallback rectangle
        ctx.fillStyle = '#FFA500'; // Orange
        ctx.fillRect(helicopterX, helicopterY, currentHelicopterWidth, currentHelicopterHeight);
    }
}

function drawObstacles() {
    ctx.fillStyle = '#2E8B57'; // SeaGreen
    ctx.strokeStyle = '#1E5E3A'; // Darker green border
    ctx.lineWidth = 2;

    obstacles.forEach(obstacle => {
        // Draw top rectangle
        ctx.fillRect(obstacle.x, 0, currentObstacleWidth, obstacle.topHeight);
        ctx.strokeRect(obstacle.x, 0, currentObstacleWidth, obstacle.topHeight);
        // Draw bottom rectangle
        const bottomHeight = canvas.height - obstacle.bottomY;
        ctx.fillRect(obstacle.x, obstacle.bottomY, currentObstacleWidth, bottomHeight);
        ctx.strokeRect(obstacle.x, obstacle.bottomY, currentObstacleWidth, bottomHeight);
    });
}

function drawPauseScreen() {
    // Redraw the static elements first
    redrawStaticElements();
    // Overlay is handled by CSS class toggle
}

function redrawStaticElements() {
    // Used after resize or when resuming pause
    drawBackground();
    drawObstacles();
    drawHelicopter();
}

// --- Collision Detection ---
function checkCollisions() {
    // Use current dimensions for collision check
    const heliRect = { x: helicopterX, y: helicopterY, width: currentHelicopterWidth, height: currentHelicopterHeight };

    for (const obstacle of obstacles) {
        const topRect = { x: obstacle.x, y: 0, width: currentObstacleWidth, height: obstacle.topHeight };
        const bottomRect = { x: obstacle.x, y: obstacle.bottomY, width: currentObstacleWidth, height: canvas.height - obstacle.bottomY };

        // Basic AABB collision check
        if (rectsOverlap(heliRect, topRect) || rectsOverlap(heliRect, bottomRect)) {
            gameOver();
            return; // Exit check early
        }
    }
    // Boundary check is in updateHelicopter
}

function rectsOverlap(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}


// --- Game State Management ---
function togglePause() {
    if (isGameOver) return;

    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseButton.textContent = 'Resume';
        pauseButton.classList.add('paused');
        // No need to stop the loop, just skip updates/drawing inside it
    } else {
        pauseOverlay.classList.add('hidden');
        pauseButton.textContent = 'Pause';
        pauseButton.classList.remove('paused');
        // Redraw immediately to avoid showing old frame if resize happened while paused
        redrawStaticElements();
        // Game loop will resume updates automatically
    }
}

function gameOver() {
    if (isGameOver) return; // Prevent multiple calls

    isGameOver = true;
    isLifting = false;
    pauseButton.disabled = true; // Disable pause when game over
    if (animationFrameId) {
       // Don't cancel animation frame yet, let the loop call showGameOver()
    }

    if (crashSound) {
        crashSound.currentTime = 0;
        crashSound.play().catch(e => console.error("Error playing sound:", e));
    }

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('helicopterBestScore', bestScore);
        bestScoreDisplay.textContent = `Best: ${bestScore}`;
    }
}

function showGameOver() {
    // This is called by the game loop once isGameOver is true
    cancelAnimationFrame(animationFrameId); // Now stop the loop
    animationFrameId = null; // Clear the ID
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
}


function restartGame() {
    gameOverScreen.classList.add('hidden');
    // No need to hide pause overlay, it should be hidden already
    // Re-initialize game variables and start loop
    initGame();
}

// --- Event Listeners ---
function handleInputStart(event) {
    // Allow interaction only if assets are loaded
     if (assetsLoaded < totalAssets) return;

    if (event.type === 'touchstart') {
        event.preventDefault(); // Prevent screen scrolling on touch
    }

    if (isGameOver && (event.code === 'Space' || event.code === 'Enter' || event.type === 'touchstart' || event.type === 'mousedown')) {
       // If game over, any interaction (except pause button) restarts
       restartGame();
       return; // Don't process as lift/unpause
    }

    if (isPaused) {
        togglePause(); // Unpause on tap/click/space
    } else if (!isGameOver) {
        isLifting = true; // Start lifting if game is running
    }
}

function handleInputEnd(event) {
    if (event.type === 'touchend') {
        event.preventDefault();
    }
    isLifting = false; // Stop lifting on release
}

// Keyboard specific handlers
function handleKeyDown(event) {
    // Allow interaction only if assets are loaded
    if (assetsLoaded < totalAssets) return;

    if (event.code === 'Space') {
        event.preventDefault(); // Prevent scrolling
        handleInputStart(event); // Use common start logic
    } else if (isGameOver && event.code === 'Enter') {
        // Allow Enter specifically for restart when game over
        restartGame();
    } else if (!isGameOver && event.code === 'KeyP') {
        togglePause(); // Toggle pause with 'P' key
    }
}

function handleKeyUp(event) {
    // Allow interaction only if assets are loaded
    if (assetsLoaded < totalAssets) return;

    if (event.code === 'Space') {
        handleInputEnd(event); // Use common end logic
    }
}

// Add listeners
// Use canvas for pointer/touch events for better capture
canvas.addEventListener('touchstart', handleInputStart, { passive: false });
canvas.addEventListener('touchend', handleInputEnd);
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) handleInputStart(e); }); // Left click only
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) handleInputEnd(e); });

// Keyboard on document
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Buttons
restartButton.addEventListener('click', restartGame);
pauseButton.addEventListener('click', togglePause);

// --- Initial Load ---
// Show loading indicator initially (CSS should handle this)
console.log("Script loaded. Waiting for assets...");
// Game starts automatically via assetLoaded callback.
