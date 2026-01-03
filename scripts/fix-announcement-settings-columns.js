/**
 * Script pour ajouter les colonnes manquantes à announcement_settings
 * Erreur: la colonne « trap_curse » de la relation « announcement_settings » n'existe pas
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixAnnouncementSettings() {
  const client = await pool.connect();

  try {
    console.log('🔍 Vérification de la structure de announcement_settings...\n');

    // Vérifier les colonnes existantes
    const existingColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colonnes existantes:');
    existingColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    console.log('');

    // Colonnes requises pour les pièges
    const trapColumns = [
      'trap_curse',
      'trap_cooldown',
      'trap_lose_collectible',
      'trap_public_shame',
      'trap_malus_points'
    ];

    const existingColumnNames = existingColumns.rows.map(r => r.column_name);
    const missingColumns = trapColumns.filter(col => !existingColumnNames.includes(col));

    if (missingColumns.length === 0) {
      console.log('✅ Toutes les colonnes trap existent déjà!');
      return;
    }

    console.log('⚠️  Colonnes manquantes:', missingColumns.join(', '));
    console.log('\n🔧 Ajout des colonnes manquantes...\n');

    // Ajouter chaque colonne manquante
    for (const column of missingColumns) {
      try {
        await client.query(`
          ALTER TABLE announcement_settings
          ADD COLUMN IF NOT EXISTS ${column} BOOLEAN DEFAULT true
        `);
        console.log(`   ✅ Colonne ${column} ajoutée`);
      } catch (error) {
        console.error(`   ❌ Erreur pour ${column}:`, error.message);
      }
    }

    // Vérifier le résultat
    console.log('\n📋 Vérification finale...');
    const finalColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Structure finale de announcement_settings:');
    finalColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));

    console.log('\n🎉 Migration terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAnnouncementSettings();
