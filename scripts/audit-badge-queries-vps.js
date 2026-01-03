/**
 * Audit des requêtes SQL des badges contre le schéma VPS réel
 * Ce script vérifie que toutes les colonnes utilisées existent vraiment
 *
 * Usage: node scripts/audit-badge-queries-vps.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Définition des requêtes critiques utilisées par badgeHandler.js
const CRITICAL_QUERIES = [
  {
    name: 'Economy - player_currency',
    description: 'Récupération des stats Loomix',
    table: 'player_currency',
    columns: ['balance', 'total_earned', 'total_spent', 'guild_id', 'player_id', 'currency_type']
  },
  {
    name: 'Mystery Box - give_logs rarity',
    description: 'Comptage des mystery boxes par rareté',
    table: 'give_logs',
    columns: ['mystery_box_rarity', 'guild_id', 'winner_id']
  },
  {
    name: 'Collections - rarity count',
    description: 'Comptage des collectibles par rareté',
    table: 'collections',
    columns: ['guild_id', 'player_id', 'collectible_id']
  },
  {
    name: 'Collectibles - rarity info',
    description: 'Récupération de la rareté des collectibles',
    table: 'collectibles',
    columns: ['id', 'rarity', 'guild_id']
  },
  {
    name: 'Players - basic info',
    description: 'Informations joueur de base',
    table: 'players',
    columns: ['id', 'discord_id', 'guild_id']
  },
  {
    name: 'Player Badges - progression',
    description: 'Progression des badges',
    table: 'player_badges',
    columns: ['guild_id', 'player_id', 'badge_id', 'progress', 'unlocked', 'unlocked_at']
  },
  {
    name: 'Badges - definition',
    description: 'Définition des badges',
    table: 'badges',
    columns: ['id', 'code', 'condition_value', 'category', 'condition_type']
  },
  {
    name: 'Trap Triggered - tracking',
    description: 'Suivi des pièges déclenchés',
    table: 'trap_triggered',
    columns: ['guild_id', 'player_id', 'trap_id']
  },
  {
    name: 'Mission Progress - tracking',
    description: 'Progression des missions',
    table: 'mission_progress',
    columns: ['guild_id', 'player_id', 'status']
  },
  {
    name: 'Player Active Bonuses - super bonus',
    description: 'Bonus actifs des joueurs',
    table: 'player_active_bonuses',
    columns: ['guild_id', 'player_id', 'bonus_id']
  },
  {
    name: 'Login Tracking - streaks',
    description: 'Suivi des connexions',
    table: 'login_tracking',
    columns: ['guild_id', 'player_id', 'current_streak', 'longest_streak']
  }
];

async function getTableColumns(tableName) {
  try {
    const result = await db.queryAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    return result.map(r => r.column_name);
  } catch (error) {
    return null;
  }
}

async function auditQueries() {
  console.log('🔍 AUDIT DES REQUÊTES BADGES vs SCHÉMA VPS');
  console.log('='.repeat(70));
  console.log('');

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalChecks = 0;

  for (const query of CRITICAL_QUERIES) {
    console.log(`📋 ${query.name}`);
    console.log(`   ${query.description}`);
    console.log(`   Table: ${query.table}`);

    const actualColumns = await getTableColumns(query.table);

    if (actualColumns === null) {
      console.log(`   ❌ TABLE N'EXISTE PAS !`);
      totalErrors++;
      console.log('');
      continue;
    }

    let hasError = false;
    const missingCols = [];
    const foundCols = [];

    for (const col of query.columns) {
      totalChecks++;
      if (actualColumns.includes(col)) {
        foundCols.push(col);
      } else {
        missingCols.push(col);
        hasError = true;
        totalErrors++;
      }
    }

    if (hasError) {
      console.log(`   ❌ COLONNES MANQUANTES: ${missingCols.join(', ')}`);
      console.log(`   ✅ Colonnes trouvées: ${foundCols.join(', ')}`);
      console.log(`   📊 Colonnes réelles: ${actualColumns.join(', ')}`);
    } else {
      console.log(`   ✅ Toutes les colonnes existent`);
    }
    console.log('');
  }

  // Tests de requêtes réelles
  console.log('='.repeat(70));
  console.log('🧪 TESTS DE REQUÊTES RÉELLES');
  console.log('='.repeat(70));
  console.log('');

  // Test 1: Economy query
  console.log('📋 Test: Requête économie player_currency');
  try {
    const testEconomy = await db.queryOne(`
      SELECT balance, total_earned, total_spent
      FROM player_currency
      WHERE currency_type = 'loomix'
      LIMIT 1
    `);
    if (testEconomy) {
      console.log(`   ✅ Requête fonctionne - Exemple: balance=${testEconomy.balance}, earned=${testEconomy.total_earned}, spent=${testEconomy.total_spent}`);
    } else {
      console.log(`   ⚠️ Aucune donnée trouvée (table vide ?)`);
      totalWarnings++;
    }
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    totalErrors++;
  }
  console.log('');

  // Test 2: Mystery box rarity query
  console.log('📋 Test: Requête mystery_box_rarity dans give_logs');
  try {
    const testRarity = await db.queryOne(`
      SELECT mystery_box_rarity, COUNT(*) as count
      FROM give_logs
      WHERE mystery_box_rarity IS NOT NULL
      GROUP BY mystery_box_rarity
      LIMIT 1
    `);
    if (testRarity) {
      console.log(`   ✅ Requête fonctionne - Exemple: rarity=${testRarity.mystery_box_rarity}, count=${testRarity.count}`);
    } else {
      console.log(`   ⚠️ Aucune donnée avec mystery_box_rarity (give_logs vide ?)`);
      totalWarnings++;
    }
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    totalErrors++;
  }
  console.log('');

  // Test 3: Collectibles rarity query
  console.log('📋 Test: Requête rareté collectibles');
  try {
    const testCollectibles = await db.queryOne(`
      SELECT c.rarity, COUNT(*) as count
      FROM collectibles c
      WHERE c.rarity IS NOT NULL
      GROUP BY c.rarity
      LIMIT 1
    `);
    if (testCollectibles) {
      console.log(`   ✅ Requête fonctionne - Exemple: rarity=${testCollectibles.rarity}, count=${testCollectibles.count}`);
    } else {
      console.log(`   ⚠️ Aucune donnée (collectibles vide ?)`);
      totalWarnings++;
    }
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    totalErrors++;
  }
  console.log('');

  // Test 4: Join players avec give_logs
  console.log('📋 Test: Jointure players ↔ give_logs');
  try {
    const testJoin = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM give_logs gl
      JOIN players p ON gl.winner_id = p.discord_id AND gl.guild_id = p.guild_id
      LIMIT 1
    `);
    console.log(`   ✅ Jointure fonctionne - ${testJoin.count} correspondances`);
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    totalErrors++;
  }
  console.log('');

  // Test 5: Player badges structure
  console.log('📋 Test: Structure player_badges');
  try {
    const testBadges = await db.queryOne(`
      SELECT pb.progress, pb.unlocked, b.code
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      LIMIT 1
    `);
    if (testBadges) {
      console.log(`   ✅ Requête fonctionne - Exemple: code=${testBadges.code}, progress=${testBadges.progress}, unlocked=${testBadges.unlocked}`);
    } else {
      console.log(`   ⚠️ Aucun badge attribué (player_badges vide ?)`);
      totalWarnings++;
    }
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    totalErrors++;
  }
  console.log('');

  // Résumé
  console.log('='.repeat(70));
  console.log('📊 RÉSUMÉ DE L\'AUDIT');
  console.log('='.repeat(70));
  console.log(`   Vérifications effectuées: ${totalChecks}`);
  console.log(`   ❌ Erreurs: ${totalErrors}`);
  console.log(`   ⚠️ Warnings: ${totalWarnings}`);

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n🎉 TOUS LES TESTS PASSENT - Le code badge est compatible avec le schéma VPS');
  } else if (totalErrors === 0) {
    console.log('\n⚠️ ATTENTION: Pas d\'erreurs critiques mais quelques warnings');
  } else {
    console.log('\n❌ ERREURS DÉTECTÉES - Le code badge a des problèmes de compatibilité!');
  }
}

auditQueries()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
