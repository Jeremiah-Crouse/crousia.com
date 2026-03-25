const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

const prismScript = '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>';

if (!html.includes('prism.min.js')) {
  html = html.replace('<meta charset="UTF-8" />', `    <script>window.USE_IMAGE_TEXT=true;</script>\n    ${prismScript}\n    <meta charset="UTF-8" />`);
}

fs.writeFileSync(htmlPath, html);
console.log('Image mode enabled in dist/index.html');
