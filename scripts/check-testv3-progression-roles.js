/**
 * Vérification des rôles de progression pour testv3
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Vérification des rôles de progression - testv3');
  console.log('='.repeat(60));

  try {
    // 1. Récupérer le thème
    const theme = await db.queryOne(`
      SELECT id, theme_id, name, guild_id FROM themes WHERE theme_id = 'testv3'
    `);

    if (!theme) {
      console.log('❌ Thème testv3 non trouvé');
      process.exit(1);
    }

    console.log(`\n📋 Thème: ${theme.name} (ID: ${theme.id}, Guild: ${theme.guild_id})`);

    // 2. Vérifier les rôles de progression
    const roles = await db.queryAll(`
      SELECT * FROM progression_roles
      WHERE theme_id = $1
      ORDER BY percentage
    `, [theme.id]);

    console.log(`\n🏆 Rôles de progression: ${roles.length}`);

    if (roles.length === 0) {
      console.log('\n❌ PROBLÈME: Aucun rôle de progression configuré pour ce thème!');
      console.log('   Les rôles de progression doivent être créés dans le Theme Builder');
      console.log('   ou importés avec le thème.');
    } else {
      console.log('\n   Rôles configurés:');
      for (const role of roles) {
        const hasDiscordId = role.discord_role_id && role.discord_role_id.trim() !== '';
        const status = hasDiscordId ? '✅' : '⚠️';
        console.log(`   ${status} ${role.percentage}% - ${role.role_name} (Discord ID: ${role.discord_role_id || 'NON CONFIGURÉ'})`);
      }
    }

    // 3. Vérifier la progression du joueur
    console.log('\n📊 Vérification progression joueurs sur ce serveur:');

    const players = await db.queryAll(`
      SELECT p.discord_id, p.username, pp.collected_count, pp.total_collectibles
      FROM players p
      JOIN player_progress pp ON p.id = pp.player_id
      WHERE p.guild_id = $1 AND pp.theme_id = $2
      ORDER BY pp.collected_count DESC
      LIMIT 5
    `, [theme.guild_id, theme.id]);

    if (players.length === 0) {
      console.log('   Aucun joueur avec progression sur ce thème');
    } else {
      for (const p of players) {
        const pct = p.total_collectibles > 0 ? Math.round((p.collected_count / p.total_collectibles) * 100) : 0;
        console.log(`   - ${p.username}: ${p.collected_count}/${p.total_collectibles} (${pct}%)`);
      }
    }

    // 4. Vérifier le nombre total de collectibles
    const collectibleCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM collectibles WHERE theme_id = $1
    `, [theme.id]);

    console.log(`\n📦 Collectibles dans ce thème: ${collectibleCount.count}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
