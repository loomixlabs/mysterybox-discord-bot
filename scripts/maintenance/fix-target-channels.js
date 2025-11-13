const db = require('./utils/database-pg');

async function fixTargetChannels() {
  try {
    console.log('🔄 Vérification de la colonne target_channels...\n');

    // 1. Vérifier si la colonne existe
    const columns = await db.queryAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='give_campaigns' AND column_name='target_channels';
    `);

    if (columns && columns.length > 0) {
      console.log('✅ La colonne target_channels existe déjà!');
      console.log('Colonne:', columns[0]);
    } else {
      console.log('❌ La colonne target_channels n\'existe pas.');
      console.log('🔧 Ajout de la colonne...\n');

      // 2. Ajouter la colonne
      await db.queryAll(`
        ALTER TABLE give_campaigns
        ADD COLUMN IF NOT EXISTS target_channels TEXT;
      `);

      console.log('✅ Colonne target_channels ajoutée avec succès!');
    }

    // 3. Afficher la structure complète de la table
    console.log('\n📋 Structure complète de la table give_campaigns:');
    const allColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='give_campaigns'
      ORDER BY ordinal_position;
    `);

    console.table(allColumns);

    console.log('\n✅ Opération terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixTargetChannels();
