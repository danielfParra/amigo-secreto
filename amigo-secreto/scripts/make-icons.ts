import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

// Source: the user's artwork, a rounded-square icon on a cream border with a soft shadow.
const SRC = path.resolve(import.meta.dirname, "../../app_icon.jpeg");
const OUT = path.resolve(import.meta.dirname, "../public/icons");
const BASE = 1024;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Bounding box of the dark tile (the cream border and gray shadow are bright).
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma < 110) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const side = Math.min(maxX - minX + 1, maxY - minY + 1);
  const trim = 3; // drop anti-aliased edge pixels that blend with the cream border
  console.log({ width, height, minX, minY, maxX, maxY, side });

  const tile = await sharp(SRC)
    .extract({ left: minX + trim, top: minY + trim, width: side - trim * 2, height: side - trim * 2 })
    .resize(BASE, BASE)
    .png()
    .toBuffer();

  // Round the tile, then lay it over a gradient sampled from its own top and bottom so the
  // corners are filled with matching color (iOS/Android apply their own mask on top).
  const mask = Buffer.from(
    `<svg width="${BASE}" height="${BASE}"><rect width="${BASE}" height="${BASE}" rx="${Math.round(BASE * 0.215)}" fill="#fff"/></svg>`,
  );
  const masked = await sharp(tile).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  const raw = await sharp(tile).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * raw.info.width + x) * raw.info.channels;
    return `rgb(${raw.data[i]},${raw.data[i + 1]},${raw.data[i + 2]})`;
  };
  const top = px(BASE / 2, 14);
  const bottom = px(BASE / 2, BASE - 14);
  const bg = Buffer.from(
    `<svg width="${BASE}" height="${BASE}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${BASE}" height="${BASE}" fill="url(#g)"/></svg>`,
  );
  const full = await sharp(bg).composite([{ input: masked }]).png().toBuffer();

  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["maskable-512.png", 512],
    ["apple-touch-icon.png", 180],
  ] as const) {
    await sharp(full).resize(size, size).png().toFile(path.join(OUT, name));
  }
}

main();
