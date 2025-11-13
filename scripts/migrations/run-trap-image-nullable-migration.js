const db = require('./utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration make-trap-image-url-nullable...\n');

    // Vérifier la contrainte actuelle
    const columnInfo = await db.queryOne(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traps'
        AND column_name = 'image_url'
    `);

    console.log('📋 État actuel de la colonne:');
    console.log(`  - Nom: ${columnInfo.column_name}`);
    console.log(`  - Type: ${columnInfo.data_type}`);
    console.log(`  - Nullable: ${columnInfo.is_nullable}\n`);

    if (columnInfo.is_nullable === 'YES') {
      console.log('✅ La colonne image_url est déjà nullable.');
    } else {
      console.log('⚙️ Modification de la colonne image_url pour la rendre nullable...');

      await db.query(`
        ALTER TABLE traps
        ALTER COLUMN image_url DROP NOT NULL
      `);

      console.log('✅ Colonne image_url modifiée avec succès!');
    }

    // Vérifier le résultat
    const result = await db.queryOne(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traps'
        AND column_name = 'image_url'
    `);

    console.log('\n📋 Résultat après migration:');
    console.log(`  - Nom: ${result.column_name}`);
    console.log(`  - Type: ${result.data_type}`);
    console.log(`  - Nullable: ${result.is_nullable}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

runMigration();
