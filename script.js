const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.style.backgroundColor = "#d0f0c0";

// --- World & Camera ---
const world = { width: window.innerWidth, height: window.innerHeight };
let camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };

// --- Game State ---
let gameOver = false;
let isPlayerInCar = false;
let playerCar = null;

// --- Player Object ---
let ball = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 20,
  speed: 5,
  health: 4,
  invincible: false,
  invincibleTimer: 0,
};

// --- Obstacles ---
let obstacles = Array.from({ length: 50 }, () => ({
  x: Math.random() * world.width,
  y: Math.random() * world.height,
  size: 30 + Math.random() * 40,
}));

// --- Cars ---
// We'll add drift parameters and approximate collisions using a bounding circle.
let cars = Array.from({ length: 3 }, () => {
  const width = 60;
  const height = 30;
  return {
    x: Math.random() * (world.width - 100),
    y: Math.random() * (world.height - 100),
    width,
    height,
    angle: 0,
    vx: 0,
    vy: 0,
    maxSpeed: 7,
    turnSpeed: 0.04,
    forwardAccel: 0.2,
    backwardAccel: 0.15,
    forwardFriction: 0.98, // friction along facing direction
    driftFriction: 0.9, // friction for sideways velocity
    // bounding circle radius ~ half the diagonal
    radius: Math.hypot(width / 2, height / 2),
  };
});

// --- Enemies ---
let enemies = [];
for (let i = 0; i < 3; i++) {
  let enemy;
  do {
    enemy = {
      x: Math.random() * world.width,
      y: Math.random() * world.height,
      radius: 20,
      hp: 100,
      speed: 1.5 + Math.random() * 1.5,
      flank: Math.random() < 0.5,
      flankDirection: Math.random() < 0.5 ? 1 : -1,
    };
  } while (
    checkCollision(enemy.x, enemy.y, enemy.radius) ||
    Math.hypot(enemy.x - ball.x, enemy.y - ball.y) <
      ball.radius + enemy.radius + 20
  );
  enemies.push(enemy);
}

function respawnEnemy(enemy) {
  do {
    enemy.x = Math.random() * world.width;
    enemy.y = Math.random() * world.height;
  } while (
    checkCollision(enemy.x, enemy.y, enemy.radius) ||
    Math.hypot(enemy.x - ball.x, enemy.y - ball.y) <
      ball.radius + enemy.radius + 20
  );
  enemy.hp = 100;
  enemy.flank = Math.random() < 0.5;
  enemy.flankDirection = Math.random() < 0.5 ? 1 : -1;
}

// --- Bullets ---
let bullets = [];

// --- Input Handling ---
let keys = {};
window.addEventListener("keydown", (event) => {
  keys[event.key] = true;
  if (event.key === "e") {
    handleCarEnterExit();
  }
});
window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

// Mouse for aiming
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
canvas.addEventListener("mousemove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});
canvas.addEventListener("mousedown", (event) => {
  let originX = isPlayerInCar ? playerCar.x : ball.x;
  let originY = isPlayerInCar ? playerCar.y : ball.y;

  // If in car, roughly shoot from its front center
  if (isPlayerInCar) {
    // shift bullet start to the "front" of the car
    const frontOffset = playerCar.width * 0.5;
    originX += Math.cos(playerCar.angle) * frontOffset;
    originY += Math.sin(playerCar.angle) * frontOffset;
  }

  let angle = Math.atan2(
    event.clientY + camera.y - originY,
    event.clientX + camera.x - originX
  );
  bullets.push({
    x: originX,
    y: originY,
    radius: 5,
    speed: 7,
    dx: Math.cos(angle) * 7,
    dy: Math.sin(angle) * 7,
  });
});

// --- Restart Button ---
const restartButton = document.createElement("button");
restartButton.textContent = "Restart";
restartButton.classList.add("restart-button");
document.body.appendChild(restartButton);
restartButton.addEventListener("click", resetGame);

function resetGame() {
  // Reset player
  ball.x = world.width / 2;
  ball.y = world.height / 2;
  ball.health = 4;
  ball.invincible = false;
  ball.invincibleTimer = 0;
  isPlayerInCar = false;
  playerCar = null;

  // Respawn enemies
  enemies = [];
  for (let i = 0; i < 3; i++) {
    let enemy;
    do {
      enemy = {
        x: Math.random() * world.width,
        y: Math.random() * world.height,
        radius: 20,
        hp: 100,
        speed: 1.5 + Math.random() * 1.5,
        flank: Math.random() < 0.5,
        flankDirection: Math.random() < 0.5 ? 1 : -1,
      };
    } while (
      checkCollision(enemy.x, enemy.y, enemy.radius) ||
      Math.hypot(enemy.x - ball.x, enemy.y - ball.y) <
        ball.radius + enemy.radius + 20
    );
    enemies.push(enemy);
  }
  bullets = [];
  gameOver = false;
  restartButton.style.display = "none";

  // Respawn cars
  cars = Array.from({ length: 3 }, () => {
    const width = 60;
    const height = 30;
    return {
      x: Math.random() * (world.width - 100),
      y: Math.random() * (world.height - 100),
      width,
      height,
      angle: 0,
      vx: 0,
      vy: 0,
      maxSpeed: 7,
      turnSpeed: 0.04,
      forwardAccel: 0.2,
      backwardAccel: 0.15,
      forwardFriction: 0.98,
      driftFriction: 0.9,
      radius: Math.hypot(width / 2, height / 2),
    };
  });
}

// --- Collisions ---

function checkCollision(x, y, radius) {
  // Circle vs. AABB for obstacles
  return obstacles.some(
    (obstacle) =>
      x + radius > obstacle.x &&
      x - radius < obstacle.x + obstacle.size &&
      y + radius > obstacle.y &&
      y - radius < obstacle.y + obstacle.size
  );
}

function checkEnemyCollision(x, y, radius, currentEnemy) {
  for (let enemy of enemies) {
    if (enemy === currentEnemy) continue;
    let dx = x - enemy.x;
    let dy = y - enemy.y;
    if (Math.hypot(dx, dy) < radius + enemy.radius) return true;
  }
  return false;
}

// Car vs. obstacles collision (circle vs. AABB).
function checkCarObstacleCollision(carX, carY, carRadius) {
  // Return true if there's a collision
  for (let obs of obstacles) {
    // AABB (obstacle) vs. circle (car)
    const nearestX = Math.max(obs.x, Math.min(carX, obs.x + obs.size));
    const nearestY = Math.max(obs.y, Math.min(carY, obs.y + obs.size));
    const dx = carX - nearestX;
    const dy = carY - nearestY;
    if (dx * dx + dy * dy < carRadius * carRadius) {
      return true;
    }
  }
  // Also check world boundaries
  if (
    carX - carRadius < 0 ||
    carX + carRadius > world.width ||
    carY - carRadius < 0 ||
    carY + carRadius > world.height
  ) {
    return true;
  }
  return false;
}

// --- Enter/Exit Car ---
function handleCarEnterExit() {
  if (!isPlayerInCar) {
    // Attempt to enter if close
    for (let car of cars) {
      let dx = car.x - ball.x;
      let dy = car.y - ball.y;
      let dist = Math.hypot(dx, dy);
      // If the player is close enough to the car center
      if (dist < 50) {
        isPlayerInCar = true;
        playerCar = car;
        break;
      }
    }
  } else {
    // Exit
    isPlayerInCar = false;
    // Place ball where car is
    if (playerCar) {
      ball.x = playerCar.x;
      ball.y = playerCar.y;
    }
    playerCar = null;
  }
}

// --- Update Cars with Drifting ---
function updateCars() {
  for (let car of cars) {
    if (car === playerCar && isPlayerInCar) {
      // Player controls
      let forward = 0;
      if (keys["w"]) forward += car.forwardAccel;
      if (keys["s"]) forward -= car.backwardAccel;

      // Add forward acceleration to vx, vy
      const cosA = Math.cos(car.angle);
      const sinA = Math.sin(car.angle);
      car.vx += cosA * forward;
      car.vy += sinA * forward;

      // Turning
      // Turn more if speed is higher
      if (keys["a"]) {
        car.angle -= car.turnSpeed * Math.sign(forward || 1);
      }
      if (keys["d"]) {
        car.angle += car.turnSpeed * Math.sign(forward || 1);
      }
    }

    // Break down velocity into forward vs. side
    // Forward axis is (cosA, sinA), side axis is (-sinA, cosA)
    const cosA = Math.cos(car.angle);
    const sinA = Math.sin(car.angle);
    let fwdSpeed = car.vx * cosA + car.vy * sinA; // dot product with forward
    let sideSpeed = car.vx * -sinA + car.vy * cosA; // dot product with perpendicular

    // Apply friction differently
    fwdSpeed *= car.forwardFriction;
    sideSpeed *= car.driftFriction;

    // Recompute vx, vy from updated fwdSpeed, sideSpeed
    car.vx = fwdSpeed * cosA + sideSpeed * -sinA;
    car.vy = fwdSpeed * sinA + sideSpeed * cosA;

    // Limit overall speed
    let speedMag = Math.hypot(car.vx, car.vy);
    if (speedMag > car.maxSpeed) {
      car.vx = (car.vx / speedMag) * car.maxSpeed;
      car.vy = (car.vy / speedMag) * car.maxSpeed;
    }

    // Proposed new position
    let nextX = car.x + car.vx;
    let nextY = car.y + car.vy;

    // Check obstacles
    if (!checkCarObstacleCollision(nextX, nextY, car.radius)) {
      // Safe to move
      car.x = nextX;
      car.y = nextY;
    } else {
      // Collision: zero out velocity or partially handle
      car.vx = 0;
      car.vy = 0;
    }
  }
}

// --- Pushing Enemies & Dealing Damage ---
function carEnemyInteraction() {
  // If car is moving quickly, push enemies aside & deal them damage
  for (let car of cars) {
    let carSpeed = Math.hypot(car.vx, car.vy);
    if (carSpeed < 0.1) continue; // not moving enough to push

    for (let enemy of enemies) {
      let dx = enemy.x - car.x;
      let dy = enemy.y - car.y;
      let dist = Math.hypot(dx, dy);
      let minDist = enemy.radius + car.radius;
      if (dist < minDist) {
        // Overlapping
        // push enemy out
        let overlap = minDist - dist;
        let nx = dx / dist;
        let ny = dy / dist;
        enemy.x += nx * overlap;
        enemy.y += ny * overlap;

        // damage scales with speed
        let damage = carSpeed * 5;
        enemy.hp -= damage;
        if (enemy.hp <= 0) {
          respawnEnemy(enemy);
        }
      }
    }
  }
}

// --- Update ---
function update(delta) {
  if (gameOver) return;

  // Player (on foot) movement
  if (!isPlayerInCar) {
    let nextX = ball.x;
    let nextY = ball.y;
    if (keys["w"]) nextY -= ball.speed;
    if (keys["s"]) nextY += ball.speed;
    if (keys["a"]) nextX -= ball.speed;
    if (keys["d"]) nextX += ball.speed;

    if (!checkCollision(nextX, ball.y, ball.radius)) ball.x = nextX;
    if (!checkCollision(ball.x, nextY, ball.radius)) ball.y = nextY;

    // Boundaries
    if (ball.x - ball.radius < 0) ball.x = ball.radius;
    if (ball.x + ball.radius > world.width) ball.x = world.width - ball.radius;
    if (ball.y - ball.radius < 0) ball.y = ball.radius;
    if (ball.y + ball.radius > world.height)
      ball.y = world.height - ball.radius;
  }

  // Update cars (drift, friction, collisions)
  updateCars();

  // Car vs. enemy push
  carEnemyInteraction();

  // Enemies chase logic
  enemies.forEach((enemy) => {
    let targetX = isPlayerInCar ? playerCar.x : ball.x;
    let targetY = isPlayerInCar ? playerCar.y : ball.y;
    let chaseX = targetX - enemy.x;
    let chaseY = targetY - enemy.y;
    let chaseDist = Math.hypot(chaseX, chaseY);

    let desiredX, desiredY;
    if (enemy.flank && chaseDist > 0) {
      let nX = chaseX / chaseDist;
      let nY = chaseY / chaseDist;
      let pX = -nY; // perpendicular
      let pY = nX;
      const flankOffset = 150;
      let fX = targetX + enemy.flankDirection * flankOffset * pX;
      let fY = targetY + enemy.flankDirection * flankOffset * pY;
      desiredX = fX - enemy.x;
      desiredY = fY - enemy.y;
    } else {
      desiredX = chaseX;
      desiredY = chaseY;
    }

    // Repulsion from obstacles
    let repulsionX = 0,
      repulsionY = 0;
    obstacles.forEach((obs) => {
      let ox = obs.x + obs.size / 2;
      let oy = obs.y + obs.size / 2;
      let dx = enemy.x - ox;
      let dy = enemy.y - oy;
      let distObs = Math.hypot(dx, dy);
      let threshold = obs.size / 2 + enemy.radius + 10;
      if (distObs < threshold) {
        let strength = (threshold - distObs) / threshold;
        repulsionX += (dx / distObs) * strength;
        repulsionY += (dy / distObs) * strength;
      }
    });

    let combinedX = desiredX + repulsionX * 100;
    let combinedY = desiredY + repulsionY * 100;
    let mag = Math.hypot(combinedX, combinedY);
    if (mag === 0) mag = 0.0001;
    let baseAngle = Math.atan2(combinedY, combinedX);

    let moved = attemptMoveEnemy(
      enemy,
      Math.cos(baseAngle) * enemy.speed,
      Math.sin(baseAngle) * enemy.speed
    );
    if (!moved) {
      const offsets = [
        Math.PI / 12,
        -Math.PI / 12,
        Math.PI / 6,
        -Math.PI / 6,
        Math.PI / 4,
        -Math.PI / 4,
        Math.PI / 3,
        -Math.PI / 3,
        Math.PI / 2,
        -Math.PI / 2,
      ];
      for (let offset of offsets) {
        if (
          attemptMoveEnemy(
            enemy,
            Math.cos(baseAngle + offset) * enemy.speed,
            Math.sin(baseAngle + offset) * enemy.speed
          )
        ) {
          moved = true;
          break;
        }
      }
    }
    if (!moved) {
      let randomAngle = Math.random() * 2 * Math.PI;
      attemptMoveEnemy(
        enemy,
        Math.cos(randomAngle) * enemy.speed,
        Math.sin(randomAngle) * enemy.speed
      );
    }
  });

  // Resolve Player–Enemy overlap if on foot
  if (!isPlayerInCar) {
    enemies.forEach((enemy) => {
      let dx = enemy.x - ball.x;
      let dy = enemy.y - ball.y;
      let dist = Math.hypot(dx, dy);
      let minDist = enemy.radius + ball.radius;
      if (dist < minDist) {
        if (!ball.invincible) {
          ball.health--;
          ball.invincible = true;
          ball.invincibleTimer = 3000;
        }
        let overlap = minDist - dist;
        let nx = dx / dist;
        let ny = dy / dist;
        enemy.x += nx * overlap;
        enemy.y += ny * overlap;
      }
    });
  }

  // Update bullets
  for (let i = 0; i < bullets.length; i++) {
    let b = bullets[i];
    let nx = b.x + b.dx;
    let ny = b.y + b.dy;
    if (checkCollision(nx, ny, b.radius)) {
      bullets.splice(i, 1);
      i--;
      continue;
    }
    b.x = nx;
    b.y = ny;
    if (b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) {
      bullets.splice(i, 1);
      i--;
      continue;
    }
    // Bullets vs. enemies
    for (let j = 0; j < enemies.length; j++) {
      let enemy = enemies[j];
      let dx = b.x - enemy.x;
      let dy = b.y - enemy.y;
      if (Math.hypot(dx, dy) < b.radius + enemy.radius) {
        enemy.hp -= 25;
        bullets.splice(i, 1);
        i--;
        if (enemy.hp <= 0) respawnEnemy(enemy);
        break;
      }
    }
  }

  // Invincibility timer
  if (ball.invincible) {
    ball.invincibleTimer -= delta;
    if (ball.invincibleTimer <= 0) {
      ball.invincible = false;
      ball.invincibleTimer = 0;
    }
  }

  // Camera
  let focusX = isPlayerInCar ? playerCar.x : ball.x;
  let focusY = isPlayerInCar ? playerCar.y : ball.y;
  camera.x = Math.max(
    0,
    Math.min(focusX - canvas.width / 2, world.width - canvas.width)
  );
  camera.y = Math.max(
    0,
    Math.min(focusY - canvas.height / 2, world.height - canvas.height)
  );

  // Check Game Over
  if (ball.health <= 0) {
    gameOver = true;
    restartButton.style.display = "block";
  }
}

// Try moving enemy with (vx, vy)
function attemptMoveEnemy(enemy, vx, vy) {
  let cx = enemy.x + vx;
  let cy = enemy.y + vy;
  if (
    cx - enemy.radius < 0 ||
    cx + enemy.radius > world.width ||
    cy - enemy.radius < 0 ||
    cy + enemy.radius > world.height ||
    checkCollision(cx, cy, enemy.radius) ||
    checkEnemyCollision(cx, cy, enemy.radius, enemy)
  ) {
    return false;
  }
  enemy.x = cx;
  enemy.y = cy;
  return true;
}

// --- Drawing ---

function drawCar(car) {
  ctx.save();
  // Translate to car center
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Car body
  ctx.fillStyle = car === playerCar && isPlayerInCar ? "orange" : "purple";
  // We draw so that (0,0) is the car center; body goes from -width/2..width/2, etc.
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

  // Windshield: a semi-transparent rectangle at the front half
  ctx.fillStyle = "rgba(135,206,250, 0.4)"; // light-blue with some alpha
  // The windshield can be about half of the length on top
  ctx.fillRect(0, -car.height / 2, car.width / 2, car.height);

  // Wheels
  // Let's place 4 wheels: front-left, front-right, rear-left, rear-right.
  // Each wheel is about 8x12. We'll rotate front wheels a bit if steering.
  const wheelWidth = 8;
  const wheelHeight = 12;
  // Offsets from center
  let halfW = car.width / 2;
  let halfH = car.height / 2;

  // front wheels are ± halfH in y, + halfW*0.4 in x
  // back wheels are ± halfH in y, - halfW*0.4 in x
  // but we also rotate the front wheels with steering angle based on sideSpeed or input
  // A simpler approach:
  let steer = 0;
  // If the player is controlling this car, approximate steer from A/D
  if (car === playerCar && isPlayerInCar) {
    if (keys["a"]) steer = -0.5; // turn wheels left
    if (keys["d"]) steer = 0.5; // turn wheels right
  }

  function drawWheel(offsetX, offsetY, rotation = 0) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(rotation);
    ctx.fillStyle = "black";
    ctx.fillRect(-wheelWidth / 2, -wheelHeight / 2, wheelWidth, wheelHeight);
    ctx.restore();
  }

  // front-left wheel
  drawWheel(halfW * 0.4, halfH * 0.6, steer);
  // front-right wheel
  drawWheel(halfW * 0.4, -halfH * 0.6, steer);
  // rear-left wheel
  drawWheel(-halfW * 0.4, halfH * 0.6, 0);
  // rear-right wheel
  drawWheel(-halfW * 0.4, -halfH * 0.6, 0);

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Obstacles
  ctx.fillStyle = "gray";
  obstacles.forEach((obs) => {
    ctx.fillRect(obs.x, obs.y, obs.size, obs.size);
  });

  // Cars
  cars.forEach((car) => {
    drawCar(car);
  });

  // Player (ball)
  if (!isPlayerInCar) {
    let drawPlayer = true;
    if (ball.invincible) {
      drawPlayer = Math.floor(performance.now() / 200) % 2 === 0;
    }
    if (drawPlayer) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();
      ctx.closePath();

      // Draw the player's weapon
      let angle = Math.atan2(
        mouse.y + camera.y - ball.y,
        mouse.x + camera.x - ball.x
      );
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(angle);
      ctx.fillStyle = "black";
      ctx.fillRect(ball.radius, -5, 20, 10);
      ctx.restore();
    }
  }

  // Enemies
  enemies.forEach((enemy) => {
    if (enemy.hp > 0) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = "green";
      ctx.fill();
      ctx.closePath();
      // HP bar
      ctx.fillStyle = "red";
      ctx.fillRect(enemy.x - 20, enemy.y - 30, 40 * (enemy.hp / 100), 5);
      ctx.strokeStyle = "black";
      ctx.strokeRect(enemy.x - 20, enemy.y - 30, 40, 5);
    }
  });

  // Bullets
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.closePath();
  });

  ctx.restore();

  // UI: Health
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "red";
  for (let i = 0; i < ball.health; i++) {
    ctx.fillText("♥", 10 + i * 30, 30);
  }

  // Game Over
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 50);
  }
}

// --- Game Loop ---
let lastTimestamp = performance.now();
function gameLoop(timestamp) {
  let delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
