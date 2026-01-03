require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeCompleteIntegration() {
  console.log('🔍 ANALYSE COMPLÈTE DU SYSTÈME POUR LE NOUVEAU PIÈGE\n');
  console.log('━'.repeat(100));

  try {
    // 1. Tables liées aux pièges
    console.log('\n📊 1. TABLES DE BASE DE DONNÉES\n');

    const tables = ['traps', 'give_logs', 'activity_logs', 'player_progress', 'collections'];

    for (const table of tables) {
      const structure = await db.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.log(`\n  📋 Table: ${table}`);
      structure.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });
    }

    // 2. Pièges existants pour référence
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 2. PIÈGES EXISTANTS PAR TYPE\n');

    const trapTypes = await db.query(`
      SELECT type, COUNT(*) as count,
             STRING_AGG(DISTINCT name, ', ') as examples
      FROM traps
      WHERE guild_id = $1
      GROUP BY type
    `, [GUILD_ID]);

    trapTypes.forEach(type => {
      console.log(`\n  🎯 Type: ${type.type}`);
      console.log(`     Nombre: ${type.count}`);
      console.log(`     Exemples: ${type.examples}`);
    });

    // 3. Système de logs
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 3. SYSTÈME DE LOGS\n');

    // give_logs
    const giveLogsStructure = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'give_logs'
      ORDER BY ordinal_position
    `);

    console.log('\n  📝 Table give_logs (historique des boîtes mystères):');
    giveLogsStructure.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    // activity_logs
    const activityLogsStructure = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'activity_logs'
      ORDER BY ordinal_position
    `);

    console.log('\n  📝 Table activity_logs (historique d\'activité):');
    activityLogsStructure.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    // Exemples de logs de pièges
    const trapLogs = await db.query(`
      SELECT * FROM activity_logs
      WHERE guild_id = $1 AND action = 'trap_activated'
      ORDER BY created_at DESC
      LIMIT 3
    `, [GUILD_ID]);

    console.log('\n  📜 Exemples de logs de pièges:');
    trapLogs.forEach((log, i) => {
      console.log(`\n     [${i + 1}] ${log.action} - ${log.created_at.toLocaleString()}`);
      console.log(`         Player: ${log.player_id}`);
      console.log(`         Details: ${log.details || 'N/A'}`);
    });

    // 4. Commande /profile
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 4. COMMANDE /PROFILE ET HISTORIQUE\n');

    // Structure de player_progress
    const playerProgressStructure = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);

    console.log('\n  👤 Table player_progress (progression des joueurs):');
    playerProgressStructure.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    // 5. Annonces
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 5. SYSTÈME D\'ANNONCES\n');

    const announcementTemplates = await db.query(`
      SELECT id, type, title, description
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`\n  Total: ${announcementTemplates.length} templates\n`);
    announcementTemplates.forEach((template) => {
      console.log(`  📢 ${template.type}`);
      console.log(`     Title: ${template.title}`);
      console.log(`     Description: ${template.description.substring(0, 80)}...`);
    });

    // 6. Collections
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 6. SYSTÈME DE COLLECTIONS\n');

    const collectionsStructure = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'collections'
      ORDER BY ordinal_position
    `);

    console.log('\n  📦 Table collections (collectibles des joueurs):');
    collectionsStructure.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    // Contrainte CHECK sur source
    const sourceConstraint = await db.query(`
      SELECT consrc
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass
        AND conname = 'collections_source_check'
    `);

    console.log('\n  ⚠️  Contrainte CHECK sur source:');
    if (sourceConstraint.length > 0) {
      console.log(`     ${sourceConstraint[0].consrc}`);
    }

    // 7. Exemple complet d'un piège
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 7. EXEMPLE COMPLET: PIÈGE "lose-collectible"\n');

    const exampleTrap = await db.query(`
      SELECT * FROM traps
      WHERE guild_id = $1 AND type = 'lose-collectible'
      LIMIT 1
    `, [GUILD_ID]);

    if (exampleTrap.length > 0) {
      const trap = exampleTrap[0];
      console.log('\n  Structure complète d\'un piège existant:');
      Object.keys(trap).forEach(key => {
        console.log(`     ${key.padEnd(25)}: ${trap[key]}`);
      });
    }

    // 8. Configuration des thèmes
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 8. CONFIGURATIONS DES THÈMES\n');

    const themeConfigStructure = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);

    console.log('\n  ⚙️  Table theme_config (configurations par thème):');
    themeConfigStructure.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n' + '━'.repeat(100));
    console.log('\n✅ ANALYSE TERMINÉE\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeCompleteIntegration();
