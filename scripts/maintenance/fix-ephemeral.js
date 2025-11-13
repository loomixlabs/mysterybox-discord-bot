/**
 * Script pour remplacer tous les ephemeral: true par flags: 64
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/adminPanelHandler.js');
let content = fs.readFileSync(filePath, 'utf8');

// Compter les occurrences
const countBefore = (content.match(/ephemeral:\s*true/g) || []).length;

// Remplacer ephemeral: true par flags: 64
content = content.replace(/ephemeral:\s*true/g, 'flags: 64');

// Remplacer { ephemeral: true } par { flags: 64 }
content = content.replace(/\{\s*ephemeral:\s*true\s*\}/g, '{ flags: 64 }');

// Compter après
const countAfter = (content.match(/ephemeral:\s*true/g) || []).length;

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ ${countBefore} occurrences remplacées`);
console.log(`   ephemeral: true → flags: 64`);
console.log(`   Restant: ${countAfter}`);
