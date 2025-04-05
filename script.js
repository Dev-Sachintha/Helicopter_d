// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const finalScoreDisplay = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOver');
const pauseOverlay = document.getElementById('pauseOverlay');
const restartButton = document.getElementById('restartButton');
const pauseButton = document.getElementById('pauseButton');
const crashSound = document.getElementById('crashSound'); // Optional sound

// --- Game Constants ---
const HELICOPTER_WIDTH = 60; // Adjusted size slightly
const HELICOPTER_HEIGHT = 25; // Adjusted size slightly
const GRAVITY = 0.14;
const LIFT = -0.35;
const MAX_VELOCITY = 6; // Max fall/rise speed
const OBSTACLE_WIDTH = 70;
const OBSTACLE_GAP = 140;
const OBSTACLE_SPEED = 3.5;
const OBSTACLE_FREQUENCY = 100; // Obstacles appear slightly more often

// --- Game State Variables ---
let helicopterY;
let helicopterVelocityY;
let obstacles;
let score;
let bestScore = 0;
let frameCount;
let isGameOver;
let isPaused; // Added pause state
let isLifting;
let animationFrameId;

// --- Assets ---
const helicopterImage = new Image();
const backgroundImage = new Image(); // Added background image object
let assetsLoaded = 0;
const totalAssets = 2; // Number of images to load

helicopterImage.src = 'assets/helicopter.png'; // Make sure this path is correct
backgroundImage.src = 'assets/sky.gif';       // Make sure this path is correct

helicopterImage.onload = assetLoaded;
backgroundImage.onload = assetLoaded;

helicopterImage.onerror = () => {
    console.error("Failed to load helicopter image");
    assetLoaded(); // Still count as "loaded" to prevent game stall
};
backgroundImage.onerror = () => {
    console.error("Failed to load background image");
    assetLoaded(); // Still count as "loaded"
};

// --- Asset Loading ---
function assetLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded.");
        initGame(); // Start game only when all assets are ready
    }
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    helicopterY = canvas.height / 2 - HELICOPTER_HEIGHT / 2;
    helicopterVelocityY = 0;
    obstacles = [];
    score = 0;
    frameCount = 0;
    isGameOver = false;
    isPaused = false; // Reset pause state
    isLifting = false;

    // Load Best Score
    bestScore = localStorage.getItem('helicopterBestScore') || 0;
    bestScoreDisplay.textContent = `Best: ${bestScore}`;

    scoreDisplay.textContent = `Score: 0`;
    gameOverScreen.classList.add('hidden');
    pauseOverlay.classList.add('hidden'); // Hide pause overlay
    pauseButton.textContent = 'Pause';    // Reset pause button text
    pauseButton.classList.remove('paused'); // Reset pause button style

    // Ensure the first obstacle appears reasonably soon
    // clear existing obstacles before adding the first one
    obstacles = [];
    generateObstacle();
    // Move first obstacle slightly closer initially for faster engagement
    if(obstacles.length > 0) obstacles[0].x = canvas.width * 0.8;

    // Cancel any previous loop before starting a new one
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop(); // Start the game loop
}

// --- Game Loop ---
function gameLoop() {
    if (isGameOver) {
        showGameOver();
        return; // Stop the loop if game is over
    }

    // Handle Pause
    if (isPaused) {
        drawPauseScreen(); // Keep drawing pause screen
        animationFrameId = requestAnimationFrame(gameLoop); // Keep looping to check for unpause
        return; // Skip game updates and drawing if paused
    }

    // 1. Clear Canvas (or draw background)
    // Clear is needed if background has transparency or doesn't cover full canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(); // Draw background image first

    // 2. Update Game State
    updateHelicopter();
    updateObstacles();
    checkCollisions();

    // 3. Render Game Objects
    drawObstacles(); // Draw obstacles behind helicopter
    drawHelicopter();
    // Score is updated via HTML element now

    // 4. Increment counters & Update Score Display
    score++;
    frameCount++;
    scoreDisplay.textContent = `Score: ${score}`; // Update score display

    // Request the next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Update Functions ---
function updateHelicopter() {
    if (isLifting) {
        helicopterVelocityY += LIFT;
    } else {
        helicopterVelocityY += GRAVITY;
    }

    // Clamp velocity
    helicopterVelocityY = Math.max(Math.min(helicopterVelocityY, MAX_VELOCITY), -MAX_VELOCITY);

    helicopterY += helicopterVelocityY;

    // Boundary checks (Game Over condition)
    if (helicopterY < 0 || helicopterY + HELICOPTER_HEIGHT > canvas.height) {
        gameOver();
    }
}

function updateObstacles() {
    // Generate new obstacles
    if (frameCount > 0 && frameCount % OBSTACLE_FREQUENCY === 0) { // Avoid generating at frame 0
        generateObstacle();
    }

    // Move existing obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= OBSTACLE_SPEED;

        // Remove obstacles that have gone off-screen
        if (obstacles[i].x + OBSTACLE_WIDTH < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function generateObstacle() {
    const minHeight = 40; // Slightly larger min height
    const maxHeight = canvas.height - OBSTACLE_GAP - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    obstacles.push({
        x: canvas.width,
        topHeight: topHeight,
        bottomY: topHeight + OBSTACLE_GAP
    });
}

// --- Drawing Functions ---
function drawBackground() {
    if (backgroundImage.complete && backgroundImage.naturalWidth !== 0) {
         // Draw background to cover canvas - aspect ratio might stretch/squish if not matched
         ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback solid color if image fails
        ctx.fillStyle = '#87CEEB'; // Sky blue
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawHelicopter() {
    // Use image if loaded, otherwise draw fallback rectangle
    if (helicopterImage.complete && helicopterImage.naturalWidth !== 0) {
        ctx.drawImage(helicopterImage, 50, helicopterY, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    } else {
        ctx.fillStyle = '#FFA500'; // Orange fallback
        ctx.fillRect(50, helicopterY, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    }
}

function drawObstacles() {
    ctx.fillStyle = '#2E8B57'; // SeaGreen for obstacles
    obstacles.forEach(obstacle => {
        // Draw top rectangle
        ctx.fillRect(obstacle.x, 0, OBSTACLE_WIDTH, obstacle.topHeight);
        // Draw bottom rectangle
        ctx.fillRect(obstacle.x, obstacle.bottomY, OBSTACLE_WIDTH, canvas.height - obstacle.bottomY);
         // Optional: Add a border for definition
        ctx.strokeStyle = '#1E5E3A'; // Darker green border
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, 0, OBSTACLE_WIDTH, obstacle.topHeight);
        ctx.strokeRect(obstacle.x, obstacle.bottomY, OBSTACLE_WIDTH, canvas.height - obstacle.bottomY);
    });
}

function drawPauseScreen() {
    // Draw the current game state underneath the overlay
    drawBackground();
    drawObstacles();
    drawHelicopter();
    // No need to explicitly draw overlay - CSS handles it via class 'hidden' toggle
}

// --- Collision Detection ---
function checkCollisions() {
    const helicopterX = 50; // Helicopter's fixed X position
    const heliRect = { x: helicopterX, y: helicopterY, width: HELICOPTER_WIDTH, height: HELICOPTER_HEIGHT };

    obstacles.forEach(obstacle => {
        // Define top and bottom obstacle rectangles
        const topRect = { x: obstacle.x, y: 0, width: OBSTACLE_WIDTH, height: obstacle.topHeight };
        const bottomRect = { x: obstacle.x, y: obstacle.bottomY, width: OBSTACLE_WIDTH, height: canvas.height - obstacle.bottomY };

        // Check collision with top obstacle
        if (
            heliRect.x < topRect.x + topRect.width &&
            heliRect.x + heliRect.width > topRect.x &&
            heliRect.y < topRect.y + topRect.height &&
            heliRect.y + heliRect.height > topRect.y
        ) {
            gameOver();
            return; // Exit check early
        }

        // Check collision with bottom obstacle
        if (
            heliRect.x < bottomRect.x + bottomRect.width &&
            heliRect.x + heliRect.width > bottomRect.x &&
            heliRect.y < bottomRect.y + bottomRect.height &&
            heliRect.y + heliRect.height > bottomRect.y
        ) {
            gameOver();
            return; // Exit check early
        }
    });
    // Boundary check is in updateHelicopter
}

// --- Game State Management ---
function togglePause() {
    if (isGameOver) return; // Don't allow pause if game over

    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseButton.textContent = 'Resume';
        pauseButton.classList.add('paused');
        // Optional: Stop sounds or animations here
    } else {
        pauseOverlay.classList.add('hidden');
        pauseButton.textContent = 'Pause';
        pauseButton.classList.remove('paused');
        // Resume game loop (already happens because we don't return early anymore)
        // Optional: Resume sounds or animations
    }
}

function gameOver() {
    if (isGameOver) return; // Prevent running multiple times

    isGameOver = true;
    isLifting = false; // Stop lifting on game over
    // Optional: Play sound
    if (crashSound) {
        crashSound.currentTime = 0;
        crashSound.play().catch(e => console.error("Error playing sound:", e));
    }

    // Check & Update Best Score
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('helicopterBestScore', bestScore);
        bestScoreDisplay.textContent = `Best: ${bestScore}`;
        console.log(`New Best Score: ${bestScore}`);
    }
    // showGameOver() is called in the next gameLoop iteration
}

function showGameOver() {
    cancelAnimationFrame(animationFrameId); // Stop the loop completely
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    // Hide overlays immediately for responsiveness
    gameOverScreen.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    initGame(); // Re-initialize and start the loop
}

// --- Event Listeners ---
function handleInputStart(event) {
    // Prevent default actions like scrolling on touch
    if (event.type === 'touchstart') {
        event.preventDefault();
    }
    // Start lifting only if the game is running (not paused, not game over)
    if (!isPaused && !isGameOver) {
        isLifting = true;
    }
    // If paused, unpause on tap/click/space
    else if (isPaused) {
         togglePause();
    }
}

function handleInputEnd(event) {
    if (event.type === 'touchend') {
        event.preventDefault();
    }
    // Always set lifting to false on release, regardless of game state
    isLifting = false;
}

function handleKeyDown(event) {
    if (event.code === 'Space') {
         event.preventDefault(); // Prevent space bar from scrolling the page
         handleInputStart(event); // Use the common input start logic
    }
    // Allow restarting with Space or Enter when Game Over screen is shown
    if (isGameOver && (event.code === 'Space' || event.code === 'Enter')) {
        restartGame();
    }
    // Allow toggling pause with 'P' key (optional)
    if (!isGameOver && event.code === 'KeyP') {
        togglePause();
    }
}

function handleKeyUp(event) {
    if (event.code === 'Space') {
        handleInputEnd(event); // Use the common input end logic
    }
}

// Add listeners
// Using canvas for touch events is often more reliable
canvas.addEventListener('touchstart', handleInputStart, { passive: false }); // passive: false allows preventDefault
canvas.addEventListener('touchend', handleInputEnd);
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) handleInputStart(e); }); // Only left click
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) handleInputEnd(e); });

// Keyboard listeners on the document
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Button listeners
restartButton.addEventListener('click', restartGame);
pauseButton.addEventListener('click', togglePause);

// --- Initial Load ---
// Loading is handled by assetLoaded function now.
// Do not call initGame() here directly anymore.
console.log("Script loaded. Waiting for assets...");