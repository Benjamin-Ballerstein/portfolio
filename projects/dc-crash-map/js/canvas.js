// ─── Canvas sizing ────────────────────────────────────────────────────────────
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Impact dot that appears at each crash location and fades quickly.
function canvasTick(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  waves = waves.filter(w => {
    const t = (now - w.startTime) / WAVE_DURATION;
    if (t >= 0.25) return false; // dot fades by t=0.25

    ctx.beginPath();
    ctx.arc(w.cx, w.cy, 3, 0, Math.PI * 2);
    ctx.globalAlpha = (1 - t / 0.25) * 0.9;
    ctx.fillStyle   = '#ffffff';
    ctx.fill();

    return true;
  });

  ctx.globalAlpha = 1;
  requestAnimationFrame(canvasTick);
}

function startCanvasLoop() {
  requestAnimationFrame(canvasTick);
}
