const db = require('./utils/database-pg');

/**
 * Script de diagnostic complet de la base de données pour Give Unique
 * Teste les performances, l'intégrité des données et les requêtes critiques
 */

const GUILD_ID = '297309737135898624';

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
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function testDatabaseConnection() {
  section('1. TEST DE CONNEXION À LA BASE DE DONNÉES');

  try {
    const start = Date.now();
    const result = await db.queryOne('SELECT NOW() as current_time, version() as pg_version');
    const duration = Date.now() - start;

    log(`✅ Connexion réussie en ${duration}ms`, 'green');
    log(`   Heure serveur PostgreSQL: ${result.current_time}`, 'blue');
    log(`   Version: ${result.pg_version.split(',')[0]}`, 'blue');

    return true;
  } catch (error) {
    log(`❌ ERREUR DE CONNEXION: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function testQueryPerformance() {
  section('2. TEST DE PERFORMANCE DES REQUÊTES CRITIQUES');

  const queries = [
    {
      name: 'getActiveTheme',
      sql: `
        SELECT * FROM themes
        WHERE guild_id = $1 AND is_active = true
        LIMIT 1
      `,
      params: [GUILD_ID]
    },
    {
      name: 'getThemeItems (mode: all)',
      sql: `
        SELECT ti.*
        FROM theme_items ti
        JOIN themes t ON ti.theme_id = t.id
        WHERE t.guild_id = $1 AND t.is_active = true
        ORDER BY ti.rarity DESC, ti.name
      `,
      params: [GUILD_ID]
    },
    {
      name: 'getThemeItems (mode: legendary)',
      sql: `
        SELECT ti.*
        FROM theme_items ti
        JOIN themes t ON ti.theme_id = t.id
        WHERE t.guild_id = $1 AND t.is_active = true
        AND ti.rarity = 'legendary'
        ORDER BY ti.name
      `,
      params: [GUILD_ID]
    },
    {
      name: 'getChannels',
      sql: `
        SELECT id, channel_id, channel_name
        FROM channels
        WHERE guild_id = $1
        ORDER BY channel_name
      `,
      params: [GUILD_ID]
    }
  ];

  const results = [];

  for (const query of queries) {
    try {
      const start = Date.now();
      const data = await db.queryAll(query.sql, query.params);
      const duration = Date.now() - start;

      results.push({ name: query.name, duration, count: data.length, success: true });

      const status = duration < 100 ? '✅' : duration < 500 ? '⚠️' : '❌';
      const colorCode = duration < 100 ? 'green' : duration < 500 ? 'yellow' : 'red';

      log(`${status} ${query.name}: ${duration}ms (${data.length} résultats)`, colorCode);
    } catch (error) {
      results.push({ name: query.name, duration: -1, count: 0, success: false, error: error.message });
      log(`❌ ${query.name}: ERREUR - ${error.message}`, 'red');
    }
  }

  // Résumé
  console.log('\n📊 Résumé des performances:');
  const avgDuration = results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.success).length;
  log(`   Temps moyen: ${avgDuration.toFixed(2)}ms`, avgDuration < 100 ? 'green' : 'yellow');
  log(`   Requêtes réussies: ${results.filter(r => r.success).length}/${results.length}`, 'blue');

  const slowQueries = results.filter(r => r.success && r.duration > 500);
  if (slowQueries.length > 0) {
    log(`   ⚠️  ${slowQueries.length} requête(s) lente(s) détectée(s) (>500ms)`, 'yellow');
    slowQueries.forEach(q => log(`      - ${q.name}: ${q.duration}ms`, 'yellow'));
  }

  return results;
}

async function verifyDataIntegrity() {
  section('3. VÉRIFICATION DE L\'INTÉGRITÉ DES DONNÉES');

  // Vérifier qu'il y a un thème actif
  const activeTheme = await db.queryOne(`
    SELECT * FROM themes
    WHERE guild_id = $1 AND is_active = true
  `, [GUILD_ID]);

  if (activeTheme) {
    log(`✅ Thème actif trouvé: "${activeTheme.name}" (ID: ${activeTheme.id})`, 'green');
  } else {
    log(`❌ AUCUN THÈME ACTIF TROUVÉ !`, 'red');
    return false;
  }

  // Vérifier les items du thème
  const themeItems = await db.queryAll(`
    SELECT rarity, COUNT(*) as count
    FROM theme_items
    WHERE theme_id = $1
    GROUP BY rarity
    ORDER BY
      CASE rarity
        WHEN 'legendary' THEN 1
        WHEN 'epic' THEN 2
        WHEN 'rare' THEN 3
        WHEN 'common' THEN 4
      END
  `, [activeTheme.id]);

  log(`\n📦 Items par rareté:`, 'blue');
  let totalItems = 0;
  themeItems.forEach(item => {
    totalItems += parseInt(item.count);
    const emoji = {
      'legendary': '🌟',
      'epic': '💜',
      'rare': '💙',
      'common': '⚪'
    }[item.rarity] || '❓';
    console.log(`   ${emoji} ${item.rarity}: ${item.count} item(s)`);
  });

  if (totalItems === 0) {
    log(`\n❌ AUCUN ITEM TROUVÉ POUR CE THÈME !`, 'red');
    return false;
  }

  log(`\n✅ Total: ${totalItems} items`, 'green');

  // Vérifier les canaux
  const channels = await db.queryAll(`
    SELECT COUNT(*) as count
    FROM channels
    WHERE guild_id = $1
  `, [GUILD_ID]);

  const channelCount = parseInt(channels[0].count);
  if (channelCount > 0) {
    log(`\n✅ ${channelCount} canal/canaux configuré(s)`, 'green');
  } else {
    log(`\n⚠️  Aucun canal configuré`, 'yellow');
  }

  return true;
}

async function testConcurrentQueries() {
  section('4. TEST DE REQUÊTES CONCURRENTES (Simulation charge)');

  log('Simulation de 5 requêtes simultanées...', 'blue');

  const start = Date.now();

  const promises = [
    db.queryOne('SELECT * FROM themes WHERE guild_id = $1 AND is_active = true', [GUILD_ID]),
    db.queryAll('SELECT * FROM theme_items WHERE theme_id IN (SELECT id FROM themes WHERE guild_id = $1 AND is_active = true)', [GUILD_ID]),
    db.queryAll('SELECT * FROM channels WHERE guild_id = $1', [GUILD_ID]),
    db.queryOne('SELECT NOW() as time'),
    db.queryOne('SELECT COUNT(*) as count FROM players WHERE guild_id = $1', [GUILD_ID])
  ];

  try {
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    log(`✅ 5 requêtes concurrentes exécutées en ${duration}ms`, duration < 500 ? 'green' : 'yellow');
    log(`   Moyenne: ${(duration / 5).toFixed(2)}ms par requête`, 'blue');
  } catch (error) {
    log(`❌ ERREUR lors des requêtes concurrentes: ${error.message}`, 'red');
    console.error(error);
  }
}

async function checkDatabaseIndexes() {
  section('5. VÉRIFICATION DES INDEX');

  const tables = ['themes', 'theme_items', 'channels', 'players'];

  for (const table of tables) {
    const indexes = await db.queryAll(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = $1
      ORDER BY indexname
    `, [table]);

    log(`\n📊 Table "${table}": ${indexes.length} index`, 'blue');
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });
  }
}

async function simulateGiveUniqueFlow() {
  section('6. SIMULATION DU FLOW GIVE UNIQUE COMPLET');

  log('Étape 1: Récupération du thème actif...', 'blue');
  const start1 = Date.now();
  const theme = await db.queryOne(`
    SELECT * FROM themes WHERE guild_id = $1 AND is_active = true
  `, [GUILD_ID]);
  const duration1 = Date.now() - start1;
  log(`   ${duration1 < 100 ? '✅' : '⚠️'} Thème récupéré en ${duration1}ms`, duration1 < 100 ? 'green' : 'yellow');

  if (!theme) {
    log('   ❌ Impossible de continuer: pas de thème actif', 'red');
    return;
  }

  log('\nÉtape 2: Récupération des items (mode: all)...', 'blue');
  const start2 = Date.now();
  const items = await db.queryAll(`
    SELECT ti.*
    FROM theme_items ti
    WHERE ti.theme_id = $1
    ORDER BY ti.rarity DESC, ti.name
  `, [theme.id]);
  const duration2 = Date.now() - start2;
  log(`   ${duration2 < 100 ? '✅' : '⚠️'} ${items.length} items récupérés en ${duration2}ms`, duration2 < 100 ? 'green' : 'yellow');

  log('\nÉtape 3: Récupération des canaux...', 'blue');
  const start3 = Date.now();
  const channels = await db.queryAll(`
    SELECT * FROM channels WHERE guild_id = $1
  `, [GUILD_ID]);
  const duration3 = Date.now() - start3;
  log(`   ${duration3 < 100 ? '✅' : '⚠️'} ${channels.length} canaux récupérés en ${duration3}ms`, duration3 < 100 ? 'green' : 'yellow');

  const totalDuration = duration1 + duration2 + duration3;
  log(`\n📊 Temps total du flow: ${totalDuration}ms`, 'magenta');

  if (totalDuration > 2000) {
    log('   ❌ CRITIQUE: Le flow dépasse 2 secondes ! Risque de timeout Discord.', 'red');
  } else if (totalDuration > 1000) {
    log('   ⚠️  ATTENTION: Le flow dépasse 1 seconde. Proche de la limite.', 'yellow');
  } else {
    log('   ✅ Performance acceptable pour les interactions Discord.', 'green');
  }
}

async function checkConnectionPool() {
  section('7. VÉRIFICATION DU POOL DE CONNEXIONS');

  try {
    const poolStats = await db.queryOne(`
      SELECT
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    log(`📊 Statistiques du pool:`, 'blue');
    console.log(`   Total connexions: ${poolStats.total_connections}`);
    console.log(`   Actives: ${poolStats.active}`);
    console.log(`   Inactives: ${poolStats.idle}`);

    if (parseInt(poolStats.active) > 10) {
      log(`   ⚠️  Nombre élevé de connexions actives`, 'yellow');
    } else {
      log(`   ✅ Pool de connexions sain`, 'green');
    }
  } catch (error) {
    log(`⚠️  Impossible de vérifier le pool: ${error.message}`, 'yellow');
  }
}

async function main() {
  try {
    log('\n' + '█'.repeat(80), 'cyan');
    log('  DIAGNOSTIC COMPLET DE LA BASE DE DONNÉES - GIVE UNIQUE', 'cyan');
    log('█'.repeat(80) + '\n', 'cyan');

    log(`🔍 Serveur cible: ${GUILD_ID}`, 'magenta');
    log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`, 'magenta');

    // Exécuter tous les tests
    const connected = await testDatabaseConnection();

    if (!connected) {
      log('\n❌ Impossible de continuer sans connexion à la base de données.', 'red');
      process.exit(1);
    }

    await testQueryPerformance();
    await verifyDataIntegrity();
    await testConcurrentQueries();
    await checkDatabaseIndexes();
    await simulateGiveUniqueFlow();
    await checkConnectionPool();

    // Résumé final
    section('✅ DIAGNOSTIC TERMINÉ');
    log('Tous les tests ont été exécutés.', 'green');
    log('Consultez les sections ci-dessus pour les détails.\n', 'green');

    process.exit(0);
  } catch (error) {
    log(`\n❌ ERREUR FATALE: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le diagnostic
main();
