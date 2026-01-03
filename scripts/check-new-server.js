require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const GUILD_ID = '1182395170273099806';

async function check() {
  try {
    // Vérifier guild_config
    const config = await pool.query(
      'SELECT guild_id, guild_name, owner_id, is_active, is_trial FROM guild_config WHERE guild_id = $1',
      [GUILD_ID]
    );

    console.log('📋 Guild Config pour serveur', GUILD_ID + ':');

    if (config.rows.length > 0) {
      const row = config.rows[0];
      console.log('   guild_name:', row.guild_name);
      console.log('   owner_id:', row.owner_id);
      console.log('   is_active:', row.is_active);
      console.log('   is_trial:', row.is_trial);
    } else {
      console.log('❌ Serveur NON TROUVÉ dans guild_config');
      console.log('   Le bot doit être réinvité ou le serveur enregistré manuellement');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
