const fs = require('fs');
const path = require('path');

async function analyzeRoleAttributionSystem() {
  console.log('🔍 ANALYSE - Système d\'attribution automatique des rôles\n');
  console.log('='.repeat(80));

  // 1. Chercher dans database-pg.js les fonctions liées aux rôles
  console.log('\n📋 ÉTAPE 1: Fonctions database-pg.js\n');

  const dbFile = fs.readFileSync('utils/database-pg.js', 'utf-8');
  const roleFunctions = [];

  const functionPattern = /async\s+(\w+)\s*\([^)]*\)\s*{[^}]*(?:role|completion|complété)/gi;
  let match;
  while ((match = functionPattern.exec(dbFile)) !== null) {
    roleFunctions.push(match[1]);
  }

  if (roleFunctions.length > 0) {
    console.log('Fonctions trouvées liées aux rôles:');
    roleFunctions.forEach(f => console.log(`   - ${f}()`));
  } else {
    console.log('❌ Aucune fonction trouvée dans database-pg.js');
  }

  // 2. Chercher dans mysteryBoxHandler.js
  console.log('\n' + '='.repeat(80));
  console.log('\n📦 ÉTAPE 2: mysteryBoxHandler.js\n');

  const mysteryBoxFile = fs.readFileSync('handlers/mysteryBoxHandler.js', 'utf-8');

  // Chercher les appels à member.roles.add
  const rolesAddMatches = mysteryBoxFile.match(/member\.roles\.add\([^)]+\)/g);
  if (rolesAddMatches) {
    console.log(`✅ Trouvé ${rolesAddMatches.length} appel(s) à member.roles.add()`);
    rolesAddMatches.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
  } else {
    console.log('❌ Aucun appel à member.roles.add() trouvé');
  }

  // Chercher les vérifications de complétion
  const completionPattern = /(?:collectedCount|collected_count)\s*(?:>=|===)\s*(?:requiredItems|required_items)/gi;
  const completionMatches = mysteryBoxFile.match(completionPattern);
  if (completionMatches) {
    console.log(`\n✅ Trouvé ${completionMatches.length} vérification(s) de complétion`);
  } else {
    console.log('\n❌ Aucune vérification de complétion trouvée');
  }

  // 3. Chercher dans giveHandler.js (déprécié mais peut contenir du code)
  console.log('\n' + '='.repeat(80));
  console.log('\n📦 ÉTAPE 3: giveHandler.js (DÉPRÉCIÉ)\n');

  const giveHandlerFile = fs.readFileSync('handlers/giveHandler.js', 'utf-8');
  const giveRolesAdd = giveHandlerFile.match(/member\.roles\.add\([^)]+\)/g);
  if (giveRolesAdd) {
    console.log(`✅ Trouvé ${giveRolesAdd.length} appel(s) à member.roles.add() dans giveHandler`);
  } else {
    console.log('❌ Aucun appel à member.roles.add() dans giveHandler');
  }

  // 4. Chercher dans utils/database-pg.js les méthodes updatePlayerProgress
  console.log('\n' + '='.repeat(80));
  console.log('\n🔍 ÉTAPE 4: Recherche dans database-pg.js\n');

  const updateProgressPattern = /async\s+updatePlayerProgress\s*\([^)]*\)\s*{[\s\S]*?^  }/gm;
  const updateProgressMatch = dbFile.match(updateProgressPattern);

  if (updateProgressMatch) {
    console.log('✅ Fonction updatePlayerProgress() trouvée\n');
    console.log('Extrait de la fonction:');
    const extract = updateProgressMatch[0].substring(0, 500);
    console.log(extract + '...\n');
  } else {
    console.log('❌ Fonction updatePlayerProgress() NON trouvée');
  }

  // 5. Chercher addCollectible
  const addCollectiblePattern = /async\s+addCollectible\s*\([^)]*\)\s*{[\s\S]{0,1000}/;
  const addCollectibleMatch = dbFile.match(addCollectiblePattern);

  if (addCollectibleMatch) {
    console.log('='.repeat(80));
    console.log('\n✅ Fonction addCollectible() trouvée\n');
    console.log('Début de la fonction:');
    console.log(addCollectibleMatch[0] + '...\n');
  }

  // 6. Résumé et conclusion
  console.log('='.repeat(80));
  console.log('\n🎯 RÉSUMÉ\n');

  console.log('Attribution automatique du rôle:');
  if (!rolesAddMatches && !giveRolesAdd) {
    console.log('   ❌ AUCUN APPEL à member.roles.add() trouvé dans les handlers');
    console.log('   ❌ Le système d\'attribution automatique est MANQUANT');
    console.log('\n💡 PROBLÈME IDENTIFIÉ:');
    console.log('   Le code ne contient PAS de logique pour attribuer le rôle');
    console.log('   quand la collection est complétée.\n');
    console.log('✅ SOLUTION:');
    console.log('   1. Ajouter dans mysteryBoxHandler.js (après ajout collectible):');
    console.log('      - Vérifier si collected_count >= required_items');
    console.log('      - Si oui, récupérer final_role_discord_id depuis themes');
    console.log('      - Appeler member.roles.add(roleId)');
    console.log('      - Mettre à jour player_progress.role_attributed = TRUE\n');
  } else {
    console.log('   ✅ Code d\'attribution trouvé dans les handlers');
    console.log('   ⚠️  MAIS: final_role_discord_id est NULL dans la DB');
    console.log('   ⚠️  Le rôle n\'a jamais été créé pour le thème actif\n');
  }

  console.log('='.repeat(80));
}

analyzeRoleAttributionSystem().catch(console.error);
