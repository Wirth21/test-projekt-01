#!/usr/bin/env node
/**
 * One-off: paint a solid white background behind the transparent PNG icons
 * used for PWA install + splash. Android's splash renderer shows black where
 * icons are transparent (especially for `purpose: "maskable"`); baking white
 * into the PNG sidesteps that.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

async function whiten(path, size) {
  const img = await loadImage(readFileSync(path));
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  const out = canvas.toBuffer("image/png");
  writeFileSync(path, out);
  console.log(`  ${path}: ${out.length} B`);
}

await whiten("public/icon-192.png", 192);
await whiten("public/icon-512.png", 512);
await whiten("public/apple-touch-icon.png", 180);

console.log("Done.");
