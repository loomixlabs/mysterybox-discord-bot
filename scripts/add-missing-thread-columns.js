const db = require('../utils/database-pg');

async function addMissingColumns() {
  console.log('🔄 Ajout des colonnes _thread manquantes...\n');

  try {
    // Ajouter les 3 colonnes _thread
    const columns = [
      'notify_super_admins_thread',
      'notify_owner_thread',
      'notify_cofounders_thread'
    ];

    for (const col of columns) {
      try {
        await db.query(`ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS ${col} BOOLEAN DEFAULT TRUE`);
        console.log(`✅ ${col} ajouté`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`⏭️ ${col} existe déjà`);
        } else {
          console.error(`❌ Erreur pour ${col}:`, err.message);
        }
      }
    }

    // Vérification finale
    console.log('\n📋 Vérification des 6 colonnes:');
    const result = await db.queryAll(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'guild_config' AND column_name LIKE 'notify_%'
      ORDER BY column_name
    `);
    console.table(result);
    console.log(`\n✅ ${result.length}/6 colonnes présentes`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addMissingColumns();
