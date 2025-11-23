require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function restoreTrial() {
  try {
    // Mettre la date d'expiration à dans 3 jours
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);

    const result = await pool.query(`
      UPDATE guild_config
      SET trial_expires_at = $1
      WHERE guild_id = $2
      RETURNING guild_id, guild_name, trial_expires_at, is_active
    `, [in3Days, '1439293457754488905']);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('✅ Trial restauré pour:', row.guild_name);
      console.log('   Nouvelle date expiration:', row.trial_expires_at);
      console.log('   Is active:', row.is_active);
    } else {
      console.log('❌ Serveur non trouvé');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

restoreTrial();
