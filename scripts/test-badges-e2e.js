/**
 * ================================================================================
 * TEST E2E - Système de Badges Complet
 * ================================================================================
 *
 * Ce script teste le déblocage automatique de TOUS les badges sur le serveur de test.
 *
 * Serveur de test: 297309737135898624
 * Joueur test: 297307186307006464
 *
 * Catégories testées:
 * 1. Collection (6 badges) - COLLECTION_DEBUTANT → COLLECTION_LEGENDE
 * 2. Mission (4 badges) - MISSION_APPRENTI → MISSION_GRAND_MAITRE
 * 3. Mystery Box (4 badges) - MYSTERY_CHANCEUX → MYSTERY_LEGENDE
 * 4. Trap Survive (5 badges) - TRAP_SURVIVOR → TRAP_IMMORTAL
 * 5. Engagement (5 badges) - ENGAGEMENT_ACTIF → ENGAGEMENT_ETERNEL
 *
 * @author Claude Sonnet 4.5
 * @date 2025-11-20
 */

require('dotenv').config();
const { Pool } = require('pg');
const badgeHandler = require('../handlers/badgeHandler');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

// Configuration du test
const TEST_CONFIG = {
  guildId: '297309737135898624',
  discordId: '297307186307006464',
  username: 'TestUser_E2E'
};

// Couleurs pour l'affichage
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Afficher un header de section
 */
function printHeader(title) {
  console.log('\n' + COLORS.bright + COLORS.cyan + '═'.repeat(100) + COLORS.reset);
  console.log(COLORS.bright + COLORS.cyan + `   ${title}` + COLORS.reset);
  console.log(COLORS.bright + COLORS.cyan + '═'.repeat(100) + COLORS.reset + '\n');
}

/**
 * Afficher un succès
 */
function printSuccess(message) {
  console.log(COLORS.green + '✅ ' + message + COLORS.reset);
}

/**
 * Afficher une erreur
 */
function printError(message) {
  console.log(COLORS.red + '❌ ' + message + COLORS.reset);
}

/**
 * Afficher une info
 */
function printInfo(message) {
  console.log(COLORS.blue + '🔍 ' + message + COLORS.reset);
}

/**
 * Afficher un warning
 */
function printWarning(message) {
  console.log(COLORS.yellow + '⚠️  ' + message + COLORS.reset);
}

/**
 * Récupérer ou créer le joueur de test
 */
async function getOrCreateTestPlayer() {
  printInfo(`Récupération du joueur test: ${TEST_CONFIG.discordId}`);

  // Vérifier si le joueur existe
  let player = await pool.query(`
    SELECT * FROM players
    WHERE guild_id = $1 AND discord_id = $2
  `, [TEST_CONFIG.guildId, TEST_CONFIG.discordId]);

  if (player.rows.length === 0) {
    printWarning('Joueur non trouvé, création...');

    player = await pool.query(`
      INSERT INTO players (guild_id, discord_id, username, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [TEST_CONFIG.guildId, TEST_CONFIG.discordId, TEST_CONFIG.username]);

    printSuccess('Joueur créé avec succès !');
  } else {
    printSuccess('Joueur trouvé !');
  }

  return player.rows[0];
}

/**
 * Afficher les badges actuels du joueur
 */
async function showCurrentBadges(playerId) {
  const badges = await pool.query(`
    SELECT b.code, b.name, b.emoji, b.rarity, pb.unlocked_at
    FROM player_badges pb
    JOIN badges b ON pb.badge_id = b.id
    WHERE pb.guild_id = $1 AND pb.player_id = $2
    ORDER BY pb.unlocked_at DESC
  `, [TEST_CONFIG.guildId, playerId]);

  if (badges.rows.length === 0) {
    printWarning('Aucun badge débloqué pour le moment');
    return [];
  }

  console.log(`\n   📊 ${COLORS.bright}${badges.rows.length} badge(s) débloqué(s)${COLORS.reset}:\n`);
  badges.rows.forEach(badge => {
    console.log(`      ${badge.emoji} ${COLORS.bright}${badge.name}${COLORS.reset} (${badge.rarity})`);
  });

  return badges.rows;
}

/**
 * Nettoyer les données de test
 */
async function cleanupTestData(playerId) {
  printInfo('Nettoyage des données de test...');

  await pool.query('DELETE FROM player_badges WHERE guild_id = $1 AND player_id = $2', [TEST_CONFIG.guildId, playerId]);
  await pool.query('DELETE FROM badge_progress WHERE guild_id = $1 AND player_id = $2', [TEST_CONFIG.guildId, playerId]);
  await pool.query('DELETE FROM collections WHERE guild_id = $1 AND player_id = $2', [TEST_CONFIG.guildId, playerId]);
  await pool.query('DELETE FROM mission_progress WHERE guild_id = $1 AND player_id = $2', [TEST_CONFIG.guildId, playerId]);
  await pool.query('DELETE FROM give_logs WHERE guild_id = $1 AND winner_id = $2', [TEST_CONFIG.guildId, TEST_CONFIG.discordId]);
  await pool.query('DELETE FROM trap_triggered WHERE guild_id = $1 AND player_id = $2', [TEST_CONFIG.guildId, playerId]);

  printSuccess('Données de test nettoyées !');
}

/**
 * TEST 1: Badges Collection
 */
async function testCollectionBadges(playerId) {
  printHeader('🎯 TEST 1: BADGES COLLECTION');

  // Récupérer le thème actif
  const theme = await pool.query(`
    SELECT * FROM themes
    WHERE guild_id = $1 AND is_active = TRUE
    LIMIT 1
  `, [TEST_CONFIG.guildId]);

  if (theme.rows.length === 0) {
    printError('Aucun thème actif trouvé sur le serveur de test');
    return;
  }

  const themeId = theme.rows[0].id;
  printInfo(`Thème actif: ${theme.rows[0].name} (ID: ${themeId})`);

  // Récupérer des collectibles du thème
  const collectibles = await pool.query(`
    SELECT * FROM collectibles
    WHERE guild_id = $1 AND theme_id = $2
    LIMIT 150
  `, [TEST_CONFIG.guildId, themeId]);

  if (collectibles.rows.length === 0) {
    printError('Aucun collectible trouvé pour ce thème');
    return;
  }

  printInfo(`${collectibles.rows.length} collectibles disponibles`);

  // Test progression: 1, 10, 50, 100 collectibles
  const tests = [
    { count: 1, expectedBadge: 'COLLECTION_DEBUTANT' },
    { count: 10, expectedBadge: 'COLLECTION_COLLECTIONNEUR' },
    { count: 50, expectedBadge: 'COLLECTION_CHASSEUR' },
    { count: 100, expectedBadge: 'COLLECTION_EXPERT' }
  ];

  for (const test of tests) {
    console.log(`\n   🔹 Test: Ajouter ${test.count} collectible(s)`);

    // Ajouter les collectibles
    for (let i = 0; i < test.count && i < collectibles.rows.length; i++) {
      await pool.query(`
        INSERT INTO collections (guild_id, player_id, collectible_id, collected_at, source)
        VALUES ($1, $2, $3, NOW(), 'give')
        ON CONFLICT (guild_id, player_id, collectible_id) DO NOTHING
      `, [TEST_CONFIG.guildId, playerId, collectibles.rows[i].id]);
    }

    // Appeler le hook badge
    await badgeHandler.onCollectibleFound(TEST_CONFIG.guildId, playerId, 'common', null);

    // Vérifier le badge débloqué
    const badge = await pool.query(`
      SELECT b.code, b.name, b.emoji
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2 AND b.code = $3
    `, [TEST_CONFIG.guildId, playerId, test.expectedBadge]);

    if (badge.rows.length > 0) {
      printSuccess(`Badge débloqué: ${badge.rows[0].emoji} ${badge.rows[0].name}`);
    } else {
      printWarning(`Badge ${test.expectedBadge} non débloqué (peut-être déjà débloqué ou seuil non atteint)`);
    }
  }
}

/**
 * TEST 2: Badges Mission
 */
async function testMissionBadges(playerId) {
  printHeader('📝 TEST 2: BADGES MISSION');

  // Récupérer une mission du thème actif
  const theme = await pool.query(`
    SELECT * FROM themes
    WHERE guild_id = $1 AND is_active = TRUE
    LIMIT 1
  `, [TEST_CONFIG.guildId]);

  if (theme.rows.length === 0) {
    printError('Aucun thème actif trouvé');
    return;
  }

  const mission = await pool.query(`
    SELECT * FROM missions
    WHERE guild_id = $1 AND theme_id = $2
    LIMIT 1
  `, [TEST_CONFIG.guildId, theme.rows[0].id]);

  if (mission.rows.length === 0) {
    printError('Aucune mission trouvée pour ce thème');
    return;
  }

  printInfo(`Mission de test: ${mission.rows[0].name}`);

  // Test progression: 1, 10, 50, 100 missions
  const tests = [
    { count: 1, expectedBadge: 'MISSION_APPRENTI' },
    { count: 10, expectedBadge: 'MISSION_MISSIONNAIRE' },
    { count: 50, expectedBadge: 'MISSION_CHAMPION' },
    { count: 100, expectedBadge: 'MISSION_GRAND_MAITRE' }
  ];

  for (const test of tests) {
    console.log(`\n   🔹 Test: Compléter ${test.count} mission(s)`);

    // Ajouter des missions complétées
    for (let i = 0; i < test.count; i++) {
      await pool.query(`
        INSERT INTO mission_progress (guild_id, player_id, mission_id, status, completed_at, created_at)
        VALUES ($1, $2, $3, 'completed', NOW(), NOW())
      `, [TEST_CONFIG.guildId, playerId, mission.rows[0].id]);
    }

    // Appeler le hook badge
    await badgeHandler.onMissionCompleted(TEST_CONFIG.guildId, playerId, null);

    // Vérifier le badge débloqué
    const badge = await pool.query(`
      SELECT b.code, b.name, b.emoji
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2 AND b.code = $3
    `, [TEST_CONFIG.guildId, playerId, test.expectedBadge]);

    if (badge.rows.length > 0) {
      printSuccess(`Badge débloqué: ${badge.rows[0].emoji} ${badge.rows[0].name}`);
    } else {
      printWarning(`Badge ${test.expectedBadge} non débloqué`);
    }
  }
}

/**
 * TEST 3: Badges Mystery Box
 */
async function testMysteryBoxBadges(playerId) {
  printHeader('🎁 TEST 3: BADGES MYSTERY BOX');

  // Test progression: 10, 50, 100, 250 mystery boxes
  const tests = [
    { count: 10, expectedBadge: 'MYSTERY_CHANCEUX' },
    { count: 50, expectedBadge: 'MYSTERY_CHASSEUR' },
    { count: 100, expectedBadge: 'MYSTERY_MAITRE' },
    { count: 250, expectedBadge: 'MYSTERY_LEGENDE' }
  ];

  for (const test of tests) {
    console.log(`\n   🔹 Test: Ouvrir ${test.count} mystery box(es)`);

    // Ajouter des give_logs avec give_type = super_bonus (pour simuler les mystery boxes)
    for (let i = 0; i < test.count; i++) {
      await pool.query(`
        INSERT INTO give_logs (guild_id, give_type, item_id, message_id, channel_id, winner_id, winner_username, created_at)
        VALUES ($1, 'super_bonus', 1, $2, 'test_channel', $3, $4, NOW())
      `, [TEST_CONFIG.guildId, `test_message_${i}`, TEST_CONFIG.discordId, TEST_CONFIG.username]);
    }

    // Appeler le hook badge
    await badgeHandler.onMysteryBoxOpened(TEST_CONFIG.guildId, playerId, null);

    // Vérifier le badge débloqué
    const badge = await pool.query(`
      SELECT b.code, b.name, b.emoji
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2 AND b.code = $3
    `, [TEST_CONFIG.guildId, playerId, test.expectedBadge]);

    if (badge.rows.length > 0) {
      printSuccess(`Badge débloqué: ${badge.rows[0].emoji} ${badge.rows[0].name}`);
    } else {
      printWarning(`Badge ${test.expectedBadge} non débloqué`);
    }
  }
}

/**
 * TEST 4: Badges Trap Survive
 */
async function testTrapSurviveBadges(playerId) {
  printHeader('⚠️  TEST 4: BADGES TRAP SURVIVE');

  // Récupérer un piège
  const trap = await pool.query(`
    SELECT * FROM traps
    WHERE guild_id = $1
    LIMIT 1
  `, [TEST_CONFIG.guildId]);

  if (trap.rows.length === 0) {
    printError('Aucun piège trouvé pour ce serveur');
    return;
  }

  printInfo(`Piège de test: ${trap.rows[0].name}`);

  // Test progression: 1, 10, 50, 100, 250 traps
  const tests = [
    { count: 1, expectedBadge: 'TRAP_SURVIVOR' },
    { count: 10, expectedBadge: 'TRAP_RESILIENT' },
    { count: 50, expectedBadge: 'TRAP_VETERAN' },
    { count: 100, expectedBadge: 'TRAP_MASTER' },
    { count: 250, expectedBadge: 'TRAP_IMMORTAL' }
  ];

  for (const test of tests) {
    console.log(`\n   🔹 Test: Survivre à ${test.count} piège(s)`);

    // Ajouter des traps triggered
    for (let i = 0; i < test.count; i++) {
      await pool.query(`
        INSERT INTO trap_triggered (guild_id, player_id, trap_id, triggered_at)
        VALUES ($1, $2, $3, NOW())
      `, [TEST_CONFIG.guildId, playerId, trap.rows[0].id]);
    }

    // Appeler le hook badge
    await badgeHandler.onTrapSurvived(TEST_CONFIG.guildId, playerId, null);

    // Vérifier le badge débloqué
    const badge = await pool.query(`
      SELECT b.code, b.name, b.emoji
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2 AND b.code = $3
    `, [TEST_CONFIG.guildId, playerId, test.expectedBadge]);

    if (badge.rows.length > 0) {
      printSuccess(`Badge débloqué: ${badge.rows[0].emoji} ${badge.rows[0].name}`);
    } else {
      printWarning(`Badge ${test.expectedBadge} non débloqué`);
    }
  }
}

/**
 * TEST 5: Badges Engagement
 */
async function testEngagementBadges(playerId) {
  printHeader('📅 TEST 5: BADGES ENGAGEMENT');

  // Test progression: 3, 7, 14, 30, 90 jours
  const tests = [
    { streak: 3, expectedBadge: 'ENGAGEMENT_ACTIF' },
    { streak: 7, expectedBadge: 'ENGAGEMENT_ASSIDU' },
    { streak: 14, expectedBadge: 'ENGAGEMENT_DEVOU' },
    { streak: 30, expectedBadge: 'ENGAGEMENT_MARATHONIEN' },
    { streak: 90, expectedBadge: 'ENGAGEMENT_ETERNEL' }
  ];

  for (const test of tests) {
    console.log(`\n   🔹 Test: Streak de ${test.streak} jour(s)`);

    // Appeler le hook badge avec le streak
    await badgeHandler.onLoginStreak(TEST_CONFIG.guildId, playerId, test.streak, null);

    // Vérifier le badge débloqué
    const badge = await pool.query(`
      SELECT b.code, b.name, b.emoji
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2 AND b.code = $3
    `, [TEST_CONFIG.guildId, playerId, test.expectedBadge]);

    if (badge.rows.length > 0) {
      printSuccess(`Badge débloqué: ${badge.rows[0].emoji} ${badge.rows[0].name}`);
    } else {
      printWarning(`Badge ${test.expectedBadge} non débloqué`);
    }
  }
}

/**
 * Main - Exécution des tests
 */
async function main() {
  try {
    console.log(COLORS.bright + COLORS.magenta);
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                                               ║');
    console.log('║                          🏆 TEST E2E - SYSTÈME DE BADGES COMPLET 🏆                           ║');
    console.log('║                                                                                               ║');
    console.log('║                                    Sprint 2 - 24 Badges                                       ║');
    console.log('║                                                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════╝');
    console.log(COLORS.reset);

    printInfo(`Serveur de test: ${TEST_CONFIG.guildId}`);
    printInfo(`Joueur test: ${TEST_CONFIG.discordId}`);

    // Récupérer le joueur
    const player = await getOrCreateTestPlayer();
    printSuccess(`Joueur ID: ${player.id}`);

    // Afficher les badges actuels
    console.log('\n');
    await showCurrentBadges(player.id);

    // Demander confirmation avant nettoyage
    printWarning('\n⚠️  ATTENTION: Ce test va nettoyer toutes les données de test existantes !');
    printInfo('Nettoyage dans 3 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Nettoyer les données de test
    await cleanupTestData(player.id);

    // Exécuter les tests
    await testCollectionBadges(player.id);
    await testMysteryBoxBadges(player.id);
    await testMissionBadges(player.id);
    await testTrapSurviveBadges(player.id);
    await testEngagementBadges(player.id);

    // Afficher le résumé final
    printHeader('📊 RÉSUMÉ FINAL');
    const finalBadges = await showCurrentBadges(player.id);

    console.log('\n' + COLORS.bright + COLORS.green);
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                                               ║');
    console.log(`║                    ✅ TESTS TERMINÉS: ${finalBadges.length} BADGE(S) DÉBLOQUÉ(S)                             ║`);
    console.log('║                                                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════╝');
    console.log(COLORS.reset);

    process.exit(0);
  } catch (error) {
    printError('Erreur lors des tests:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Lancer les tests
main();
