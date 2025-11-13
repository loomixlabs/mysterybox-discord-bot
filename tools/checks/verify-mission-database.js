const db = require('./utils/database-pg');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

/**
 * Script de vérification complète de la mission "Mot Deviné"
 * Vérifie la structure de la base de données, les données existantes et les fonctions
 */

const GUILD_ID = '297309737135898624'; // ID du serveur de test

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function verifyDatabaseStructure() {
  section('1. VÉRIFICATION DE LA STRUCTURE DES TABLES');

  // Tables à vérifier
  const tables = [
    { name: 'missions', description: 'Table des missions' },
    { name: 'mission_keywords', description: 'Table des mots-clés pour missions' },
    { name: 'mission_progress', description: 'Table de progression des missions' },
    { name: 'quiz_questions', description: 'Table des questions de quiz' }
  ];

  for (const table of tables) {
    log(`\n📋 Table: ${table.name}`, 'blue');
    log(`   Description: ${table.description}`, 'blue');

    // Vérifier si la table existe
    const exists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )
    `, [table.name]);

    if (!exists.exists) {
      log(`   ❌ La table ${table.name} n'existe PAS`, 'red');
      continue;
    }

    log(`   ✅ Table existante`, 'green');

    // Récupérer la structure
    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table.name]);

    log(`   📊 Colonnes (${columns.length}):`, 'magenta');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      const maxLen = col.character_maximum_length ? ` [max: ${col.character_maximum_length}]` : '';
      console.log(`      - ${col.column_name}: ${col.data_type}${maxLen} ${nullable}`);
    });
  }
}

async function verifyMissionKeywordsData() {
  section('2. VÉRIFICATION DES DONNÉES - MISSION_KEYWORDS');

  // Compter les mots-clés par serveur
  const keywordsByGuild = await db.queryAll(`
    SELECT guild_id, COUNT(*) as count
    FROM mission_keywords
    GROUP BY guild_id
  `);

  log(`📊 Nombre de mots-clés par serveur:`, 'blue');
  for (const row of keywordsByGuild) {
    console.log(`   - Guild ${row.guild_id}: ${row.count} mot(s)-clé(s)`);
  }

  // Récupérer les mots-clés du serveur de test
  const keywords = await db.queryAll(`
    SELECT
      mk.id,
      mk.keyword,
      mk.difficulty,
      mk.target_channel_id,
      m.name as mission_name
    FROM mission_keywords mk
    JOIN missions m ON mk.mission_id = m.id
    WHERE mk.guild_id = $1
    ORDER BY mk.difficulty, mk.keyword
  `, [GUILD_ID]);

  log(`\n🔤 Mots-clés configurés pour le serveur ${GUILD_ID}:`, 'blue');
  if (keywords.length === 0) {
    log('   ⚠️  Aucun mot-clé configuré', 'yellow');
  } else {
    const difficultyEmojis = {
      'easy': '🟢',
      'medium': '🟡',
      'hard': '🔴'
    };

    keywords.forEach(kw => {
      const emoji = difficultyEmojis[kw.difficulty] || '⚪';
      const channel = kw.target_channel_id ? `(Canal: ${kw.target_channel_id})` : '(Tous canaux)';
      console.log(`   ${emoji} "${kw.keyword}" - ${kw.mission_name} ${channel}`);
    });

    // Statistiques par difficulté
    const stats = {
      easy: keywords.filter(k => k.difficulty === 'easy').length,
      medium: keywords.filter(k => k.difficulty === 'medium').length,
      hard: keywords.filter(k => k.difficulty === 'hard').length
    };

    log(`\n📈 Statistiques par difficulté:`, 'magenta');
    console.log(`   🟢 Facile:    ${stats.easy}`);
    console.log(`   🟡 Moyen:     ${stats.medium}`);
    console.log(`   🔴 Difficile: ${stats.hard}`);
  }
}

async function verifyMissions() {
  section('3. VÉRIFICATION DES MISSIONS');

  // Récupérer toutes les missions du serveur
  const missions = await db.queryAll(`
    SELECT
      m.id,
      m.name,
      m.type,
      m.theme_id,
      m.timeout,
      m.validation_type,
      m.allowed_channels,
      t.name as theme_name
    FROM missions m
    LEFT JOIN themes t ON m.theme_id = t.id
    WHERE m.guild_id = $1
    ORDER BY m.id
  `, [GUILD_ID]);

  log(`📋 Missions configurées (${missions.length}):`, 'blue');

  if (missions.length === 0) {
    log('   ⚠️  Aucune mission trouvée', 'yellow');
    return;
  }

  for (const mission of missions) {
    console.log(`\n   🎯 Mission ID ${mission.id}: ${mission.name}`);
    console.log(`      Type: ${mission.type}`);
    console.log(`      Thème: ${mission.theme_name || 'N/A'} (ID: ${mission.theme_id})`);
    console.log(`      Timeout: ${mission.timeout} minutes`);
    console.log(`      Validation: ${mission.validation_type}`);

    if (mission.allowed_channels && mission.allowed_channels.length > 0) {
      console.log(`      Canaux autorisés: ${mission.allowed_channels.length} canal(aux)`);
    } else {
      console.log(`      Canaux: Tous (pas de restriction)`);
    }

    // Si c'est une mission "Mot Deviné", compter les mots-clés
    if (mission.type === 'keyword-message') {
      const kwCount = await db.queryOne(`
        SELECT COUNT(*) as count
        FROM mission_keywords
        WHERE guild_id = $1 AND mission_id = $2
      `, [GUILD_ID, mission.id]);

      console.log(`      🔤 Mots-clés: ${kwCount.count}`);

      if (kwCount.count === 0) {
        log(`      ⚠️  ATTENTION: Aucun mot-clé configuré pour cette mission !`, 'yellow');
      }
    }
  }
}

async function verifyMissionProgress() {
  section('4. VÉRIFICATION DES PROGRESSIONS DE MISSION');

  // Compter les progressions par statut
  const progressStats = await db.queryAll(`
    SELECT
      status,
      COUNT(*) as count
    FROM mission_progress
    WHERE guild_id = $1
    GROUP BY status
  `, [GUILD_ID]);

  log(`📊 Progressions de mission par statut:`, 'blue');
  if (progressStats.length === 0) {
    log('   ℹ️  Aucune progression enregistrée', 'cyan');
  } else {
    progressStats.forEach(stat => {
      const emoji = {
        'in_progress': '⏳',
        'completed': '✅',
        'failed': '❌',
        'submitted': '📤'
      }[stat.status] || '❓';
      console.log(`   ${emoji} ${stat.status}: ${stat.count}`);
    });
  }

  // Vérifier s'il y a des missions actives
  const activeKeywordMissions = await db.queryAll(`
    SELECT
      mp.*,
      m.name as mission_name,
      m.type,
      mk.keyword,
      p.username
    FROM mission_progress mp
    JOIN missions m ON mp.mission_id = m.id
    LEFT JOIN mission_keywords mk ON mk.keyword = mp.target_keyword AND mk.guild_id = mp.guild_id
    LEFT JOIN players p ON p.id = mp.player_id
    WHERE mp.guild_id = $1
      AND mp.status = 'in_progress'
      AND m.type = 'keyword-message'
  `, [GUILD_ID]);

  if (activeKeywordMissions.length > 0) {
    log(`\n🔄 Missions "Mot Deviné" en cours (${activeKeywordMissions.length}):`, 'yellow');
    activeKeywordMissions.forEach(mp => {
      console.log(`   - ${mp.username}: "${mp.keyword}" (expire: ${mp.expires_at})`);
    });
  } else {
    log(`\n✅ Aucune mission "Mot Deviné" en cours`, 'green');
  }
}

async function testDatabaseFunctions() {
  section('5. TEST DES FONCTIONS DE BASE DE DONNÉES');

  try {
    // Test 1: getMissionsByTheme
    log('🧪 Test: getMissionsByTheme()', 'blue');
    const testThemeId = 1; // ID du thème de test
    const missions = await db.getMissionsByTheme(GUILD_ID, testThemeId);
    log(`   ✅ Résultat: ${missions.length} mission(s) trouvée(s) pour le thème ${testThemeId}`, 'green');

    if (missions.length > 0) {
      // Test 2: getActiveKeywordMissions (simulé)
      log('\n🧪 Test: getActiveKeywordMissions()', 'blue');
      const testChannelId = '1234567890'; // ID de canal fictif
      const testKeyword = 'test';
      const activeMissions = await db.getActiveKeywordMissions(GUILD_ID, testChannelId, testKeyword);
      log(`   ✅ Résultat: ${activeMissions.length} mission(s) active(s) trouvée(s)`, 'green');

      // Test 3: getMissionById
      log('\n🧪 Test: getMissionById()', 'blue');
      const missionId = missions[0].id;
      const mission = await db.getMissionById(GUILD_ID, missionId);
      if (mission) {
        log(`   ✅ Mission trouvée: ${mission.name}`, 'green');
      } else {
        log(`   ❌ Mission introuvable`, 'red');
      }
    }

    // Test 4: Vérifier l'isolation multi-serveur
    log('\n🧪 Test: Isolation multi-serveur', 'blue');
    const fakeGuildId = '999999999999999999';
    const fakeMissions = await db.getMissionsByTheme(fakeGuildId, testThemeId);
    if (fakeMissions.length === 0) {
      log(`   ✅ Isolation confirmée: Aucune mission retournée pour un autre serveur`, 'green');
    } else {
      log(`   ⚠️  ATTENTION: ${fakeMissions.length} missions retournées pour un autre serveur !`, 'yellow');
    }

  } catch (error) {
    log(`   ❌ Erreur lors des tests: ${error.message}`, 'red');
    console.error(error);
  }
}

async function verifyDatabaseIntegrity() {
  section('6. VÉRIFICATION DE L\'INTÉGRITÉ DES DONNÉES');

  // Vérifier les missions sans mots-clés
  const missionsWithoutKeywords = await db.queryAll(`
    SELECT m.id, m.name, m.type
    FROM missions m
    WHERE m.guild_id = $1
      AND m.type = 'keyword-message'
      AND NOT EXISTS (
        SELECT 1 FROM mission_keywords mk
        WHERE mk.mission_id = m.id AND mk.guild_id = m.guild_id
      )
  `, [GUILD_ID]);

  if (missionsWithoutKeywords.length > 0) {
    log(`⚠️  Missions "Mot Deviné" sans mots-clés (${missionsWithoutKeywords.length}):`, 'yellow');
    missionsWithoutKeywords.forEach(m => {
      console.log(`   - Mission ID ${m.id}: ${m.name}`);
    });
  } else {
    log(`✅ Toutes les missions "Mot Deviné" ont au moins un mot-clé`, 'green');
  }

  // Vérifier les mots-clés sans mission
  const orphanKeywords = await db.queryAll(`
    SELECT mk.id, mk.keyword, mk.mission_id
    FROM mission_keywords mk
    WHERE mk.guild_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM missions m
        WHERE m.id = mk.mission_id AND m.guild_id = mk.guild_id
      )
  `, [GUILD_ID]);

  if (orphanKeywords.length > 0) {
    log(`\n⚠️  Mots-clés orphelins (sans mission) (${orphanKeywords.length}):`, 'yellow');
    orphanKeywords.forEach(kw => {
      console.log(`   - Keyword ID ${kw.id}: "${kw.keyword}" (mission_id: ${kw.mission_id})`);
    });
  } else {
    log(`\n✅ Aucun mot-clé orphelin`, 'green');
  }

  // Vérifier les progressions expirées mais toujours actives
  const expiredProgress = await db.queryAll(`
    SELECT mp.id, mp.player_id, mp.expires_at, m.name as mission_name
    FROM mission_progress mp
    JOIN missions m ON mp.mission_id = m.id
    WHERE mp.guild_id = $1
      AND mp.status = 'in_progress'
      AND mp.expires_at IS NOT NULL
      AND mp.expires_at < NOW()
  `, [GUILD_ID]);

  if (expiredProgress.length > 0) {
    log(`\n⚠️  Progressions expirées mais toujours actives (${expiredProgress.length}):`, 'yellow');
    expiredProgress.forEach(mp => {
      console.log(`   - Progress ID ${mp.id}: ${mp.mission_name} (expiré: ${mp.expires_at})`);
    });
  } else {
    log(`\n✅ Aucune progression expirée en attente`, 'green');
  }
}

async function main() {
  try {
    log('\n' + '█'.repeat(60), 'cyan');
    log('  SCRIPT DE VÉRIFICATION - MISSION "MOT DEVINÉ"', 'cyan');
    log('█'.repeat(60) + '\n', 'cyan');

    log(`🔍 Serveur cible: ${GUILD_ID}`, 'magenta');
    log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`, 'magenta');

    // Exécuter toutes les vérifications
    await verifyDatabaseStructure();
    await verifyMissionKeywordsData();
    await verifyMissions();
    await verifyMissionProgress();
    await testDatabaseFunctions();
    await verifyDatabaseIntegrity();

    // Résumé final
    section('✅ VÉRIFICATION TERMINÉE');
    log('Toutes les vérifications ont été exécutées avec succès.', 'green');
    log('Consultez les sections ci-dessus pour les détails.\n', 'green');

    process.exit(0);
  } catch (error) {
    log(`\n❌ ERREUR FATALE: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le script
main();
