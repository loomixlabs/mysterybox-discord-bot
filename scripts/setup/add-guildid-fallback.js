/**
 * Script pour ajouter this._getGuildId(guildId) à toutes les méthodes
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'utils/database-pg.js');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern pour trouver les méthodes qui acceptent guildId
const methodPattern = /^(\s+async\s+\w+\(guildId[^)]*\)\s*\{)/gm;

let modifiedCount = 0;
const replacedMethods = [];

content = content.replace(methodPattern, (match, group1) => {
  // Extraire le nom de la méthode
  const methodName = match.match(/async\s+(\w+)\(/)[1];

  // Ignorer si c'est _getGuildId elle-même
  if (methodName === '_getGuildId') {
    return match;
  }

  // Vérifier si la ligne suivante contient déjà _getGuildId
  const nextLineIndex = content.indexOf(match) + match.length;
  const nextFewLines = content.substring(nextLineIndex, nextLineIndex + 200);

  if (nextFewLines.includes('this._getGuildId(guildId)')) {
    return match; // Déjà ajouté
  }

  modifiedCount++;
  replacedMethods.push(methodName);

  // Ajouter la ligne après l'ouverture de la fonction
  const indent = match.match(/^(\s+)/)[1];
  return `${group1}\n${indent}  guildId = this._getGuildId(guildId);`;
});

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ ${modifiedCount} méthode(s) modifiée(s)\n`);
console.log('Méthodes modifiées:');
replacedMethods.forEach(m => console.log(`   - ${m}()`));
