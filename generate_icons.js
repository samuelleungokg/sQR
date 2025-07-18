#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple Canvas-like implementation for Node.js
function createIcon(size) {
    // Create SVG content
    const svgContent = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- QR Pattern Background -->
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  
  <!-- QR Code pattern -->
  ${generateQRPattern(size)}
  
  <!-- Main green circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.35}" fill="#4CAF50"/>
  
  <!-- White eye background -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.28}" fill="#ffffff"/>
  
  <!-- Eye outline -->
  <ellipse cx="${size/2}" cy="${size/2}" rx="${size * 0.2}" ry="${size * 0.125}" 
           fill="none" stroke="#333333" stroke-width="${Math.max(1, size/32)}"/>
  
  <!-- Iris -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.15}" fill="#2196F3"/>
  
  <!-- Pupil -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.08}" fill="#000000"/>
  
  <!-- Light reflection -->
  <circle cx="${size/2 - size*0.02}" cy="${size/2 - size*0.02}" r="${size * 0.03}" fill="#ffffff"/>
  
  <!-- Border -->
  <rect x="1" y="1" width="${size-2}" height="${size-2}" rx="${size/8}" ry="${size/8}" 
        fill="none" stroke="#4CAF50" stroke-width="${Math.max(1, size/64)}"/>
</svg>`;
    
    return svgContent;
}

function generateQRPattern(size) {
    const blockSize = Math.max(1, Math.floor(size / 16));
    const pattern = [
        "1111000010001111",
        "1001010010101001", 
        "1011010010101101",
        "1011010010101101",
        "1001010010101001",
        "1111000010001111",
        "0000000000000000",
        "0010101110101010",
        "1101010001010111",
        "0010101110101010",
        "1101010001010111",
        "0010101110101010",
        "0000000000000000",
        "1111000010001111",
        "1001010010101001",
        "1111000010001111"
    ];
    
    let rects = '';
    for (let y = 0; y < pattern.length; y++) {
        for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x] === '1') {
                rects += `<rect x="${x * blockSize}" y="${y * blockSize}" width="${blockSize}" height="${blockSize}" fill="#e8f5e9"/>`;
            }
        }
    }
    return rects;
}

function convertSVGToPNG(svgContent, filename) {
    // For this simple version, we'll save as SVG first
    // In a full implementation, you'd use a library like puppeteer or sharp to convert to PNG
    const svgFilename = filename.replace('.png', '.svg');
    fs.writeFileSync(svgFilename, svgContent);
    console.log(`Created ${svgFilename}`);
    
    // Instructions for manual conversion
    console.log(`To convert ${svgFilename} to PNG:`);
    console.log(`- Open the SVG in a browser`);
    console.log(`- Take a screenshot or use online converter`);
    console.log(`- Save as ${filename}`);
}

// Create icons directory
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

// Generate icons
const sizes = [16, 32, 48, 128];
console.log('🎨 Generating icons...');

sizes.forEach(size => {
    const svgContent = createIcon(size);
    const filename = `icon${size}.png`;
    const filepath = path.join(iconsDir, filename);
    
    // Save as SVG for now (can be converted later)
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ Generated ${svgPath}`);
});

console.log('\n🎯 Icons generated successfully!');
console.log('📁 Files saved in the icons/ directory');
console.log('🔄 Use an online SVG to PNG converter or the HTML generator to get PNG files');

// Update manifest.json
const manifestPath = path.join(__dirname, 'manifest.json');
if (fs.existsSync(manifestPath)) {
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // Add icons to manifest
        manifest.icons = {
            "16": "icons/icon16.png",
            "32": "icons/icon32.png", 
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
        };
        
        // Add icons to action
        if (manifest.action) {
            manifest.action.default_icon = {
                "16": "icons/icon16.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png", 
                "128": "icons/icon128.png"
            };
        }
        
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('✅ Updated manifest.json with icon references');
    } catch (error) {
        console.error('❌ Error updating manifest.json:', error.message);
    }
}

console.log('\n📋 Next steps:');
console.log('1. Use the HTML generator (generate_icons.html) to download PNG icons');
console.log('2. Save them in the icons/ folder');
console.log('3. Reload the extension in Chrome'); 