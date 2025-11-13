const db = require('./utils/database-pg');

async function createAppleGameTable() {
  try {
    console.log('🍎 Création de la table apple_game_winners...\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS apple_game_winners (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        won_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, guild_id)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_apple_game_winners_user
      ON apple_game_winners(user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_apple_game_winners_guild
      ON apple_game_winners(guild_id)
    `);

    console.log('✅ Table apple_game_winners créée avec succès !');

    // Vérifier
    const count = await db.queryOne(`
      SELECT COUNT(*) as total FROM apple_game_winners
    `);

    console.log(`📊 Total de gagnants actuels: ${count.total}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createAppleGameTable();
