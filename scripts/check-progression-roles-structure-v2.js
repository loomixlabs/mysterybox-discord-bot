/**
 * Vérifie la structure nécessaire pour les progression_roles - v2
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 VÉRIFICATION STRUCTURE PROGRESSION_ROLES v2\n');
  console.log('='.repeat(80));

  try {
    // 1. Structure de collections
    console.log('\n📊 1. Structure de collections:');
    const collectionsColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'collections'
      ORDER BY ordinal_position
    `);
    console.table(collectionsColumns);

    // 2. Compter les collectibles d'un joueur via JOIN avec collectibles
    console.log('\n📊 2. Exemple de comptage avec thème:');
    const testQuery = await db.queryAll(`
      SELECT
        c.player_id,
        p.username,
        col.theme_id,
        t.name as theme_name,
        COUNT(DISTINCT c.collectible_id) as unique_collectibles
      FROM collections c
      JOIN players p ON c.player_id = p.id
      JOIN collectibles col ON c.collectible_id = col.id
      JOIN themes t ON col.theme_id = t.id
      WHERE c.guild_id = $1
        AND c.lost_at IS NULL
      GROUP BY c.player_id, p.username, col.theme_id, t.name
      ORDER BY unique_collectibles DESC
      LIMIT 5
    `, [process.env.GUILD_ID]);
    console.table(testQuery);

    // 3. Thème actif
    console.log('\n📊 3. Thème actif:');
    const activeTheme = await db.queryOne(`
      SELECT id, name, required_items, final_role_name, final_role_discord_id
      FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [process.env.GUILD_ID]);
    console.log(activeTheme);

    // 4. Structure player_progress
    console.log('\n📊 4. Structure player_progress:');
    const ppColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);
    console.table(ppColumns);

    // 5. Exemple player_progress
    console.log('\n📊 5. Données player_progress:');
    if (activeTheme) {
      const pp = await db.queryAll(`
        SELECT pp.*, p.username
        FROM player_progress pp
        JOIN players p ON pp.player_id = p.id
        WHERE pp.guild_id = $1 AND pp.theme_id = $2
        ORDER BY pp.collected_count DESC
        LIMIT 5
      `, [process.env.GUILD_ID, activeTheme.id]);
      console.table(pp);
    }

    console.log('\n✅ Vérification terminée');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
