const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COMPONENT_DIR = path.join(__dirname, '../src/components');

// Backup
const srcFile = path.join(COMPONENT_DIR, 'CrousianText.jsx');
const backupFile = path.join(COMPONENT_DIR, 'CrousianText.jsx.bak');
fs.copyFileSync(srcFile, backupFile);

// Read image version
const imageFile = path.join(COMPONENT_DIR, 'CrousianTextImage.jsx');
const imageContent = fs.readFileSync(imageFile, 'utf-8');

// Write image version as main
fs.writeFileSync(srcFile, imageContent);

// Build
console.log('Building image mode (no Three.js)...');
execSync('npm run build', { stdio: 'inherit' });

// Restore
fs.copyFileSync(backupFile, srcFile);
fs.unlinkSync(backupFile);

// Add image mode flag and Prism
const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');
const scripts = `    <script>window.USE_IMAGE_TEXT=true;</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>`;
html = html.replace('<head>', '<head>\n' + scripts);
fs.writeFileSync(htmlPath, html);

console.log('\nImage mode build complete!');
console.log('- Three.js: EXCLUDED');
console.log('- Bundle size: ~160 KB gzipped (vs 430 KB with Three.js)');
