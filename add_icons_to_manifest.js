#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if all icon files exist
const iconSizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

console.log('🔍 Checking for icon files...');

let allIconsExist = true;
const missingIcons = [];

iconSizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    if (!fs.existsSync(iconPath)) {
        allIconsExist = false;
        missingIcons.push(`icon${size}.png`);
    } else {
        console.log(`✅ Found: icon${size}.png`);
    }
});

if (!allIconsExist) {
    console.log('\n❌ Missing icon files:');
    missingIcons.forEach(icon => console.log(`   - ${icon}`));
    console.log('\n📋 To fix this:');
    console.log('1. Open create_icons.html in your browser');
    console.log('2. Download all 4 icon files');
    console.log('3. Save them in the icons/ folder');
    console.log('4. Run this script again');
    process.exit(1);
}

console.log('\n🎉 All icon files found!');

// Update manifest.json
const manifestPath = path.join(__dirname, 'manifest.json');

try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
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
    
    // Write updated manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log('✅ Updated manifest.json with icon references');
    console.log('\n🚀 Next steps:');
    console.log('1. Go to chrome://extensions/');
    console.log('2. Click the refresh button on your "One Click QR" extension');
    console.log('3. Your custom icons should now appear!');
    
} catch (error) {
    console.error('❌ Error updating manifest.json:', error.message);
    process.exit(1);
}

console.log('\n🎨 Icon integration complete!'); 