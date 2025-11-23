require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const result = await pool.query(
      'SELECT guild_id, guild_name, is_active, is_trial, trial_expires_at, owner_id FROM guild_config WHERE guild_id = $1',
      ['1439293457754488905']
    );

    console.log('📊 État du serveur Loomix-labs:\n');
    console.table(result.rows);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('\n📋 Détails:');
      console.log('   is_active:', row.is_active);
      console.log('   is_trial:', row.is_trial);
      console.log('   trial_expires_at:', row.trial_expires_at);
      console.log('   owner_id:', row.owner_id);

      if (row.trial_expires_at) {
        const expiresAt = new Date(row.trial_expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        console.log('\n   ⏰ Jours restants:', daysLeft);
      }
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
