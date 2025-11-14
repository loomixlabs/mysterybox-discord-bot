require('dotenv').config();
const db = require('../../utils/database-pg');

/**
 * MIGRATION: Ajouter la colonne trap_lose_all_collectibles à announcement_settings
 * Et mettre à jour les settings existants
 */

async function addTrapLoseAllToAnnouncements() {
  console.log('🔧 MIGRATION: Ajout du nouveau piège aux paramètres d\'annonces\n');
  console.log('━'.repeat(80));

  try {
    // 1. Vérifier si la colonne existe déjà
    console.log('\n📊 ÉTAPE 1: Vérification de la colonne\n');

    const columnExists = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
        AND column_name = 'trap_lose_all_collectibles'
    `);

    if (columnExists.length > 0) {
      console.log('   ⏭️  Colonne trap_lose_all_collectibles existe déjà');
    } else {
      console.log('   ➕ Ajout de la colonne trap_lose_all_collectibles...');

      await db.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN IF NOT EXISTS trap_lose_all_collectibles BOOLEAN DEFAULT FALSE
      `);

      console.log('   ✅ Colonne ajoutée');
    }

    // 2. Activer par défaut pour tous les serveurs
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 2: Activation par défaut\n');

    await db.query(`
      UPDATE announcement_settings
      SET trap_lose_all_collectibles = TRUE
      WHERE trap_lose_all_collectibles IS NULL OR trap_lose_all_collectibles = FALSE
    `);

    console.log('   ✅ Paramètre activé pour tous les serveurs');

    // 3. Vérifier le résultat
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 3: Vérification\n');

    const result = await db.query(`
      SELECT guild_id, trap_lose_all_collectibles
      FROM announcement_settings
    `);

    console.log(`   ✅ ${result.length} serveur(s) configuré(s):`);
    result.forEach(r => {
      console.log(`      Guild ${r.guild_id}: ${r.trap_lose_all_collectibles ? '✅ Activé' : '⬜ Désactivé'}`);
    });

    console.log('\n━'.repeat(80));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS !\n');

  } catch (error) {
    console.error('\n❌ ERREUR lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

addTrapLoseAllToAnnouncements();
