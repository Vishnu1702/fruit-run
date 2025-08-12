// Game variables and constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Delta time variables for frame-rate independence
let lastTime = 0;
let deltaTime = 0;
const targetFPS = 60;
const fixedTimeStep = 1000 / targetFPS; // 16.67ms for 60 FPS

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let gameSpeed = 2;
let baseGameSpeed = 2;
let score = 0;
let highScore = parseInt(localStorage.getItem('fruitRunHighScore')) || 0;
let frameCount = 0;
let lastMilestone = 0;

// Player object
const player = {
    x: 100,
    y: 300,
    width: 40,
    height: 40,
    velY: 0,
    jumping: false,
    grounded: false,
    currentFruit: 'orange',
    color: '#FFA500',
    // Power-up states
    speedBoostTimer: 0,
    megaJumpTimer: 0,
    floatTimer: 0,
    doubleJumpTimer: 0,
    canDoubleJump: false,
    jumpPower: 18, // Base jump power
    // Animation states
    runCycle: 0,
    armReach: 0,
    eyeBlink: 0
};

// Game objects arrays
let obstacles = [];
let fruits = [];
let particles = [];
let bonusItems = [];

// Fruit types and their properties
const fruitTypes = {
    orange: { emoji: '🍊', color: '#FFA500', points: 50 },
    apple: { emoji: '🍎', color: '#FF0000', points: 60 },
    banana: { emoji: '🍌', color: '#FFFF00', points: 70 },
    grape: { emoji: '🍇', color: '#800080', points: 80 }
};

// Obstacle types
const obstacleTypes = [
    { type: 'stump', emoji: '🌳', width: 30, height: 40, color: '#8B4513' },
    { type: 'rock', emoji: '🗿', width: 35, height: 35, color: '#696969' },
    { type: 'water', emoji: '💧', width: 50, height: 20, color: '#00BFFF' }
];

// Bonus items for random points and speed boosts
const bonusTypes = [
    { type: 'star', emoji: '⭐', points: 100, effect: 'points' },
    { type: 'lightning', emoji: '⚡', points: 25, effect: 'speed', speedMultiplier: 0.5, duration: 180 }, // Temporary speed reduction for easier control
    { type: 'gem', emoji: '💎', points: 150, effect: 'points' },
    { type: 'rocket', emoji: '🚀', points: 50, effect: 'megajump', jumpBoost: 1.5, duration: 300 }, // Mega jump boost
    { type: 'coin', emoji: '🪙', points: 75, effect: 'points' },
    { type: 'feather', emoji: '🪶', points: 30, effect: 'float', floatTime: 120 }, // Floating ability
    { type: 'spring', emoji: '🌀', points: 40, effect: 'doublejump', duration: 240 } // Double jump ability
];

// Audio context for sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Sound generation functions
function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Sound effects
const sounds = {
    jump: () => playSound(400, 0.2),
    collect: () => {
        playSound(600, 0.1);
        setTimeout(() => playSound(800, 0.1), 50);
    },
    transform: () => {
        playSound(300, 0.1);
        setTimeout(() => playSound(500, 0.1), 50);
        setTimeout(() => playSound(700, 0.1), 100);
    },
    hit: () => {
        playSound(150, 0.5, 'sawtooth');
    },
    bonus: () => {
        playSound(800, 0.1);
        setTimeout(() => playSound(1000, 0.1), 50);
        setTimeout(() => playSound(1200, 0.1), 100);
    }
};

// Initialize game
function init() {
    // Ensure high score is properly loaded as a number
    highScore = parseInt(localStorage.getItem('fruitRunHighScore')) || 0;
    document.getElementById('high-score').textContent = highScore;

    // Make canvas responsive
    const canvas = document.getElementById('gameCanvas');

    // Better responsive canvas sizing
    const maxWidth = Math.min(window.innerWidth * 0.9, 800);
    const maxHeight = Math.min(window.innerHeight * 0.6, 400);

    // Minimum dimensions for gameplay
    canvas.width = Math.max(maxWidth, 320);
    canvas.height = Math.max(maxHeight, 240);

    // Event listeners
    document.addEventListener('keydown', handleInput);
    document.addEventListener('click', handleInput);
    document.addEventListener('touchstart', handleInput);
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('retry-button').addEventListener('click', startGame);
    document.getElementById('reset-high-score').addEventListener('click', resetHighScore);

    // Handle window resize
    window.addEventListener('resize', handleResize);

    gameLoop();
}

// Handle window resize
function handleResize() {
    const canvas = document.getElementById('gameCanvas');

    // Better responsive canvas sizing
    const maxWidth = Math.min(window.innerWidth * 0.9, 800);
    const maxHeight = Math.min(window.innerHeight * 0.6, 400);

    // Minimum dimensions for gameplay
    canvas.width = Math.max(maxWidth, 320);
    canvas.height = Math.max(maxHeight, 240);
}

// Handle input
function handleInput(e) {
    if (gameState === 'playing') {
        if (e.type === 'keydown' && e.code === 'Space' ||
            e.type === 'click' ||
            e.type === 'touchstart') {
            e.preventDefault();
            jump();
        }
    }
}

// Player jump
function jump() {
    // Calculate jump power based on active power-ups
    let jumpPower = player.jumpPower;
    if (player.megaJumpTimer > 0) {
        jumpPower *= 1.5; // 50% more jump power
    }

    if (player.grounded) {
        player.velY = -jumpPower;
        player.jumping = true;
        player.grounded = false;
        player.canDoubleJump = player.doubleJumpTimer > 0; // Enable double jump if power-up is active
        sounds.jump();
    } else if (player.canDoubleJump && !player.grounded) {
        // Double jump
        player.velY = -jumpPower * 0.8; // Slightly less powerful second jump
        player.canDoubleJump = false;
        sounds.jump();
        // Create visual effect for double jump
        createParticles(player.x + player.width / 2, player.y + player.height / 2, '#00FFFF');
    }
}

// Start game
function startGame() {
    gameState = 'playing';
    score = 0;
    gameSpeed = baseGameSpeed;
    frameCount = 0;
    lastMilestone = 0;

    // Reset player position based on canvas size
    const canvas = document.getElementById('gameCanvas');
    const groundY = canvas.height - 100; // Ground is 100px from bottom

    player.x = 100;
    player.y = groundY;
    player.velY = 0;
    player.jumping = false;
    player.grounded = true;
    player.currentFruit = 'orange';
    player.color = fruitTypes.orange.color;
    player.speedBoostTimer = 0;
    player.megaJumpTimer = 0;
    player.floatTimer = 0;
    player.doubleJumpTimer = 0;
    player.canDoubleJump = false;
    player.jumpPower = 18;
    player.runCycle = 0;
    player.armReach = 0;
    player.eyeBlink = 0;

    // Clear arrays
    obstacles = [];
    fruits = [];
    particles = [];
    bonusItems = [];

    // Hide UI screens
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

// Game over
function gameOver() {
    gameState = 'gameOver';

    // Update high score - ensure we're working with numbers
    const currentHighScore = parseInt(localStorage.getItem('fruitRunHighScore')) || 0;
    let isNewRecord = false;

    if (score > currentHighScore) {
        highScore = score;
        localStorage.setItem('fruitRunHighScore', highScore.toString());
        document.getElementById('high-score').textContent = highScore;
        document.getElementById('new-record').classList.remove('hidden');
        isNewRecord = true;
    } else {
        document.getElementById('new-record').classList.add('hidden');
    }

    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
    sounds.hit();

    // Show celebration message for new high score after a delay
    if (isNewRecord) {
        setTimeout(() => {
            showCelebrationMessage();
        }, 1000);
    }
}

// Show celebration message for new high score
function showCelebrationMessage() {
    const celebrationDiv = document.createElement('div');
    celebrationDiv.className = 'celebration-message';
    celebrationDiv.innerHTML = `
        <div class="celebration-content">
            <h2>🎉 AMAZING! 🎉</h2>
            <p>NEW HIGH SCORE: ${highScore}</p>
            <p>🏆 You're a Fruit Running Champion! 🏆</p>
        </div>
    `;

    document.body.appendChild(celebrationDiv);

    // Remove celebration after 3 seconds
    setTimeout(() => {
        if (celebrationDiv.parentNode) {
            celebrationDiv.parentNode.removeChild(celebrationDiv);
        }
    }, 3000);
}

// Update game objects
function update(deltaMultiplier = 1) {
    if (gameState !== 'playing') return;

    frameCount++;

    // Milestone-based speed increases
    checkSpeedMilestones();

    // Gradual speed increase over time (frame-rate independent)
    gameSpeed += 0.0005 * deltaMultiplier; // Apply delta time

    // Update power-up timers (frame-rate independent)
    if (player.speedBoostTimer > 0) {
        player.speedBoostTimer -= deltaMultiplier;
    }
    if (player.megaJumpTimer > 0) {
        player.megaJumpTimer -= deltaMultiplier;
    }
    if (player.floatTimer > 0) {
        player.floatTimer -= deltaMultiplier;
    }
    if (player.doubleJumpTimer > 0) {
        player.doubleJumpTimer -= deltaMultiplier;
    }

    // Update player animations (frame-rate independent)
    if (player.grounded) {
        player.runCycle += 0.3 * deltaMultiplier; // Running animation speed
    }

    // Arm reaching animation when jumping or near fruits
    if (player.jumping || !player.grounded) {
        player.armReach = Math.min(player.armReach + 0.2 * deltaMultiplier, 1);
    } else {
        player.armReach = Math.max(player.armReach - 0.1 * deltaMultiplier, 0);
    }

    // Check if near fruits to extend arms
    let nearFruit = false;
    for (let fruit of fruits) {
        const distance = Math.sqrt(Math.pow(fruit.x - player.x, 2) + Math.pow(fruit.y - player.y, 2));
        if (distance < 80) {
            nearFruit = true;
            break;
        }
    }

    if (nearFruit && !player.grounded) {
        player.armReach = Math.min(player.armReach + 0.3 * deltaMultiplier, 1);
    }

    // Eye blinking animation (frame-rate independent)
    player.eyeBlink += 0.1 * deltaMultiplier;
    if (player.eyeBlink > Math.PI * 2) {
        player.eyeBlink = 0;
    }

    // Update player physics (frame-rate independent)
    let gravity = 0.6 * deltaMultiplier; // Base gravity

    // Floating power-up reduces gravity significantly
    if (player.floatTimer > 0) {
        gravity = 0.2 * deltaMultiplier;
    }

    player.velY += gravity;
    player.y += player.velY * deltaMultiplier;

    // Ground collision - make it responsive to canvas height
    const canvas = document.getElementById('gameCanvas');
    const groundY = canvas.height - 100;

    // Top boundary check to prevent player from going off-screen during jumps
    const topBoundary = 20; // Minimum distance from top of canvas
    if (player.y < topBoundary) {
        player.y = topBoundary;
        player.velY = Math.max(player.velY, 0); // Stop upward movement
    }

    if (player.y >= groundY) {
        player.y = groundY;
        player.velY = 0;
        player.grounded = true;
        player.jumping = false;
        if (player.doubleJumpTimer > 0) {
            player.canDoubleJump = true; // Reset double jump when landing
        }
    }

    // Spawn obstacles (progressive difficulty - start easier)
    const obstacleLevel = Math.floor(score / 500) + 1;
    let obstacleFrequency;

    if (obstacleLevel === 1) {
        obstacleFrequency = 180; // Very easy start - spawn every 3 seconds
    } else if (obstacleLevel === 2) {
        obstacleFrequency = 150; // Still easy - spawn every 2.5 seconds
    } else if (obstacleLevel === 3) {
        obstacleFrequency = 120; // Medium difficulty - spawn every 2 seconds
    } else if (obstacleLevel <= 5) {
        obstacleFrequency = 100; // Getting harder
    } else {
        // Dynamic frequency based on game speed for higher levels
        obstacleFrequency = Math.max(60, 120 - Math.floor(gameSpeed * 10));
    }

    if (frameCount % obstacleFrequency === 0) {
        spawnObstacle();
    }

    // Spawn fruits
    if (frameCount % 180 === 0) {
        spawnFruit();
    }

    // Spawn bonus items
    if (frameCount % 300 === 0 && Math.random() < 0.7) {
        spawnBonusItem();
    }

    // Update obstacles
    updateObstacles();

    // Update fruits
    updateFruits();

    // Update bonus items
    updateBonusItems();

    // Update particles
    updateParticles();

    // Update score for surviving
    if (frameCount % 30 === 0) {
        score += 10;
    }

    // Update UI
    const currentLevel = Math.floor(score / 500) + 1;
    document.getElementById('current-level').textContent = currentLevel;
    document.getElementById('current-score').textContent = score;
    document.getElementById('speed-display').textContent = gameSpeed.toFixed(1) + 'x';

    // Update power-up display
    updatePowerUpDisplay();
}

// Spawn obstacle
function spawnObstacle() {
    const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const groundY = canvas.height - 100;

    obstacles.push({
        x: canvas.width,
        y: obstacleType.type === 'water' ? groundY + 20 : groundY - obstacleType.height,
        width: obstacleType.width,
        height: obstacleType.height,
        type: obstacleType.type,
        emoji: obstacleType.emoji,
        color: obstacleType.color
    });
}

// Spawn fruit
function spawnFruit() {
    const fruitNames = Object.keys(fruitTypes);
    const randomFruit = fruitNames[Math.floor(Math.random() * fruitNames.length)];
    const fruit = fruitTypes[randomFruit];

    // Make fruit spawning relative to canvas height
    const minY = canvas.height * 0.2; // 20% from top
    const maxY = canvas.height * 0.6; // 60% from top

    fruits.push({
        x: canvas.width,
        y: minY + Math.random() * (maxY - minY), // Spawn fruits at various heights
        width: 30,
        height: 30,
        type: randomFruit,
        emoji: fruit.emoji,
        color: fruit.color,
        points: fruit.points,
        bobOffset: Math.random() * Math.PI * 2
    });
}

// Spawn bonus item
function spawnBonusItem() {
    const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];

    // Make bonus item spawning relative to canvas height
    const minY = canvas.height * 0.15; // 15% from top
    const maxY = canvas.height * 0.5;  // 50% from top

    bonusItems.push({
        x: canvas.width,
        y: minY + Math.random() * (maxY - minY),
        width: 25,
        height: 25,
        type: bonusType.type,
        emoji: bonusType.emoji,
        points: bonusType.points,
        effect: bonusType.effect,
        sparkle: 0
    });
}

// Update obstacles
function updateObstacles() {
    // Calculate current speed including power-ups (frame-rate independent)
    let currentSpeed = gameSpeed * deltaTime / fixedTimeStep;
    if (player.speedBoostTimer > 0) {
        currentSpeed *= 0.5; // Slow down obstacles when speed boost is active
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= currentSpeed;

        // Check collision with player
        if (checkCollision(player, obstacle)) {
            gameOver();
            return;
        }

        // Remove off-screen obstacles
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

// Update fruits
function updateFruits() {
    // Calculate current speed including power-ups (frame-rate independent)
    let currentSpeed = gameSpeed * deltaTime / fixedTimeStep;
    if (player.speedBoostTimer > 0) {
        currentSpeed *= 0.5;
    }

    for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        fruit.x -= currentSpeed;
        fruit.bobOffset += 0.1 * deltaTime / fixedTimeStep; // Frame-rate independent bobbing

        // Check collision with player
        if (checkCollision(player, fruit)) {
            // Collect fruit
            score += fruit.points;

            // Transform player if different fruit
            if (player.currentFruit !== fruit.type) {
                player.currentFruit = fruit.type;
                player.color = fruit.color;
                sounds.transform();
                createParticles(fruit.x, fruit.y, fruit.color);
            } else {
                sounds.collect();
            }

            fruits.splice(i, 1);
            continue;
        }

        // Remove off-screen fruits
        if (fruit.x + fruit.width < 0) {
            fruits.splice(i, 1);
        }
    }
}

// Update bonus items
function updateBonusItems() {
    // Calculate current speed including power-ups (frame-rate independent)
    let currentSpeed = gameSpeed * deltaTime / fixedTimeStep;
    if (player.speedBoostTimer > 0) {
        currentSpeed *= 0.5;
    }

    for (let i = bonusItems.length - 1; i >= 0; i--) {
        const bonus = bonusItems[i];
        bonus.x -= currentSpeed;
        bonus.sparkle += 0.2 * deltaTime / fixedTimeStep; // Frame-rate independent sparkle

        // Check collision with player
        if (checkCollision(player, bonus)) {
            score += bonus.points;

            // Apply bonus effects
            if (bonus.effect === 'speed') {
                player.speedBoostTimer = bonus.duration;
                createParticles(bonus.x, bonus.y, '#00FFFF');
            } else if (bonus.effect === 'megajump') {
                player.megaJumpTimer = bonus.duration;
                createParticles(bonus.x, bonus.y, '#FF4500');
            } else if (bonus.effect === 'float') {
                player.floatTimer = bonus.floatTime;
                createParticles(bonus.x, bonus.y, '#E6E6FA');
            } else if (bonus.effect === 'doublejump') {
                player.doubleJumpTimer = bonus.duration;
                player.canDoubleJump = true;
                createParticles(bonus.x, bonus.y, '#00FF00');
            } else {
                createParticles(bonus.x, bonus.y, '#FFD700');
            }

            sounds.bonus();
            bonusItems.splice(i, 1);
            continue;
        }

        // Remove off-screen bonus items
        if (bonus.x + bonus.width < 0) {
            bonusItems.splice(i, 1);
        }
    }
}

// Update particles
function updateParticles() {
    const frameMultiplier = deltaTime / fixedTimeStep;

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.velX * frameMultiplier;
        particle.y += particle.velY * frameMultiplier;
        particle.velY += 0.2 * frameMultiplier;
        particle.life--;
        particle.alpha = particle.life / particle.maxLife;

        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Create particles
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            velX: (Math.random() - 0.5) * 6,
            velY: (Math.random() - 0.5) * 6 - 2,
            life: 30,
            maxLife: 30,
            color: color,
            alpha: 1
        });
    }
}

// Update power-up display
function updatePowerUpDisplay() {
    let powerUpText = '';

    if (player.speedBoostTimer > 0) {
        powerUpText += '⚡ Slow Motion ';
    }
    if (player.megaJumpTimer > 0) {
        powerUpText += '🚀 Mega Jump ';
    }
    if (player.floatTimer > 0) {
        powerUpText += '🪶 Float ';
    }
    if (player.doubleJumpTimer > 0) {
        powerUpText += '🌀 Double Jump ';
    }

    // Update power-up indicator (you'll need to add this element to HTML)
    const powerUpElement = document.getElementById('power-up-display');
    if (powerUpElement) {
        powerUpElement.textContent = powerUpText;
        powerUpElement.style.display = powerUpText ? 'block' : 'none';
    }
}

// Check for level completions (every 500 points = 1 level)
function checkSpeedMilestones() {
    const currentLevel = Math.floor(score / 500);
    const lastLevel = Math.floor(lastMilestone / 500);

    if (currentLevel > lastLevel && currentLevel > 0) {
        const levelScore = currentLevel * 500;
        lastMilestone = levelScore;

        // Progressive speed increase: each level adds more speed
        const speedIncrease = 0.4 + (currentLevel * 0.15);
        gameSpeed = baseGameSpeed + speedIncrease;

        // Visual feedback for level completion
        showLevelMessage(currentLevel, speedIncrease);
        createSpeedBoostEffect();
        sounds.bonus();
    }
}

// Show level completion message using popup overlay
function showLevelMessage(level, speedIncrease) {
    const popup = document.getElementById('popup-message');
    const popupText = document.getElementById('popup-text');

    // Set the message content
    popupText.innerHTML = `
        🎯 LEVEL ${level} COMPLETED! 🎯<br>
        <small style="font-size: 16px; margin-top: 5px; display: block;">
            ${level * 500} Points • Speed: ${(baseGameSpeed + speedIncrease).toFixed(1)}x
        </small>
    `;

    // Show the popup
    popup.classList.remove('hidden');

    // Hide the popup after a short time (reduced from 1500ms to 1000ms)
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 1000);
}

// Create visual effect for speed boost
function createSpeedBoostEffect() {
    // Create multiple particles around the player for speed boost effect
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            velX: (Math.random() - 0.5) * 12,
            velY: (Math.random() - 0.5) * 12,
            life: 60,
            maxLife: 60,
            color: '#FFD700',
            alpha: 1
        });
    }
}

// Reset high score function
function resetHighScore() {
    if (confirm('Are you sure you want to reset the high score?')) {
        localStorage.removeItem('fruitRunHighScore');
        highScore = 0;
        document.getElementById('high-score').textContent = highScore;
        alert('High score has been reset!');
    }
}

// Collision detection with smaller bounds for better gameplay
function checkCollision(rect1, rect2) {
    // Make player collision bounds slightly smaller for more forgiving gameplay
    const player1 = {
        x: rect1.x + 2,
        y: rect1.y + 2,
        width: rect1.width - 4,
        height: rect1.height - 4
    };

    return player1.x < rect2.x + rect2.width &&
        player1.x + player1.width > rect2.x &&
        player1.y < rect2.y + rect2.height &&
        player1.y + player1.height > rect2.y;
}

// Render game
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState !== 'playing') return;

    // Draw ground line - make it responsive to canvas height
    const groundLineY = canvas.height - 60;
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundLineY);
    ctx.lineTo(canvas.width, groundLineY);
    ctx.stroke();

    // Draw player
    drawPlayer();

    // Draw obstacles
    obstacles.forEach(drawObstacle);

    // Draw fruits
    fruits.forEach(drawFruit);

    // Draw bonus items
    bonusItems.forEach(drawBonusItem);

    // Draw particles
    particles.forEach(drawParticle);
}

// Draw player
function drawPlayer() {
    const fruit = fruitTypes[player.currentFruit];
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;

    // Player shadow - make it responsive to canvas height
    const shadowY = canvas.height - 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, shadowY, player.width / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Power-up visual effects
    if (player.megaJumpTimer > 0) {
        ctx.shadowColor = '#FF4500';
        ctx.shadowBlur = 20;
    } else if (player.floatTimer > 0) {
        ctx.shadowColor = '#E6E6FA';
        ctx.shadowBlur = 15;
    } else if (player.doubleJumpTimer > 0) {
        ctx.shadowColor = '#00FF00';
        ctx.shadowBlur = 12;
    } else if (player.speedBoostTimer > 0) {
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 18;
    }

    // Draw arms (stick figure style)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (player.grounded) {
        // Running arms animation
        const armSwing = Math.sin(player.runCycle) * 0.4;

        // Left arm
        ctx.beginPath();
        ctx.moveTo(centerX - 12, centerY - 2);
        ctx.lineTo(centerX - 18 + armSwing * 8, centerY + 8 - armSwing * 12);
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(centerX + 12, centerY - 2);
        ctx.lineTo(centerX + 18 - armSwing * 8, centerY + 8 + armSwing * 12);
        ctx.stroke();
    } else {
        // Jumping/reaching arms
        const reachExtension = player.armReach * 12;
        const reachHeight = player.armReach * 8;

        // Left arm reaching up
        ctx.beginPath();
        ctx.moveTo(centerX - 12, centerY - 2);
        ctx.lineTo(centerX - 20 - reachExtension, centerY - 12 - reachHeight);
        ctx.stroke();

        // Right arm reaching up
        ctx.beginPath();
        ctx.moveTo(centerX + 12, centerY - 2);
        ctx.lineTo(centerX + 20 + reachExtension, centerY - 12 - reachHeight);
        ctx.stroke();

        // Draw hands when reaching
        if (player.armReach > 0.5) {
            ctx.fillStyle = '#FDBCB4';

            // Left hand
            ctx.beginPath();
            ctx.arc(centerX - 20 - reachExtension, centerY - 12 - reachHeight, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Right hand  
            ctx.beginPath();
            ctx.arc(centerX + 20 + reachExtension, centerY - 12 - reachHeight, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw legs (stick figure style)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;

    if (player.grounded) {
        const legSwing = Math.sin(player.runCycle + Math.PI) * 0.3;

        // Left leg
        ctx.beginPath();
        ctx.moveTo(centerX - 6, centerY + 12);
        ctx.lineTo(centerX - 10 + legSwing * 6, centerY + 20 + legSwing * 4);
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(centerX + 6, centerY + 12);
        ctx.lineTo(centerX + 10 - legSwing * 6, centerY + 20 - legSwing * 4);
        ctx.stroke();
    } else {
        // Jumping legs (tucked up slightly)
        ctx.beginPath();
        ctx.moveTo(centerX - 6, centerY + 12);
        ctx.lineTo(centerX - 12, centerY + 16);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + 6, centerY + 12);
        ctx.lineTo(centerX + 12, centerY + 16);
        ctx.stroke();
    }

    // Draw fruit-specific body shapes
    if (player.currentFruit === 'orange') {
        // Orange: circular with segments
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(centerX, centerY, player.width / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // Orange segments
        ctx.strokeStyle = '#FF8C00';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * (player.width / 2 - 2), centerY + Math.sin(angle) * (player.width / 2 - 2));
            ctx.stroke();
        }
    } else if (player.currentFruit === 'apple') {
        // Apple: heart-ish shape
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(centerX - 5, centerY - 3, player.width / 2 - 5, 0, Math.PI * 2);
        ctx.arc(centerX + 5, centerY - 3, player.width / 2 - 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX - 8, centerY + 2);
        ctx.quadraticCurveTo(centerX, centerY + player.width / 2 + 2, centerX + 8, centerY + 2);
        ctx.fill();

        // Apple stem
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - player.width / 2 + 2);
        ctx.lineTo(centerX - 2, centerY - player.width / 2 - 3);
        ctx.stroke();
    } else if (player.currentFruit === 'banana') {
        // Banana: curved elongated shape
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.ellipse(centerX + 2, centerY - 2, player.width / 2 + 3, player.width / 2 - 5, Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();

        // Banana curve lines
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX - 8 + i * 4, centerY - 8);
            ctx.quadraticCurveTo(centerX + 5 + i * 4, centerY + 2, centerX + 8 + i * 4, centerY + 8);
            ctx.stroke();
        }
    } else if (player.currentFruit === 'grape') {
        // Grape: cluster of small circles arranged more compactly and positioned lower
        ctx.fillStyle = '#800080';
        const grapePositions = [
            { x: 0, y: -2 },      // Top grape moved down
            { x: -5, y: 3 }, { x: 5, y: 3 },     // Second row moved down
            { x: -7, y: 8 }, { x: 0, y: 8 }, { x: 7, y: 8 },     // Third row moved down
            { x: -4, y: 13 }, { x: 4, y: 13 },   // Fourth row moved down
            { x: 0, y: 16 }       // Bottom grape moved down
        ];

        grapePositions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(centerX + pos.x, centerY + pos.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Player border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (player.currentFruit === 'orange') {
        ctx.arc(centerX, centerY, player.width / 2 - 2, 0, Math.PI * 2);
    } else if (player.currentFruit === 'apple') {
        ctx.arc(centerX - 5, centerY - 3, player.width / 2 - 5, 0, Math.PI * 2);
        ctx.moveTo(centerX + 5 + player.width / 2 - 5, centerY - 3);
        ctx.arc(centerX + 5, centerY - 3, player.width / 2 - 5, 0, Math.PI * 2);
        ctx.moveTo(centerX - 8, centerY + 2);
        ctx.quadraticCurveTo(centerX, centerY + player.width / 2 + 2, centerX + 8, centerY + 2);
    } else if (player.currentFruit === 'banana') {
        ctx.ellipse(centerX + 2, centerY - 2, player.width / 2 + 3, player.width / 2 - 5, Math.PI / 8, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Draw face on the fruit
    // Eyes
    const eyeSize = Math.sin(player.eyeBlink * 8) < -0.8 ? 1 : 2.5; // Blinking effect
    ctx.fillStyle = '#000';

    // Left eye
    ctx.beginPath();
    ctx.arc(centerX - 6, centerY - 4, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(centerX + 6, centerY - 4, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (smile)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 3, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
}

// Draw obstacle
function drawObstacle(obstacle) {
    // Obstacle shadow - make it responsive to canvas height
    const shadowY = canvas.height - 58;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(obstacle.x + 2, shadowY, obstacle.width, 8);

    // Obstacle body
    ctx.fillStyle = obstacle.color;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Obstacle border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Draw obstacle emoji
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(obstacle.emoji, obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 6);
}

// Draw fruit
function drawFruit(fruit) {
    const bobY = fruit.y + Math.sin(fruit.bobOffset) * 3;

    // Fruit glow
    ctx.shadowColor = fruit.color;
    ctx.shadowBlur = 10;

    // Fruit body
    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(fruit.x + fruit.width / 2, bobY + fruit.height / 2, fruit.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Fruit border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw fruit emoji
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(fruit.emoji, fruit.x + fruit.width / 2, bobY + fruit.height / 2 + 6);
}

// Draw bonus item
function drawBonusItem(bonus) {
    const sparkleOffset = Math.sin(bonus.sparkle) * 2;

    // Sparkle effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;

    // Bonus body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(bonus.x + bonus.width / 2, bonus.y + bonus.height / 2 + sparkleOffset, bonus.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Bonus border
    ctx.strokeStyle = '#FF6347';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw bonus emoji
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(bonus.emoji, bonus.x + bonus.width / 2, bonus.y + bonus.height / 2 + sparkleOffset + 5);
}

// Draw particle
function drawParticle(particle) {
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// Game loop with delta time for frame-rate independence
function gameLoop(currentTime = 0) {
    // Calculate delta time
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Cap delta time to prevent huge jumps (e.g., when tab becomes inactive)
    deltaTime = Math.min(deltaTime, fixedTimeStep * 3);

    // Normalize delta time to 60 FPS equivalent
    const normalizedDelta = deltaTime / fixedTimeStep;

    update(normalizedDelta);
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    // Enable audio context on first user interaction
    document.addEventListener('click', () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });

    init();
});
