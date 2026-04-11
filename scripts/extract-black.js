import Jimp from 'jimp';
import path from 'path';

const COLOR_MAP = {
  white: { r: 255, g: 255, b: 255 },
  gold: { r: 255, g: 215, b: 0 },
  purple: { r: 160, g: 32, b: 240 },
};

async function extractBlack(inputPath, outputPath, colorName = 'white') {
  const targetColor = COLOR_MAP[colorName] || COLOR_MAP.white;
  const image = await Jimp.read(inputPath);
  
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let foundAny = false;

  // Process pixels
  image.scan(0, 0, width, height, function(x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];

    // Dark enough (R<80, G<80, B<80) and not already transparent
    if (r < 80 && g < 80 && b < 80 && a > 0) {
      this.bitmap.data[idx + 0] = targetColor.r;
      this.bitmap.data[idx + 1] = targetColor.g;
      this.bitmap.data[idx + 2] = targetColor.b;
      this.bitmap.data[idx + 3] = 255;
      
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foundAny = true;
    } else {
      this.bitmap.data[idx + 3] = 0; // Transparent
    }
  });

  if (!foundAny) {
    console.error('No dark pixels found!');
    return false;
  }

  // Crop with 10px padding
  const padding = 10;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  
  const cropWidth = right - left;
  const cropHeight = bottom - top;

  image.crop(left, top, cropWidth, cropHeight);
  await image.writeAsync(outputPath);
  console.log(`Saved processed image to ${outputPath}`);
  return true;
}

// CLI handling if run directly
if (process.argv[1].endsWith('extract-black.js')) {
  const args = process.argv.slice(2);
  const input = args[0];
  const output = args[1];
  const color = args[2] || 'white';
  
  if (!input || !output) {
    console.log('Usage: node scripts/extract-black.js [input.jpg] [output.png] [color]');
    process.exit(1);
  }

  extractBlack(input, output, color)
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export { extractBlack };
