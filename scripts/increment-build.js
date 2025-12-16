/**
 * Auto-increment build number (patch version) on each build
 * Version format: major.minor.patch (e.g., 1.0.1 -> 1.0.2)
 */

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const [major, minor, patch] = pkg.version.split('.').map(Number);

// Increment patch
const newVersion = `${major}.${minor}.${patch + 1}`;
pkg.version = newVersion;

// Write back
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`\x1b[32m[Build] Version bumped: ${major}.${minor}.${patch} → ${newVersion}\x1b[0m`);
