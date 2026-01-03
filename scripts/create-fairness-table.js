require('dotenv').config();
const db = require('../utils/database-pg');

async function createFairnessTable() {
  try {
    console.log('🔧 Création de la table fairness_config...\n');

    // Créer la table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fairness_config (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT false,
        show_countdown BOOLEAN DEFAULT true,
        exempt_roles TEXT[] DEFAULT '{}',
        steps JSONB DEFAULT '[
          {"min": 0, "max": 25, "delay": 0},
          {"min": 26, "max": 50, "delay": 5},
          {"min": 51, "max": 75, "delay": 10},
          {"min": 76, "max": 99, "delay": 12},
          {"min": 100, "max": 100, "delay": 15}
        ]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id)
      )
    `);

    console.log('✅ Table fairness_config créée avec succès !');

    // Vérifier la structure
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'fairness_config'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Structure de la table :');
    console.table(columns);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createFairnessTable();
