/**
 * Script pour réinitialiser tous les cooldowns des joueurs sur un serveur
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const GUILD_ID = '1182395170273099806';

async function resetCooldowns() {
  const client = await pool.connect();

  try {
    console.log(`🔄 Réinitialisation des cooldowns pour le serveur ${GUILD_ID}...\n`);

    // Vérifier les cooldowns existants avant suppression
    const before = await client.query(`
      SELECT COUNT(*) as count FROM player_cooldowns WHERE guild_id = $1
    `, [GUILD_ID]);

    console.log(`📊 Cooldowns actifs avant: ${before.rows[0].count}`);

    // Supprimer tous les cooldowns du serveur
    const result = await client.query(`
      DELETE FROM player_cooldowns WHERE guild_id = $1
      RETURNING *
    `, [GUILD_ID]);

    console.log(`🗑️  Cooldowns supprimés: ${result.rowCount}`);

    // Vérification
    const after = await client.query(`
      SELECT COUNT(*) as count FROM player_cooldowns WHERE guild_id = $1
    `, [GUILD_ID]);

    console.log(`✅ Cooldowns restants: ${after.rows[0].count}`);
    console.log('\n🎉 Tous les cooldowns ont été réinitialisés !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

resetCooldowns();
