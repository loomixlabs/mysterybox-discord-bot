require('dotenv').config();
const db = require('../../utils/database-pg');

async function addBotRoleField() {
  console.log('🔧 Ajout du champ bot_role_id à la table guild_branding\n');
  console.log('━'.repeat(100));

  try {
    // Ajouter le champ bot_role_id
    console.log('\n📊 ÉTAPE 1: Ajout du champ bot_role_id\n');

    await db.query(`
      ALTER TABLE guild_branding
      ADD COLUMN IF NOT EXISTS bot_role_id TEXT DEFAULT NULL
    `);

    console.log('   ✅ Champ bot_role_id ajouté\n');

    // Vérification
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 2: Vérification\n');

    const columns = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'guild_branding' AND column_name = 'bot_role_id'
    `);

    if (columns.length > 0) {
      console.log('   ✅ Vérification réussie:');
      console.log(`      Colonne: ${columns[0].column_name}`);
      console.log(`      Type: ${columns[0].data_type}`);
      console.log(`      Défaut: ${columns[0].column_default || 'NULL'}\n`);
    }

    console.log('━'.repeat(100));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    throw error;
  } finally {
    await db.close();
  }
}

addBotRoleField();
