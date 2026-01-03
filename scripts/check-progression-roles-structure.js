/**
 * Vérifie la structure nécessaire pour les progression_roles
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 VÉRIFICATION STRUCTURE PROGRESSION_ROLES\n');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier la structure de theme_config
    console.log('\n📊 1. Structure de theme_config:');
    const themeConfigColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);
    console.table(themeConfigColumns);

    // 2. Vérifier s'il existe une colonne progression_roles
    const hasProgressionRoles = themeConfigColumns.some(c => c.column_name === 'progression_roles');
    console.log(`\n✅ Colonne progression_roles existe: ${hasProgressionRoles ? 'OUI' : 'NON'}`);

    // 3. Compter les collectibles d'un joueur
    console.log('\n📊 2. Exemple de comptage de collection pour un joueur:');
    const testQuery = await db.queryAll(`
      SELECT
        c.player_id,
        p.username,
        c.theme_id,
        COUNT(DISTINCT c.collectible_id) as unique_collectibles
      FROM collections c
      JOIN players p ON c.player_id = p.id
      WHERE c.guild_id = $1
        AND c.lost_at IS NULL
      GROUP BY c.player_id, p.username, c.theme_id
      ORDER BY unique_collectibles DESC
      LIMIT 5
    `, [process.env.GUILD_ID]);
    console.table(testQuery);

    // 4. Vérifier comment les themes stockent required_items
    console.log('\n📊 3. Info thème actif:');
    const activeTheme = await db.queryOne(`
      SELECT id, name, required_items, final_role_name, final_role_discord_id
      FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [process.env.GUILD_ID]);
    console.log(activeTheme);

    // 5. Vérifier theme_config actuel
    console.log('\n📊 4. Config thème actuelle:');
    if (activeTheme) {
      const themeConfig = await db.queryOne(`
        SELECT * FROM theme_config
        WHERE guild_id = $1 AND theme_id = $2
      `, [process.env.GUILD_ID, activeTheme.id]);
      console.log(themeConfig);
    }

    // 6. Vérifier si la table player_progress existe et peut stocker les rôles obtenus
    console.log('\n📊 5. Structure player_progress:');
    const playerProgressColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);
    console.table(playerProgressColumns);

    console.log('\n✅ Vérification terminée');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
