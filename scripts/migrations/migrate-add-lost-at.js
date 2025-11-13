const db = require('./utils/database-pg');
require('dotenv').config();

async function migrate() {
  try {
    console.log('🔄 Migration: Ajout de la colonne lost_at...\n');

    // Ajouter la colonne lost_at
    await db.query(`
      ALTER TABLE collections
      ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP DEFAULT NULL
    `);
    console.log('✅ Colonne lost_at ajoutée');

    // Créer l'index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_collections_lost_at ON collections(lost_at)
    `);
    console.log('✅ Index créé');

    // Vérifier la structure
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'collections'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Structure de la table collections:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

migrate();
