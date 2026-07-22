// Tile data — figX/figY/figW/figH are the exact positions and sizes from the
// Figma design's Gallery frame (1440×900 canvas). We scale these
// proportionally to whatever width the gallery actually renders at, so the
// composition matches the design instead of a generic row-wrap layout.
const FIGMA_CANVAS_W = 1440;
const FIGMA_CANVAS_H = 900;

const TILES = [
  { n: "01", img: "assets/home/photo-01.png", loc: "Myka, NY", cap: "Froyo obsession!!", figX: 47, figY: 41, figW: 220, figH: 208 },
  { n: "03", img: "assets/home/photo-03.png", loc: "Malibu, CA", cap: "My family loves to hike", figX: 720, figY: 53, figW: 442, figH: 260 },
  { n: "04", img: "assets/home/photo-04.png", loc: "Claremont, CA", cap: "Biannual free coffee for my friends", figX: 1197, figY: 235, figW: 159, figH: 275 },
  { n: "05", img: "assets/home/photo-05.png", loc: null, cap: "Me!", figX: 100, figY: 289, figW: 167, figH: 277 },
  { n: "06", img: "assets/home/photo-06.png", loc: "Pasadena, CA", cap: "More hiking!", figX: 432, figY: 338, figW: 300, figH: 220 },
  { n: "07", img: "assets/home/photo-07.png", loc: "Pomona, CA", cap: "Dance team showcase", figX: 712, figY: 611, figW: 187, figH: 264 },
  { n: "08", img: "assets/home/photo-08.png", loc: "Bologna, Italy", cap: "My first solo trip + a pasta making class", figX: 949, figY: 560, figW: 284, figH: 179 },
  { n: "09", img: "assets/home/photo-09.png", loc: "Claremont, CA", cap: "Campus view from my dorm", figX: 37, figY: 634, figW: 239, figH: 151 },
  { n: "10", img: "assets/home/photo-10.png", loc: "Milan, Italy", cap: "Favorite cafe + $2 coffees during study abroad", figX: 367, figY: 584, figW: 280, figH: 280 },
  { n: "11", img: "assets/home/photo-11.png", loc: "Milan, Italy", cap: "My first opera", figX: 840, figY: 346, figW: 198, figH: 181 },
];

// Tunable motion constants
const SPEED = 0.22;        // px per frame, constant drift speed (slow + calm)
const SEPARATION_EASE = 0.12; // fraction of overlap corrected per frame (higher = snappier bump, lower = softer)
const MIN_SCALE = 0.4;     // floor on how far the layout can shrink on narrow viewports

function initGallery() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const tiles = TILES.map((data) => {
    const el = document.createElement("div");
    el.className = "tile";

    const locHtml = data.loc
      ? `<div class="tile-location">\u{1F4CD} ${data.loc}</div>`
      : "";

    el.innerHTML = `
      <div class="tile-inner">
        <div class="tile-face tile-front">
          <span class="tile-number">${data.n}</span>
          <img src="${data.img}" alt="${data.loc || ''} ${data.cap}" loading="lazy" decoding="async" />
        </div>
        <div class="tile-face tile-back">
          ${locHtml}
          <div class="tile-caption">${data.cap}</div>
        </div>
      </div>
    `;

    gallery.appendChild(el);

    el.addEventListener("mouseenter", () => el.classList.add("flipped"));
    el.addEventListener("mouseleave", () => el.classList.remove("flipped"));

    // Random direction, but fixed constant speed so drift feels uniform
    // rather than some tiles crawling and others racing.
    const angle = Math.random() * Math.PI * 2;
    return {
      el,
      figX: data.figX,
      figY: data.figY,
      figW: data.figW,
      figH: data.figH,
      w: data.figW,
      h: data.figH,
      x: 0,
      y: 0,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
    };
  });

  layoutFromFigma(tiles, gallery, false);

  function tick() {
    const bounds = gallery.getBoundingClientRect();
    const maxX = bounds.width;
    const maxY = bounds.height;

    for (const t of tiles) {
      if (t.el.matches(":hover")) continue;

      t.x += t.vx;
      t.y += t.vy;

      // Elastic bounce off the container edges.
      if (t.x <= 0) { t.x = 0; t.vx = Math.abs(t.vx); }
      if (t.x + t.w >= maxX) { t.x = maxX - t.w; t.vx = -Math.abs(t.vx); }
      if (t.y <= 0) { t.y = 0; t.vy = Math.abs(t.vy); }
      if (t.y + t.h >= maxY) { t.y = maxY - t.h; t.vy = -Math.abs(t.vy); }
    }

    // Tile-vs-tile collision: bump apart instead of overlapping.
    // Separation is applied gradually (SEPARATION_EASE fraction per frame)
    // rather than all at once, which is what keeps this from looking
    // jittery — tiles ease apart over a few frames instead of teleporting.
    for (let i = 0; i < tiles.length; i++) {
      const a = tiles[i];
      if (a.el.matches(":hover")) continue;
      for (let j = i + 1; j < tiles.length; j++) {
        const b = tiles[j];
        if (b.el.matches(":hover")) continue;
        resolveCollision(a, b);
      }
    }

    for (const t of tiles) {
      t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => layoutFromFigma(tiles, gallery, true), 100);
  });
}

// Lays tiles out at the exact Figma-designed positions/sizes, scaled
// proportionally so the composition holds together — and scaled against
// BOTH the available width and the available height of the viewport (the
// gallery's parent), so the whole thing fits on screen with no page scroll.
function layoutFromFigma(tiles, gallery, preserveRelativePosition) {
  const viewport = gallery.parentElement;
  const viewportRect = viewport.getBoundingClientRect();
  const availWidth = viewportRect.width || viewport.clientWidth;
  const availHeight = viewportRect.height || viewport.clientHeight;

  const scale = Math.max(
    Math.min(availWidth / FIGMA_CANVAS_W, availHeight / FIGMA_CANVAS_H),
    MIN_SCALE
  );
  const galleryWidth = FIGMA_CANVAS_W * scale;
  const galleryHeight = FIGMA_CANVAS_H * scale;
  gallery.style.width = galleryWidth + "px";
  gallery.style.height = galleryHeight + "px";

  for (const t of tiles) {
    const newW = t.figW * scale;
    const newH = t.figH * scale;

    if (preserveRelativePosition && t.w > 0 && t.h > 0) {
      // Keep each tile's current fractional position within the gallery
      // instead of snapping back to its exact Figma spot — feels smoother
      // across a resize/orientation change than a hard relayout.
      const fracX = t.x / Math.max(1, gallery._lastWidth || galleryWidth);
      const fracY = t.y / Math.max(1, gallery._lastHeight || galleryHeight);
      t.x = Math.min(fracX * galleryWidth, galleryWidth - newW);
      t.y = Math.min(fracY * galleryHeight, galleryHeight - newH);
    } else {
      t.x = t.figX * scale;
      t.y = t.figY * scale;
    }

    t.w = newW;
    t.h = newH;
    t.el.style.width = newW + "px";
    t.el.style.height = newH + "px";
    t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
  }

  gallery._lastWidth = galleryWidth;
  gallery._lastHeight = galleryHeight;
}

function resolveCollision(a, b) {
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx2 = b.x + b.w, by2 = b.y + b.h;

  const overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);

  if (overlapX <= 0 || overlapY <= 0) return; // not touching

  // Push apart along whichever axis has the smaller overlap — that's the
  // "shallow" side, i.e. the natural direction they'd bounce off each other.
  if (overlapX < overlapY) {
    const push = (overlapX / 2) * SEPARATION_EASE;
    if (a.x < b.x) { a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
    const tmp = a.vx; a.vx = b.vx; b.vx = tmp; // elastic swap on the bump axis
  } else {
    const push = (overlapY / 2) * SEPARATION_EASE;
    if (a.y < b.y) { a.y -= push; b.y += push; } else { a.y += push; b.y -= push; }
    const tmp = a.vy; a.vy = b.vy; b.vy = tmp;
  }
}

document.addEventListener("DOMContentLoaded", initGallery);
