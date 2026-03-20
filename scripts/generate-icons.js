// Simple script to generate PWA icons as PNG using Canvas API
// Run: node scripts/generate-icons.js

const { createCanvas } = (() => {
  try {
    return require("canvas");
  } catch {
    // Fallback: generate SVG-based approach
    return { createCanvas: null };
  }
})();

const fs = require("fs");
const path = require("path");

function generateSvgIcon(size) {
  const fontSize = Math.round(size * 0.35);
  const padding = Math.round(size * 0.15);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#0a0a0a"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">PL</text>
</svg>`;
}

const iconsDir = path.join(__dirname, "..", "public", "icons");

// Write SVG icons (universally supported as PWA icons)
for (const size of [192, 512]) {
  const svg = generateSvgIcon(size);
  const filePath = path.join(iconsDir, `icon-${size}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated ${filePath}`);
}
