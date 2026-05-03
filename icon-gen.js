// NexChat Icon Generator - Creates PNG icons on first run
// Icons are generated from canvas and cached by the service worker

function generateNexChatIcon(size) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const radius = size * 0.22;
    
    // Rounded rect background
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    
    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1, '#d946ef');
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Chat bubble
    const cx = size / 2;
    const cy = size / 2;
    const bSize = size * 0.35;
    
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = size * 0.04;
    ctx.shadowOffsetY = size * 0.02;
    
    // Outer bubble
    ctx.beginPath();
    ctx.moveTo(cx - bSize, cy - bSize * 0.6);
    ctx.quadraticCurveTo(cx - bSize, cy - bSize, cx, cy - bSize);
    ctx.quadraticCurveTo(cx + bSize, cy - bSize, cx + bSize, cy - bSize * 0.6);
    ctx.lineTo(cx + bSize, cy + bSize * 0.2);
    ctx.quadraticCurveTo(cx + bSize, cy + bSize * 0.6, cx, cy + bSize * 0.6);
    ctx.lineTo(cx - bSize * 0.3, cy + bSize * 0.6);
    ctx.lineTo(cx - bSize * 0.6, cy + bSize);
    ctx.lineTo(cx - bSize * 0.4, cy + bSize * 0.6);
    ctx.quadraticCurveTo(cx - bSize, cy + bSize * 0.6, cx - bSize, cy + bSize * 0.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    
    // Three dots
    const dotR = size * 0.04;
    const dotGap = size * 0.09;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - dotGap, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dotGap, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

// Generate and store all icon sizes
async function generateAndStoreIcons() {
  if (typeof window === 'undefined') return;
  
  const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];
  const cache = await caches.open('nexchat-icons-v1');
  
  for (const size of sizes) {
    const path = `/icons/icon-${size}.png`;
    const existing = await cache.match(path);
    if (existing) continue;
    
    const blob = await generateNexChatIcon(size);
    const response = new Response(blob, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' }
    });
    await cache.put(path, response);
  }
  
  // Also cache apple touch icon
  const blob180 = await generateNexChatIcon(180);
  await cache.put('/icons/icon-192.png', new Response(blob180, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' }
  }));
  
  console.log('NexChat icons generated and cached');
}

// Auto-run
generateAndStoreIcons();