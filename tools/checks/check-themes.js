require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    console.log('🔍 Vérification des thèmes...\n');

    // Récupérer tous les thèmes
    const result = await pool.query(`
      SELECT id, guild_id, theme_id, name, is_active
      FROM themes
      ORDER BY is_active DESC, id ASC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ AUCUN THÈME TROUVÉ dans la base de données !');
      console.log('   La migration SQLite → PostgreSQL n\'a peut-être pas fonctionné correctement.\n');
    } else {
      console.log(`✅ ${result.rows.length} thème(s) trouvé(s):\n`);
      result.rows.forEach((theme) => {
        const status = theme.is_active ? '✅ ACTIF' : '❌ Inactif';
        console.log(`   ${status} - ID: ${theme.id} - Guild: ${theme.guild_id} - ${theme.name}`);
      });
      console.log('');
    }

    // Vérifier le thème actif pour votre guild_id
    const guildId = process.env.GUILD_ID;
    const activeTheme = await pool.query(
      'SELECT * FROM themes WHERE guild_id = $1 AND is_active = TRUE',
      [guildId]
    );

    if (activeTheme.rows.length === 0) {
      console.log(`⚠️  AUCUN THÈME ACTIF pour guild_id: ${guildId}`);
      console.log(`   Vous devez activer un thème pour que le bot fonctionne.\n`);
    } else {
      console.log(`✅ Thème actif pour guild ${guildId}:`);
      console.log(`   Nom: ${activeTheme.rows[0].name}`);
      console.log(`   ID: ${activeTheme.rows[0].id}\n`);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
})();
