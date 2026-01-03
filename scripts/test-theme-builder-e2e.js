/**
 * Tests E2E du Theme Builder Dashboard
 * Serveur de test: 297309737135898624
 */
const db = require('../utils/database-pg');

const TEST_GUILD_ID = '297309737135898624';

async function testThemeLoading() {
  console.log('\n📋 TEST 1: CHARGEMENT DES THÈMES\n');
  console.log('='.repeat(60));

  // 1. Lister tous les thèmes du serveur de test
  const themes = await db.queryAll(`
    SELECT id, name, is_active, created_at
    FROM themes
    WHERE guild_id = $1
    ORDER BY id
  `, [TEST_GUILD_ID]);

  console.log(`\n✅ ${themes.length} thème(s) trouvé(s):`);
  themes.forEach(t => {
    const status = t.is_active ? '🟢 ACTIF' : '⚪ inactif';
    console.log(`   [${t.id}] ${t.name} - ${status}`);
  });

  if (themes.length === 0) {
    console.log('   ⚠️  Aucun thème - création d\'un thème de test nécessaire');
    return null;
  }

  // Retourner le premier thème pour les tests suivants
  return themes[0];
}

async function testThemeDetails(themeId) {
  console.log('\n📋 TEST 2: DÉTAILS DU THÈME\n');
  console.log('='.repeat(60));

  // Charger les détails complets
  const theme = await db.queryOne(`
    SELECT * FROM themes WHERE id = $1
  `, [themeId]);

  console.log(`\n🎨 Thème: ${theme.name}`);

  // Compter les éléments
  const counts = await db.queryOne(`
    SELECT
      (SELECT COUNT(*) FROM collectibles WHERE theme_id = $1) as collectibles,
      (SELECT COUNT(*) FROM traps WHERE theme_id = $1) as traps,
      (SELECT COUNT(*) FROM missions WHERE theme_id = $1) as missions,
      (SELECT COUNT(*) FROM super_bonuses WHERE theme_id = $1) as super_bonuses,
      (SELECT COUNT(*) FROM theme_messages WHERE theme_id = $1) as messages
  `, [themeId]);

  console.log(`\n📊 Éléments du thème:`);
  console.log(`   - Collectibles: ${counts.collectibles}`);
  console.log(`   - Pièges: ${counts.traps}`);
  console.log(`   - Missions: ${counts.missions}`);
  console.log(`   - Super Bonus: ${counts.super_bonuses}`);
  console.log(`   - Messages: ${counts.messages}`);

  return counts;
}

async function testElementModification(themeId) {
  console.log('\n📋 TEST 3: MODIFICATION D\'UN ÉLÉMENT\n');
  console.log('='.repeat(60));

  // 1. Sélectionner un collectible à modifier
  const collectible = await db.queryOne(`
    SELECT * FROM collectibles
    WHERE theme_id = $1
    ORDER BY id
    LIMIT 1
  `, [themeId]);

  if (!collectible) {
    console.log('   ⚠️  Aucun collectible trouvé pour tester');
    return false;
  }

  console.log(`\n🎯 Collectible sélectionné: ${collectible.name} (ID: ${collectible.id})`);
  console.log(`   Reveal message actuel: "${collectible.reveal_message?.substring(0, 50) || 'null'}..."`);

  // 2. Modifier le reveal_message
  const testSuffix = ` [TEST ${Date.now()}]`;
  const originalMessage = collectible.reveal_message || '';
  const newMessage = originalMessage.includes('[TEST')
    ? originalMessage.replace(/\s*\[TEST \d+\]/, testSuffix)
    : originalMessage + testSuffix;

  await db.query(`
    UPDATE collectibles
    SET reveal_message = $1
    WHERE id = $2
  `, [newMessage, collectible.id]);

  console.log(`   ✅ Message modifié: "${newMessage.substring(0, 50)}..."`);

  // 3. Vérifier la modification
  const updated = await db.queryOne(`
    SELECT reveal_message FROM collectibles WHERE id = $1
  `, [collectible.id]);

  const success = updated.reveal_message === newMessage;
  console.log(`   ${success ? '✅' : '❌'} Vérification: ${success ? 'OK' : 'ÉCHEC'}`);

  return { success, collectibleId: collectible.id, originalMessage };
}

async function testDatabaseSave(themeId) {
  console.log('\n📋 TEST 4: SAUVEGARDE DANS LA DB\n');
  console.log('='.repeat(60));

  // 1. Test de création d'un nouveau collectible
  console.log('\n🆕 Test création collectible...');

  const testName = `Test Collectible ${Date.now()}`;
  const result = await db.queryOne(`
    INSERT INTO collectibles (guild_id, theme_id, collectible_id, name, rarity, image_url, reveal_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    TEST_GUILD_ID,
    themeId,
    `test-${Date.now()}`,
    testName,
    'common',
    'https://example.com/test.png',
    'Message de test'
  ]);

  console.log(`   ✅ Collectible créé avec ID: ${result.id}`);

  // 2. Vérifier qu'il existe
  const check = await db.queryOne(`
    SELECT * FROM collectibles WHERE id = $1
  `, [result.id]);

  const createSuccess = check && check.name === testName;
  console.log(`   ${createSuccess ? '✅' : '❌'} Vérification création: ${createSuccess ? 'OK' : 'ÉCHEC'}`);

  // 3. Test de mise à jour
  console.log('\n📝 Test mise à jour...');

  await db.query(`
    UPDATE collectibles
    SET name = $1, rarity = $2
    WHERE id = $3
  `, [`${testName} (modifié)`, 'rare', result.id]);

  const checkUpdate = await db.queryOne(`
    SELECT name, rarity FROM collectibles WHERE id = $1
  `, [result.id]);

  const updateSuccess = checkUpdate.rarity === 'rare';
  console.log(`   ${updateSuccess ? '✅' : '❌'} Vérification mise à jour: ${updateSuccess ? 'OK' : 'ÉCHEC'}`);

  // 4. Test de suppression
  console.log('\n🗑️  Test suppression...');

  await db.query(`DELETE FROM collectibles WHERE id = $1`, [result.id]);

  const checkDelete = await db.queryOne(`
    SELECT id FROM collectibles WHERE id = $1
  `, [result.id]);

  const deleteSuccess = !checkDelete;
  console.log(`   ${deleteSuccess ? '✅' : '❌'} Vérification suppression: ${deleteSuccess ? 'OK' : 'ÉCHEC'}`);

  return { createSuccess, updateSuccess, deleteSuccess };
}

async function testThemeBuilderTables() {
  console.log('\n📋 TEST 5: TABLES THEME BUILDER\n');
  console.log('='.repeat(60));

  const tables = [
    'theme_builder_config',
    'theme_builder_logs',
    'theme_builder_sessions',
    'theme_builder_user_quotas',
    'banned_builder_users',
    'themes_library'
  ];

  console.log('\n📊 État des tables Theme Builder:');

  for (const table of tables) {
    try {
      const result = await db.queryOne(`SELECT COUNT(*) as count FROM "${table}"`);
      console.log(`   ✅ ${table}: ${result.count} lignes`);
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
    }
  }

  // Vérifier les logs récents
  console.log('\n📜 Derniers logs Theme Builder:');
  try {
    const logs = await db.queryAll(`
      SELECT action, details, created_at
      FROM theme_builder_logs
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (logs.length === 0) {
      console.log('   ℹ️  Aucun log');
    } else {
      logs.forEach(l => {
        const date = new Date(l.created_at).toLocaleString('fr-FR');
        const details = typeof l.details === 'string' ? l.details.substring(0, 40) : JSON.stringify(l.details || {}).substring(0, 40);
        console.log(`   - [${date}] ${l.action}: ${details}...`);
      });
    }
  } catch (err) {
    console.log(`   ⚠️  Erreur lecture logs: ${err.message}`);
  }
}

async function testDataConsistency(themeId) {
  console.log('\n📋 TEST 6: COHÉRENCE DES DONNÉES\n');
  console.log('='.repeat(60));

  // 1. Vérifier les missions avec leurs questions
  console.log('\n🎯 Missions et questions:');
  const missions = await db.queryAll(`
    SELECT m.id, m.name, m.type,
           (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions,
           (SELECT COUNT(*) FROM mission_keywords k WHERE k.mission_id = m.id) as keywords
    FROM missions m
    WHERE m.theme_id = $1
    ORDER BY m.id
  `, [themeId]);

  let missionIssues = 0;
  missions.forEach(m => {
    const hasIssue = (m.type === 'quiz' && parseInt(m.questions) === 0) ||
                     (m.type === 'keyword-message' && parseInt(m.keywords) === 0);
    const status = hasIssue ? '⚠️' : '✅';
    if (hasIssue) missionIssues++;
    console.log(`   ${status} ${m.name} (${m.type}): ${m.questions} questions, ${m.keywords} keywords`);
  });

  // 2. Vérifier les collectibles avec images
  console.log('\n🖼️  Collectibles et images:');
  const collectibles = await db.queryAll(`
    SELECT id, name, rarity, image_url
    FROM collectibles
    WHERE theme_id = $1
    ORDER BY rarity, name
    LIMIT 10
  `, [themeId]);

  let imageIssues = 0;
  collectibles.forEach(c => {
    const hasImage = c.image_url && c.image_url.startsWith('http');
    const status = hasImage ? '✅' : '⚠️';
    if (!hasImage) imageIssues++;
    console.log(`   ${status} [${c.rarity}] ${c.name}`);
  });

  // 3. Vérifier les pièges
  console.log('\n⚠️  Pièges:');
  const traps = await db.queryAll(`
    SELECT id, name, type, malus_points, cooldown_duration
    FROM traps
    WHERE theme_id = $1
    ORDER BY type
    LIMIT 10
  `, [themeId]);

  traps.forEach(t => {
    const effect = t.malus_points ? `${t.malus_points} pts` : (t.cooldown_duration ? `${t.cooldown_duration}s CD` : 'N/A');
    console.log(`   ✅ [${t.type}] ${t.name}: ${effect}`);
  });

  // Résumé
  console.log('\n📊 Résumé cohérence:');
  console.log(`   - Missions avec problèmes: ${missionIssues}`);
  console.log(`   - Collectibles sans image: ${imageIssues}`);

  return { missionIssues, imageIssues };
}

async function main() {
  try {
    console.log('🧪 TESTS E2E - THEME BUILDER DASHBOARD\n');
    console.log('='.repeat(60));
    console.log(`📍 Serveur de test: ${TEST_GUILD_ID}`);
    console.log('='.repeat(60));

    // Test 1: Chargement des thèmes
    const theme = await testThemeLoading();

    if (!theme) {
      console.log('\n❌ Impossible de continuer sans thème');
      process.exit(1);
    }

    // Test 2: Détails du thème
    await testThemeDetails(theme.id);

    // Test 3: Modification d'un élément
    const modResult = await testElementModification(theme.id);

    // Test 4: Sauvegarde dans la DB
    const saveResult = await testDatabaseSave(theme.id);

    // Test 5: Tables Theme Builder
    await testThemeBuilderTables();

    // Test 6: Cohérence des données
    const consistencyResult = await testDataConsistency(theme.id);

    // Résumé final
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('='.repeat(60));

    const allTests = [
      { name: 'Chargement thèmes', success: theme !== null },
      { name: 'Modification élément', success: modResult?.success },
      { name: 'Création collectible', success: saveResult?.createSuccess },
      { name: 'Mise à jour collectible', success: saveResult?.updateSuccess },
      { name: 'Suppression collectible', success: saveResult?.deleteSuccess },
      { name: 'Cohérence missions', success: consistencyResult?.missionIssues === 0 }
    ];

    let passed = 0;
    let failed = 0;

    allTests.forEach(t => {
      const status = t.success ? '✅' : '❌';
      if (t.success) passed++;
      else failed++;
      console.log(`   ${status} ${t.name}`);
    });

    console.log(`\n📈 Résultat: ${passed}/${allTests.length} tests passés`);

    if (failed === 0) {
      console.log('\n✅ TOUS LES TESTS PASSÉS - Le Theme Builder est fonctionnel!');
    } else {
      console.log(`\n⚠️  ${failed} test(s) échoué(s) - Vérification nécessaire`);
    }

    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
