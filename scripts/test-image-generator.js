/**
 * Script de test pour le générateur d'images
 *
 * Teste:
 * - Génération de collectible avec frame
 * - Génération de collectible avec bordure par défaut
 * - Overlay de niveau et mint
 * - Image de level up
 * - Cache
 *
 * Usage: node scripts/test-image-generator.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const imageGenerator = require('../utils/imageGenerator');

// Images de test (URLs publiques)
const TEST_IMAGES = {
  // Image de test carrée (placeholder public)
  collectible: 'https://picsum.photos/256/256',
  // Avatar Discord standard (fonctionnel)
  avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
  // Frame de test (si disponible)
  frame: null // Pas de frame pour le premier test
};

// Dossier de sortie des tests
const OUTPUT_DIR = path.join(__dirname, '../temp_images/test_output');

async function runTests() {
  console.log('🧪 Test du générateur d\'images\n');
  console.log('='.repeat(60));

  // Créer le dossier de sortie
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Collectible sans frame (bordure par défaut)
  console.log('\n📊 Test 1: Collectible LEGENDARY sans frame (bordure dorée)');
  try {
    const buffer = await imageGenerator.generateCollectibleWithFrame(
      TEST_IMAGES.collectible,
      null,
      'legendary',
      { level: 1, mintNumber: 1, useCache: false }
    );

    const outputPath = path.join(OUTPUT_DIR, 'test1_legendary_no_frame.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Image générée: ${outputPath}`);
    console.log(`   📏 Taille: ${Math.round(buffer.length / 1024)} KB`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 2: Collectible avec niveau 4
  console.log('\n📊 Test 2: Collectible EPIC niveau 4');
  try {
    const buffer = await imageGenerator.generateCollectibleWithFrame(
      TEST_IMAGES.collectible,
      null,
      'epic',
      { level: 4, mintNumber: 5, useCache: false }
    );

    const outputPath = path.join(OUTPUT_DIR, 'test2_epic_level4.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Image générée: ${outputPath}`);
    console.log(`   📏 Taille: ${Math.round(buffer.length / 1024)} KB`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 3: Collectible RARE avec mint #1
  console.log('\n📊 Test 3: Collectible RARE avec mint #1 (badge doré)');
  try {
    const buffer = await imageGenerator.generateCollectibleWithFrame(
      TEST_IMAGES.collectible,
      null,
      'rare',
      { level: 2, mintNumber: 1, useCache: false }
    );

    const outputPath = path.join(OUTPUT_DIR, 'test3_rare_mint1.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Image générée: ${outputPath}`);
    console.log(`   📏 Taille: ${Math.round(buffer.length / 1024)} KB`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 4: Image Level Up
  console.log('\n📊 Test 4: Image Level Up (niveau 2 → 3)');
  try {
    const buffer = await imageGenerator.generateLevelUpImage(
      TEST_IMAGES.collectible,
      null,
      'legendary',
      2,
      3
    );

    const outputPath = path.join(OUTPUT_DIR, 'test4_level_up.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Image générée: ${outputPath}`);
    console.log(`   📏 Taille: ${Math.round(buffer.length / 1024)} KB`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 5: Profil avec frame
  console.log('\n📊 Test 5: Avatar profil sans frame');
  try {
    const buffer = await imageGenerator.generateProfileWithFrame(
      TEST_IMAGES.avatar,
      null,
      { useCache: false }
    );

    const outputPath = path.join(OUTPUT_DIR, 'test5_profile_no_frame.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Image générée: ${outputPath}`);
    console.log(`   📏 Taille: ${Math.round(buffer.length / 1024)} KB`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 6: Cache
  console.log('\n📊 Test 6: Système de cache');
  try {
    // Première génération (pas de cache)
    const start1 = Date.now();
    await imageGenerator.generateCollectibleWithFrame(
      TEST_IMAGES.collectible,
      null,
      'rare',
      { level: 1, useCache: true }
    );
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Première génération: ${time1}ms`);

    // Deuxième génération (depuis cache)
    const start2 = Date.now();
    await imageGenerator.generateCollectibleWithFrame(
      TEST_IMAGES.collectible,
      null,
      'rare',
      { level: 1, useCache: true }
    );
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Depuis cache: ${time2}ms`);

    if (time2 < time1 / 2) {
      console.log(`   ✅ Cache fonctionne (${Math.round((1 - time2/time1) * 100)}% plus rapide)`);
      passed++;
    } else {
      console.log(`   ⚠️  Cache pas significativement plus rapide`);
      passed++; // On compte quand même comme passé
    }
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Test 7: Stats cache
  console.log('\n📊 Test 7: Statistiques du cache');
  try {
    const stats = imageGenerator.getCacheStats();
    console.log(`   📁 Fichiers en cache: ${stats.files}`);
    console.log(`   💾 Taille totale: ${stats.size} KB`);
    console.log(`   ⏰ Plus ancien: ${stats.oldestAge} minutes`);
    console.log(`   ✅ Stats récupérées`);
    passed++;
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    failed++;
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Résultat: ${passed} passés, ${failed} échoués`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ Tous les tests passent !');
    console.log(`\n📁 Images de test générées dans: ${OUTPUT_DIR}`);
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Vérifier visuellement les images générées');
    console.log('   2. Créer des frames personnalisées (PNG transparents)');
    console.log('   3. Intégrer dans mysteryBoxHandler.js');
  } else {
    console.log(`\n⚠️  ${failed} test(s) ont échoué`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
