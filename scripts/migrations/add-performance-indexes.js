/**
 * Migration: Ajout d'indexes de performance
 *
 * Ces indexes accélèrent les requêtes les plus fréquentes du dashboard:
 * - collections(player_id, guild_id, lost_at) - Pour les JOIN sur collections
 * - players(guild_id) - Pour filtrer par serveur
 * - player_badges(player_id, badge_id) - Pour les stats badges
 * - give_logs(guild_id, created_at) - Pour les logs récents
 */

require('dotenv').config();
const db = require('../../utils/database-pg');

const indexes = [
  // Collections - utilisé dans les JOINs avec players
  {
    name: 'idx_collections_player_guild_lost',
    table: 'collections',
    columns: 'player_id, guild_id, lost_at',
    comment: 'Optimise les JOIN collections + filter lost_at IS NULL'
  },
  // Players - filtrage par guild_id (utilisé partout)
  {
    name: 'idx_players_guild_id',
    table: 'players',
    columns: 'guild_id',
    comment: 'Optimise WHERE guild_id = $1'
  },
  // Player badges - pour les stats de badges
  {
    name: 'idx_player_badges_player_badge',
    table: 'player_badges',
    columns: 'player_id, badge_id',
    comment: 'Optimise les COUNT par badge'
  },
  // Give logs - pour les logs récents par serveur
  {
    name: 'idx_give_logs_guild_created',
    table: 'give_logs',
    columns: 'guild_id, created_at DESC',
    comment: 'Optimise ORDER BY created_at DESC'
  },
  // Mission progress - pour les missions en cours
  {
    name: 'idx_mission_progress_guild_status',
    table: 'mission_progress',
    columns: 'guild_id, status',
    comment: 'Optimise filtrage par status de mission'
  },
  // Player active bonuses - pour les bonus actifs
  {
    name: 'idx_player_active_bonuses_player_active',
    table: 'player_active_bonuses',
    columns: 'player_id, is_active',
    comment: 'Optimise WHERE is_active = true'
  },
  // Themes - pour le thème actif
  {
    name: 'idx_themes_guild_active',
    table: 'themes',
    columns: 'guild_id, is_active',
    comment: 'Optimise getActiveTheme'
  },
  // Collectibles - pour filtrer par thème
  {
    name: 'idx_collectibles_guild_theme',
    table: 'collectibles',
    columns: 'guild_id, theme_id',
    comment: 'Optimise collectibles par thème'
  }
];

async function createIndexes() {
  console.log('🔧 CRÉATION DES INDEX DE PERFORMANCE\n');
  console.log('='.repeat(60));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const index of indexes) {
    try {
      // Vérifier si l'index existe déjà
      const exists = await db.queryOne(`
        SELECT 1 FROM pg_indexes
        WHERE indexname = $1
      `, [index.name]);

      if (exists) {
        console.log(`⏭️  ${index.name} - Existe déjà`);
        skipped++;
        continue;
      }

      // Créer l'index
      const sql = `CREATE INDEX ${index.name} ON ${index.table} (${index.columns})`;
      console.log(`\n📝 ${sql}`);

      await db.query(sql);
      console.log(`✅ ${index.name} - Créé avec succès`);
      console.log(`   └─ ${index.comment}`);
      created++;

    } catch (error) {
      // Si la table n'existe pas, on skip
      if (error.message.includes('does not exist')) {
        console.log(`⚠️  ${index.name} - Table ${index.table} n'existe pas, skip`);
        skipped++;
      } else {
        console.error(`❌ ${index.name} - Erreur: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ:');
  console.log(`   ✅ Créés: ${created}`);
  console.log(`   ⏭️  Skippés: ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);

  // Analyser les tables pour mettre à jour les stats
  if (created > 0) {
    console.log('\n🔄 Mise à jour des statistiques des tables...');
    try {
      await db.query('ANALYZE');
      console.log('✅ ANALYZE terminé');
    } catch (e) {
      console.log('⚠️  ANALYZE échoué (permissions?)', e.message);
    }
  }

  process.exit(errors > 0 ? 1 : 0);
}

createIndexes().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
