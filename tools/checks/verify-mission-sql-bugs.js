const fs = require('fs');
const path = require('path');

/**
 * Script de vérification des bugs SQL dans missionHandler.js
 */

console.log('🔍 VÉRIFICATION DES BUGS SQL DANS MISSIONHANDLER.JS\n');
console.log('='.repeat(80));

const filePath = path.join(__dirname, 'handlers', 'missionHandler.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Pattern recherché : guild_id = (SELECT guild_id FROM ... WHERE id = $X (sans fermeture)
const bugPattern = /guild_id\s*=\s*\(SELECT\s+guild_id\s+FROM\s+\w+\s+WHERE\s+id\s*=\s*\$\d+(?!\))/gi;

// Rechercher les lignes avec le bug
const bugsFound = [];
lines.forEach((line, index) => {
  if (bugPattern.test(line)) {
    bugsFound.push({
      line: index + 1,
      content: line.trim()
    });
  }
});

console.log(`\n📊 RÉSULTAT DE L'ANALYSE:`);
console.log(`   Fichier: handlers/missionHandler.js`);
console.log(`   Total de lignes: ${lines.length}`);
console.log(`   Bugs SQL trouvés: ${bugsFound.length}\n`);

if (bugsFound.length > 0) {
  console.log('❌ BUGS SQL IDENTIFIÉS:\n');

  bugsFound.forEach((bug, i) => {
    console.log(`   ${i + 1}. Ligne ${bug.line}`);
    console.log(`      Code: ${bug.content.substring(0, 100)}...`);
    console.log('');
  });

  console.log('\n🔧 CORRECTION RECOMMANDÉE:');
  console.log('   Remplacer ces requêtes complexes par une simple condition WHERE:');
  console.log('   AVANT: SET ... , guild_id = (SELECT guild_id FROM mission_progress WHERE id = $2');
  console.log('   APRÈS: SET ... WHERE id = $2');
  console.log('');
  console.log('   OU si vous devez garder guild_id:');
  console.log('   APRÈS: SET ... WHERE guild_id = (SELECT guild_id FROM mission_progress WHERE id = $2) AND id = $2');

} else {
  console.log('✅ Aucun bug SQL de ce type trouvé !');
}

// Vérifier aussi les appels de fonctions sans guildId
console.log('\n' + '='.repeat(80));
console.log('\n🔍 VÉRIFICATION DES APPELS DE FONCTIONS SANS GUILDID:\n');

const bugs2Found = [];

// Rechercher db.addCollectible sans 3 paramètres dans le contexte de approveMission
lines.forEach((line, index) => {
  // Rechercher db.addCollectible avec seulement 2 paramètres
  if (line.includes('db.addCollectible') && !line.includes('interaction.guildId') && !line.includes('guildId,')) {
    bugs2Found.push({
      line: index + 1,
      content: line.trim(),
      type: 'addCollectible'
    });
  }

  // Rechercher db.incrementProgress avec seulement 2 paramètres
  if (line.includes('db.incrementProgress') && !line.includes('interaction.guildId') && !line.includes('guildId,') && !line.includes('// ')) {
    bugs2Found.push({
      line: index + 1,
      content: line.trim(),
      type: 'incrementProgress'
    });
  }
});

if (bugs2Found.length > 0) {
  console.log(`❌ ${bugs2Found.length} appel(s) de fonction sans guildId trouvé(s):\n`);

  bugs2Found.forEach((bug, i) => {
    console.log(`   ${i + 1}. Ligne ${bug.line} (${bug.type})`);
    console.log(`      Code: ${bug.content}`);
    console.log('');
  });

  console.log('\n🔧 CORRECTION RECOMMANDÉE:');
  console.log('   Ajouter interaction.guildId comme premier paramètre:');
  console.log('   AVANT: db.addCollectible(player.id, randomCollectible.id)');
  console.log('   APRÈS: db.addCollectible(interaction.guildId, player.id, randomCollectible.id)');
  console.log('');
  console.log('   AVANT: db.incrementProgress(player.id, progressData.theme_id)');
  console.log('   APRÈS: db.incrementProgress(interaction.guildId, player.id, progressData.theme_id)');
} else {
  console.log('✅ Tous les appels de fonctions semblent corrects !');
}

// Résumé final
console.log('\n' + '='.repeat(80));
console.log('\n📋 RÉSUMÉ:\n');

const totalBugs = bugsFound.length + bugs2Found.length;

if (totalBugs > 0) {
  console.log(`   ❌ ${totalBugs} bug(s) critique(s) identifié(s)`);
  console.log(`      - ${bugsFound.length} requête(s) SQL malformée(s)`);
  console.log(`      - ${bugs2Found.length} appel(s) de fonction sans guildId`);
  console.log('');
  console.log('   ⚠️ ACTION REQUISE: Ces bugs doivent être corrigés avant utilisation !');
  console.log('   📄 Voir RAPPORT_ANALYSE_MISSIONS.md pour les détails complets.');
} else {
  console.log('   ✅ Aucun bug critique détecté !');
  console.log('   Le système de missions semble fonctionnel.');
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Analyse terminée\n');

process.exit(totalBugs > 0 ? 1 : 0);
