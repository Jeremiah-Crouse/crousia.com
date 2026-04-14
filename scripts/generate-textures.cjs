const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('canvas');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'textures');
const SIZE = 256;
const FRAMES = 24;
const DELAY = 60;

const TEXTURES = {
  gold: {
    colors: [
      [42, 31, 5],
      [201, 162, 39],
      [255, 241, 184],
    ],
    mode: 'gold',
  },
  green: {
    colors: [
      [0, 26, 13],
      [15, 143, 61],
      [168, 255, 203],
    ],
    mode: 'emerald',
  },
  purple: {
    colors: [
      [34, 8, 46],
      [160, 32, 240],
      [238, 206, 255],
    ],
    mode: 'purple',
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
  ];
}

function addColor(a, b, scale = 1) {
  return [
    a[0] + b[0] * scale,
    a[1] + b[1] * scale,
    a[2] + b[2] * scale,
  ];
}

function gamma(color, exponent) {
  return color.map((channel) => Math.pow(clamp(channel / 255, 0, 1), exponent) * 255);
}

function noise(x, y) {
  return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fract(x);
  const fy = fract(y);

  // Smooth cubic interpolation
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  return mix(
    mix(noise(ix, iy), noise(ix + 1, iy), ux),
    mix(noise(ix, iy + 1), noise(ix + 1, iy + 1), ux),
    uy
  );
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function renderGoldPixel(uvX, uvY, time, colors) {
  // Band-based pattern similar to purple but adapted for gold
  const bandA = Math.sin(uvY * 14 + time) * 0.5 + 0.5;
  const bandB = Math.sin(uvX * 10 - time * 0.8) * 0.5 + 0.5;
  
  const n = valueNoise(uvX * 6 + Math.cos(time) * 0.3, uvY * 6 + Math.sin(time) * 0.3);
  const flow = mix(bandA, bandB, 0.4);
  const blend = mix(flow, n, 0.35);

  let color = mixColor(colors[0], colors[1], blend);
  color = mixColor(color, colors[2], Math.pow(blend, 3));

  const core = Math.pow(1 - Math.abs(uvX - 0.5), 8);
  color = addColor(color, [255, 240, 180], core * 0.5);

  const fresnel = Math.pow(1 - Math.abs(uvY - 0.5), 2.5);
  color = addColor(color, [255, 215, 100], fresnel * 0.3);

  return gamma(color, 0.85);
}

function renderEmeraldPixel(uvX, uvY, time, colors) {
  const flippedX = 1 - uvX;
  const n = valueNoise(flippedX * 6 + Math.cos(time) * 0.2, uvY * 6 + Math.sin(time) * 0.2);
  const gradient = smoothstep(0, 1, uvY);
  const mixVal = mix(gradient, n, 0.25);

  let color = mixColor(colors[0], colors[1], mixVal);
  color = mixColor(color, colors[2], Math.pow(mixVal, 4));

  const spec = Math.pow(1 - Math.abs(flippedX - 0.5), 12);
  color = addColor(color, [153, 255, 179], spec * 0.6);

  const fresnel = Math.pow(1 - Math.abs(uvY - 0.5), 4);
  color = addColor(color, [77, 230, 128], fresnel * 0.3);

  return gamma(color, 0.8);
}

function renderPurplePixel(uvX, uvY, time, colors) {
  // Simplified band math to ensure 2*PI periodicity
  const bandA = Math.sin(uvY * 16 + time) * 0.5 + 0.5;
  const bandB = Math.sin(uvX * 12 - time) * 0.5 + 0.5;
  
  const n = valueNoise(uvX * 7 + Math.cos(time) * 0.3, uvY * 7 + Math.sin(time) * 0.3);
  const glow = mix(bandA, bandB, 0.35);
  const blend = mix(glow, n, 0.3);

  let color = mixColor(colors[0], colors[1], blend);
  color = mixColor(color, colors[2], Math.pow(blend, 3.5));

  const core = Math.pow(1 - Math.abs(uvX - 0.5), 10);
  color = addColor(color, [255, 230, 255], core * 0.4);

  const haze = Math.pow(1 - Math.abs(uvY - 0.5), 2.5);
  color = addColor(color, [214, 166, 255], haze * 0.22);

  return gamma(color, 0.82);
}

function renderFrame(texture, frameIndex) {
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  const time = (frameIndex / FRAMES) * Math.PI * 2;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const uvX = x / (SIZE - 1);
      const uvY = y / (SIZE - 1);
      const index = (y * SIZE + x) * 4;

      let color;
      if (texture.mode === 'emerald') {
        color = renderEmeraldPixel(uvX, uvY, time, texture.colors);
      } else if (texture.mode === 'purple') {
        color = renderPurplePixel(uvX, uvY, time, texture.colors);
      } else {
        color = renderGoldPixel(uvX, uvY, time, texture.colors);
      }

      rgba[index] = clamp(Math.round(color[0]), 0, 255);
      rgba[index + 1] = clamp(Math.round(color[1]), 0, 255);
      rgba[index + 2] = clamp(Math.round(color[2]), 0, 255);
      rgba[index + 3] = 255;
    }
  }

  return rgba;
}

function writePosterPng(filePath, rgba) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(rgba, SIZE, SIZE), 0, 0);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

function generateTexture(name, texture) {
  const gif = GIFEncoder();
  const allFrames = [];

  for (let frame = 0; frame < FRAMES; frame += 1) {
    allFrames.push(renderFrame(texture, frame));
  }

  // Sample all frames for a more stable global palette to prevent "flicker"
  const combinedBuffer = Buffer.concat(allFrames.map(f => Buffer.from(f)));
  const palette = quantize(combinedBuffer, 256);

  allFrames.forEach((rgba, frame) => {
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, SIZE, SIZE, {
      palette,
      delay: DELAY,
      repeat: frame === 0 ? 0 : undefined,
    });
  });

  gif.finish();

  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.gif`), Buffer.from(gif.bytes()));
  writePosterPng(path.join(OUTPUT_DIR, `${name}.png`), allFrames[0]);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [name, texture] of Object.entries(TEXTURES)) {
  generateTexture(name, texture);
  console.log(`Generated ${name} texture`);
}
