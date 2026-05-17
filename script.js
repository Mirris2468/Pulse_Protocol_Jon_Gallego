const GameState = {
  MENU: "MENU",
  AIMING: "AIMING",
  SHOOTING: "SHOOTING",
  TURN_END: "TURN_END",
  LEVEL_CLEAR: "LEVEL_CLEAR",
  GAME_OVER: "GAME_OVER",
};

const app = {
  state: GameState.MENU,
  root: document.querySelector(".app"),
  canvas: document.getElementById("gameCanvas"),
  ctx: null,
  ui: {
    menu: document.getElementById("menuScreen"),
    hudState: document.getElementById("hudState"),
    playBtn: document.getElementById("playBtn"),
    optionsBtn: document.getElementById("optionsBtn"),
    optionsPanel: document.getElementById("optionsPanel"),
    musicVolume: document.getElementById("musicVolume"),
    sfxVolume: document.getElementById("sfxVolume"),
    musicVolumeValue: document.getElementById("musicVolumeValue"),
    sfxVolumeValue: document.getElementById("sfxVolumeValue"),
  },
  lastTime: 0,
  world: {
    width: 0,
    height: 0,
  },
  aim: {
    x: 0,
    y: 0,
    isDragging: false,
  },
  ball: {
    x: 0,
    y: 48,
    vx: 0,
    vy: 0,
    radius: 9,
    speed: 560,
    gravity: 950,
  },
  pegs: [],
  bucket: {
    width: 56,
    height: 28,
    x: 0,
    y: 0,
    vx: 130,
  },
  stats: {
    score: 0,
    recoveredProjectiles: 0,
    projectilesLeft: 10,
    maxProjectiles: 10,
  },
  physics: {
    pegBounceDamping: 0.86,
  },
  ability: {
    bouncePreviewNextShot: false,
  },
  audio: {
    musicVolume: 0.6,
    sfxVolume: 0.7,
  },
};

function setState(nextState) {
  app.state = nextState;
  updateHud();

  app.ui.menu.classList.remove("screen--active");
  if (nextState === GameState.MENU) app.ui.menu.classList.add("screen--active");
}

function updateHud() {
  app.ui.hudState.textContent = `Score: ${app.stats.score}`;
}

function resetLevelStats() {
  app.stats.score = 0;
  app.stats.recoveredProjectiles = 0;
  app.stats.projectilesLeft = app.stats.maxProjectiles;
  app.ability.bouncePreviewNextShot = false;
}

function startLevel() {
  createLevelPegs();
  layoutBucket();
  resetBall();
  resetLevelStats();
  setState(GameState.AIMING);
}

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = app.root ? app.root.getBoundingClientRect() : app.canvas.getBoundingClientRect();
  const cssWidth = Math.floor(rect.width);
  const cssHeight = Math.floor(rect.height);
  const width = Math.floor(cssWidth * dpr);
  const height = Math.floor(cssHeight * dpr);

  app.canvas.width = width;
  app.canvas.height = height;
  app.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  app.world.width = cssWidth;
  app.world.height = cssHeight;
  app.aim.x = app.world.width * 0.5;
  app.aim.y = app.world.height * 0.55;
  resetBall();
  createLevelPegs();
  layoutBucket();
}

function resetBall() {
  app.ball.x = app.world.width * 0.5;
  app.ball.y = 48;
  app.ball.vx = 0;
  app.ball.vy = 0;
}

function createLevelPegs() {
  const rows = 5;
  const cols = 7;
  const topOffset = 130;
  const sidePadding = 34;
  const spacingX = (app.world.width - sidePadding * 2) / (cols - 1);
  const spacingY = 52;
  const radius = 11;
  const pegs = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const xOffset = row % 2 === 0 ? 0 : spacingX * 0.5;
      const x = sidePadding + col * spacingX + xOffset;
      const y = topOffset + row * spacingY;

      if (x > app.world.width - sidePadding) continue;
      pegs.push({ x, y, radius, hitThisTurn: false, kind: "normal" });
    }
  }

  assignPowerPegs(pegs);
  app.pegs = pegs;
}

/** Entre 2 y 4 pegs verdes (habilidad), sin pasar del total de pegs del nivel. */
function assignPowerPegs(pegs) {
  if (pegs.length === 0) return;

  const desired = 2 + Math.floor(Math.random() * 3);
  const count = Math.min(pegs.length, desired);

  const order = pegs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (let k = 0; k < count; k += 1) {
    pegs[order[k]].kind = "power";
  }
}

function layoutBucket() {
  const marginBottom = Math.max(20, app.world.height * 0.04);
  const halfW = app.bucket.width * 0.5;
  const padding = 10;
  app.bucket.y = app.world.height - marginBottom - app.bucket.height;
  app.bucket.x = Math.min(
    Math.max(app.bucket.x || halfW + padding, halfW + padding),
    app.world.width - halfW - padding,
  );
}

function updateBucket(dt) {
  if (app.state === GameState.MENU) return;

  const halfW = app.bucket.width * 0.5;
  const padding = 10;
  const minX = halfW + padding;
  const maxX = app.world.width - halfW - padding;

  app.bucket.x += app.bucket.vx * dt;
  if (app.bucket.x <= minX) {
    app.bucket.x = minX;
    app.bucket.vx = Math.abs(app.bucket.vx);
  } else if (app.bucket.x >= maxX) {
    app.bucket.x = maxX;
    app.bucket.vx = -Math.abs(app.bucket.vx);
  }
}

function getPointerPosition(event) {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function bindMenuEvents() {
  if (!app.ui.playBtn) return;

  const handleStart = () => {
    console.log("Iniciar nivel 1 -> AIMING");
    startLevel();
  };

  // click asegura compatibilidad en desktop; pointerup cubre tactil.
  app.ui.playBtn.addEventListener("click", handleStart);
  app.ui.playBtn.addEventListener("pointerup", handleStart);

  if (app.ui.optionsBtn && app.ui.optionsPanel) {
    app.ui.optionsBtn.addEventListener("click", () => {
      const isHidden = app.ui.optionsPanel.classList.contains("options-panel--hidden");
      app.ui.optionsPanel.classList.toggle("options-panel--hidden", !isHidden);
      app.ui.optionsBtn.textContent = isHidden ? "Cerrar opciones" : "Opciones";
    });
  }
}

function bindAudioOptions() {
  if (!app.ui.musicVolume || !app.ui.sfxVolume || !app.ui.musicVolumeValue || !app.ui.sfxVolumeValue) return;

  const applyUIValues = () => {
    const musicPercent = Math.round(app.audio.musicVolume * 100);
    const sfxPercent = Math.round(app.audio.sfxVolume * 100);
    app.ui.musicVolume.value = String(musicPercent);
    app.ui.sfxVolume.value = String(sfxPercent);
    app.ui.musicVolumeValue.textContent = `${musicPercent}%`;
    app.ui.sfxVolumeValue.textContent = `${sfxPercent}%`;
  };

  const saveAudioOptions = () => {
    const payload = {
      musicVolume: app.audio.musicVolume,
      sfxVolume: app.audio.sfxVolume,
    };
    window.localStorage.setItem("pulsePegAudioOptions", JSON.stringify(payload));
  };

  const onMusicInput = () => {
    app.audio.musicVolume = Number(app.ui.musicVolume.value) / 100;
    app.ui.musicVolumeValue.textContent = `${app.ui.musicVolume.value}%`;
    saveAudioOptions();
  };

  const onSfxInput = () => {
    app.audio.sfxVolume = Number(app.ui.sfxVolume.value) / 100;
    app.ui.sfxVolumeValue.textContent = `${app.ui.sfxVolume.value}%`;
    saveAudioOptions();
  };

  app.ui.musicVolume.addEventListener("input", onMusicInput);
  app.ui.sfxVolume.addEventListener("input", onSfxInput);

  try {
    const raw = window.localStorage.getItem("pulsePegAudioOptions");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.musicVolume === "number") app.audio.musicVolume = Math.min(1, Math.max(0, parsed.musicVolume));
      if (typeof parsed.sfxVolume === "number") app.audio.sfxVolume = Math.min(1, Math.max(0, parsed.sfxVolume));
    }
  } catch (_error) {
    // Si localStorage falla por cualquier motivo, seguimos con defaults.
  }

  applyUIValues();
}

function bindGameplayInput() {
  const updateAimFromEvent = (event) => {
    if (app.state !== GameState.AIMING) return;
    const pos = getPointerPosition(event);
    app.aim.x = pos.x;
    app.aim.y = pos.y;
  };

  const handleDown = (event) => {
    if (app.state === GameState.GAME_OVER || app.state === GameState.LEVEL_CLEAR) {
      event.preventDefault();
      startLevel();
      return;
    }

    if (app.state !== GameState.AIMING) return;
    event.preventDefault();
    const pos = getPointerPosition(event);
    app.aim.isDragging = true;
    app.aim.x = pos.x;
    app.aim.y = pos.y;
    if (event.pointerId !== undefined) app.canvas.setPointerCapture(event.pointerId);
  };

  const handleMove = (event) => {
    if (app.state !== GameState.AIMING) return;
    updateAimFromEvent(event);
  };

  const handleUp = (event) => {
    if (app.state !== GameState.AIMING || !app.aim.isDragging) return;
    event.preventDefault();
    app.aim.isDragging = false;
    const pos = getPointerPosition(event);
    app.aim.x = pos.x;
    app.aim.y = pos.y;
    shootBall();
    if (event.pointerId !== undefined) app.canvas.releasePointerCapture(event.pointerId);
  };

  const cancelDrag = (event) => {
    app.aim.isDragging = false;
    if (event?.pointerId !== undefined) app.canvas.releasePointerCapture(event.pointerId);
  };

  // Pointer events unifican mouse + tactil.
  app.canvas.addEventListener("pointerdown", handleDown);
  app.canvas.addEventListener("pointermove", handleMove);
  // Fallback desktop: asegura seguimiento continuo del cursor.
  app.canvas.addEventListener("mousemove", updateAimFromEvent);
  app.canvas.addEventListener("pointerup", handleUp);
  app.canvas.addEventListener("pointercancel", cancelDrag);
  app.canvas.addEventListener("pointerleave", cancelDrag);
}

function shootBall() {
  if (app.stats.projectilesLeft <= 0) {
    setState(GameState.GAME_OVER);
    return;
  }

  const dx = app.aim.x - app.ball.x;
  const dy = app.aim.y - app.ball.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;

  app.ball.vx = (dx / length) * app.ball.speed;
  app.ball.vy = (dy / length) * app.ball.speed;
  app.stats.projectilesLeft -= 1;
  if (app.ability.bouncePreviewNextShot) app.ability.bouncePreviewNextShot = false;
  setState(GameState.SHOOTING);
}

function updateBall(dt) {
  if (app.state !== GameState.SHOOTING) return;

  app.ball.vy += app.ball.gravity * dt;
  app.ball.x += app.ball.vx * dt;
  app.ball.y += app.ball.vy * dt;

  if (app.ball.x - app.ball.radius <= 0 && app.ball.vx < 0) {
    app.ball.x = app.ball.radius;
    app.ball.vx *= -1;
  }

  if (app.ball.x + app.ball.radius >= app.world.width && app.ball.vx > 0) {
    app.ball.x = app.world.width - app.ball.radius;
    app.ball.vx *= -1;
  }

  if (app.ball.y - app.ball.radius <= 0 && app.ball.vy < 0) {
    app.ball.y = app.ball.radius;
    app.ball.vy *= -1;
  }

  checkBucketCollision();

  if (app.ball.y - app.ball.radius > app.world.height) {
    setState(GameState.TURN_END);
  }

  checkPegCollisions();
}

function checkBucketCollision() {
  const left = app.bucket.x - app.bucket.width * 0.5;
  const right = app.bucket.x + app.bucket.width * 0.5;
  const top = app.bucket.y;
  const bottom = app.bucket.y + app.bucket.height;

  // Captura: si la pelota entra dentro del balde por arriba, se considera recuperada.
  const enteredInside =
    app.ball.vy > 0 &&
    app.ball.x > left + app.ball.radius &&
    app.ball.x < right - app.ball.radius &&
    app.ball.y + app.ball.radius >= top &&
    app.ball.y - app.ball.radius <= bottom;

  if (enteredInside) {
    app.stats.recoveredProjectiles += 1;
    app.stats.projectilesLeft = Math.min(app.stats.projectilesLeft + 1, app.stats.maxProjectiles);
    updateHud();
    setState(GameState.TURN_END);
    return;
  }

  // Rebote en pared lateral izquierda del balde.
  const touchingLeftWall =
    app.ball.vx > 0 &&
    app.ball.x + app.ball.radius >= left &&
    app.ball.x - app.ball.radius < left &&
    app.ball.y > top &&
    app.ball.y < bottom;

  if (touchingLeftWall) {
    app.ball.x = left - app.ball.radius;
    app.ball.vx *= -1;
  }

  // Rebote en pared lateral derecha del balde.
  const touchingRightWall =
    app.ball.vx < 0 &&
    app.ball.x - app.ball.radius <= right &&
    app.ball.x + app.ball.radius > right &&
    app.ball.y > top &&
    app.ball.y < bottom;

  if (touchingRightWall) {
    app.ball.x = right + app.ball.radius;
    app.ball.vx *= -1;
  }
}

function checkPegCollisions() {
  for (const peg of app.pegs) {
    const dx = app.ball.x - peg.x;
    const dy = app.ball.y - peg.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = app.ball.radius + peg.radius;
    if (distance >= minDistance || distance === 0) continue;

    const firstTimeHitThisTurn = !peg.hitThisTurn;
    peg.hitThisTurn = true;
    if (firstTimeHitThisTurn) {
      app.stats.score += 5;
      if (peg.kind === "power") app.ability.bouncePreviewNextShot = true;
      updateHud();
    }

    const nx = dx / distance;
    const ny = dy / distance;

    // Reposiciona la pelota para evitar quedarse dentro del peg.
    const overlap = minDistance - distance;
    app.ball.x += nx * overlap;
    app.ball.y += ny * overlap;

    // Rebote simple reflejando la velocidad sobre la normal.
    const dot = app.ball.vx * nx + app.ball.vy * ny;
    app.ball.vx = (app.ball.vx - 2 * dot * nx) * app.physics.pegBounceDamping;
    app.ball.vy = (app.ball.vy - 2 * dot * ny) * app.physics.pegBounceDamping;
  }
}

function updateTurnEnd() {
  if (app.state !== GameState.TURN_END) return;
  cleanupHitPegs();
  resetBall();
  if (app.pegs.length === 0) {
    setState(GameState.LEVEL_CLEAR);
    return;
  }
  if (app.stats.projectilesLeft <= 0) {
    setState(GameState.GAME_OVER);
    return;
  }
  setState(GameState.AIMING);
}

function cleanupHitPegs() {
  app.pegs = app.pegs.filter((peg) => !peg.hitThisTurn);
}

function drawScene() {
  const w = app.world.width;
  const h = app.world.height;

  app.ctx.clearRect(0, 0, w, h);

  if (app.state !== GameState.MENU) {
    app.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    app.ctx.lineWidth = 2;
    app.ctx.beginPath();
    app.ctx.moveTo(0, 48);
    app.ctx.lineTo(w, 48);
    app.ctx.stroke();
  }

  drawPegs();
  if (app.state !== GameState.MENU) drawBucket();
  if (app.state === GameState.AIMING) drawAimGuide();
  if (app.state !== GameState.MENU) drawBall();
  if (app.state !== GameState.MENU) drawProjectileCounter();
  if (app.state === GameState.GAME_OVER || app.state === GameState.LEVEL_CLEAR) drawEndOverlay();
}

function drawProjectileCounter() {
  const text = `${app.stats.projectilesLeft}/${app.stats.maxProjectiles}`;
  app.ctx.textAlign = "center";
  app.ctx.textBaseline = "middle";
  app.ctx.font = "600 15px system-ui";
  app.ctx.fillStyle = "#f1f5ff";
  app.ctx.fillText(text, app.world.width * 0.5, 26);
}

function drawBucket() {
  const { x, y, width, height } = app.bucket;
  const left = x - width * 0.5;
  app.ctx.fillStyle = "rgba(122, 139, 255, 0.35)";
  app.ctx.strokeStyle = "rgba(200, 210, 255, 0.85)";
  app.ctx.lineWidth = 2;
  app.ctx.fillRect(left, y, width, height);
  app.ctx.strokeRect(left, y, width, height);
}

function drawPegs() {
  for (const peg of app.pegs) {
    if (peg.hitThisTurn) {
      app.ctx.fillStyle = "#ff8a65";
    } else if (peg.kind === "power") {
      app.ctx.fillStyle = "#22c55e";
    } else {
      app.ctx.fillStyle = "#7ec8ff";
    }
    app.ctx.beginPath();
    app.ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
    app.ctx.fill();
  }
}

function drawAimGuide() {
  const dx = app.aim.x - app.ball.x;
  const dy = app.aim.y - app.ball.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const dirX = dx / len;
  const dirY = dy / len;
  drawBallisticPreview(
    app.ball.x,
    app.ball.y,
    dirX * app.ball.speed,
    dirY * app.ball.speed,
    "rgba(122, 139, 255, 0.9)",
  );

  if (!app.ability.bouncePreviewNextShot) return;

  const hit = findFirstPegBallisticHit(
    app.ball.x,
    app.ball.y,
    dirX * app.ball.speed,
    dirY * app.ball.speed,
  );
  if (!hit) return;

  const toImpactX = hit.x - hit.peg.x;
  const toImpactY = hit.y - hit.peg.y;
  const toImpactLen = Math.hypot(toImpactX, toImpactY) || 1;
  const nx = toImpactX / toImpactLen;
  const ny = toImpactY / toImpactLen;
  const speedAtImpact = Math.hypot(hit.vx, hit.vy) || 1;
  const inX = hit.vx / speedAtImpact;
  const inY = hit.vy / speedAtImpact;
  const dot = inX * nx + inY * ny;
  const rx = inX - 2 * dot * nx;
  const ry = inY - 2 * dot * ny;

  const postBounceSpeed = speedAtImpact * app.physics.pegBounceDamping;
  drawBallisticPreview(
    hit.x,
    hit.y,
    rx * postBounceSpeed,
    ry * postBounceSpeed,
    "rgba(34, 197, 94, 0.95)",
    84,
    true,
    true,
    hit.peg,
  );
}

function findFirstPegBallisticHit(startX, startY, initialVx, initialVy) {
  const dt = 1 / 120;
  const steps = 360;
  let x = startX;
  let y = startY;
  let vx = initialVx;
  let vy = initialVy;

  for (let i = 0; i < steps; i += 1) {
    vy += app.ball.gravity * dt;
    x += vx * dt;
    y += vy * dt;

    for (const peg of app.pegs) {
      const dx = x - peg.x;
      const dy = y - peg.y;
      const minDistance = app.ball.radius + peg.radius;
      if (dx * dx + dy * dy > minDistance * minDistance) continue;
      return { peg, x, y, vx, vy };
    }
  }

  return null;
}

function drawBallisticPreview(
  startX,
  startY,
  initialVx,
  initialVy,
  color,
  steps = 36,
  includeWallBounces = false,
  stopAtPegCollision = false,
  ignorePeg = null,
) {
  const dt = 1 / 60;
  let x = startX;
  let y = startY;
  let vx = initialVx;
  let vy = initialVy;

  app.ctx.strokeStyle = color;
  app.ctx.lineWidth = 2;
  app.ctx.beginPath();
  app.ctx.moveTo(x, y);

  for (let i = 0; i < steps; i += 1) {
    vy += app.ball.gravity * dt;
    x += vx * dt;
    y += vy * dt;

    if (includeWallBounces) {
      if (x - app.ball.radius <= 0 && vx < 0) {
        x = app.ball.radius;
        vx *= -1;
      } else if (x + app.ball.radius >= app.world.width && vx > 0) {
        x = app.world.width - app.ball.radius;
        vx *= -1;
      }

      if (y - app.ball.radius <= 0 && vy < 0) {
        y = app.ball.radius;
        vy *= -1;
      }
    }

    if (stopAtPegCollision) {
      for (const peg of app.pegs) {
        if (peg === ignorePeg) continue;
        const dx = x - peg.x;
        const dy = y - peg.y;
        const minDistance = app.ball.radius + peg.radius;
        if (dx * dx + dy * dy <= minDistance * minDistance) {
          app.ctx.lineTo(x, y);
          app.ctx.stroke();
          return;
        }
      }
    }

    app.ctx.lineTo(x, y);
  }

  app.ctx.stroke();
}

function drawBall() {
  app.ctx.fillStyle = "#e7ecff";
  app.ctx.beginPath();
  app.ctx.arc(app.ball.x, app.ball.y, app.ball.radius, 0, Math.PI * 2);
  app.ctx.fill();
}

function drawEndOverlay() {
  const w = app.world.width;
  const h = app.world.height;
  const title = app.state === GameState.LEVEL_CLEAR ? "Victoria!" : "Derrota";
  const subtitle = "Toca para reiniciar el nivel";

  app.ctx.fillStyle = "rgba(8, 10, 18, 0.68)";
  app.ctx.fillRect(0, 0, w, h);

  app.ctx.textAlign = "center";
  app.ctx.fillStyle = "#f2f5ff";
  app.ctx.font = "700 30px system-ui";
  app.ctx.fillText(title, w * 0.5, h * 0.45);

  app.ctx.fillStyle = "#b7c2e8";
  app.ctx.font = "500 16px system-ui";
  app.ctx.fillText(subtitle, w * 0.5, h * 0.52);
}

function update(dt) {
  updateBucket(dt);
  updateBall(dt);
  updateTurnEnd();
}

function gameLoop(timestamp) {
  const dt = (timestamp - app.lastTime) / 1000;
  app.lastTime = timestamp;
  update(dt);
  drawScene();
  requestAnimationFrame(gameLoop);
}

function init() {
  if (!app.canvas || !app.ui.menu || !app.ui.hudState || !app.ui.playBtn) {
    console.error("Faltan elementos del DOM para iniciar el juego.");
    return;
  }

  app.ctx = app.canvas.getContext("2d");
  if (!app.ctx) {
    console.error("No se pudo obtener el contexto 2D del canvas.");
    return;
  }

  resizeCanvas();
  bindMenuEvents();
  bindAudioOptions();
  bindGameplayInput();
  setState(GameState.MENU);

  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(gameLoop);
}

init();
