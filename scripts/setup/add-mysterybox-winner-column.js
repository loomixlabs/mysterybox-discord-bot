const db = require('./utils/database-pg');

async function addColumn() {
  try {
    console.log('🔄 Ajout de la colonne mystery_box_winner_message...');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS mystery_box_winner_message TEXT DEFAULT '🎉 **{player}** a ouvert la boîte mystère !';
    `);

    console.log('✅ Colonne mystery_box_winner_message ajoutée avec succès !');

    // Vérifier que la colonne existe
    const result = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='theme_config' AND column_name='mystery_box_winner_message';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Vérification OK:', result.rows[0]);
    } else {
      console.log('⚠️ La colonne n\'a pas été trouvée après création');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addColumn();
