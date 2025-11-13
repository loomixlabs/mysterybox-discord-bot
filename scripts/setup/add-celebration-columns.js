const db = require('./utils/database-pg');

async function addColumns() {
  try {
    console.log('🔄 Ajout des colonnes de célébration...');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS mystery_box_celebration_gif TEXT DEFAULT 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
      ADD COLUMN IF NOT EXISTS mystery_box_celebration_emojis TEXT DEFAULT '🎉,🎊,✨,🌟';
    `);

    console.log('✅ Colonnes de célébration ajoutées avec succès !');

    // Vérifier
    const result = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name='theme_config'
      AND column_name IN ('mystery_box_celebration_gif', 'mystery_box_celebration_emojis');
    `);

    console.log('✅ Vérification:', result.rows);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addColumns();
