const db = require('./utils/database-pg');
require('dotenv').config();

async function migrateAddEmptyBoxType() {
  try {
    console.log('🔧 Migration: Ajout du type "empty-box" à la contrainte traps_type_check...\n');

    // 1. Supprimer l'ancienne contrainte
    console.log('1️⃣ Suppression de l\'ancienne contrainte...');
    await db.query(`
      ALTER TABLE traps
      DROP CONSTRAINT IF EXISTS traps_type_check
    `);
    console.log('   ✅ Ancienne contrainte supprimée');

    // 2. Ajouter la nouvelle contrainte avec "empty-box"
    console.log('\n2️⃣ Ajout de la nouvelle contrainte avec "empty-box"...');
    await db.query(`
      ALTER TABLE traps
      ADD CONSTRAINT traps_type_check
      CHECK (type IN ('cooldown', 'lose-collectible', 'public-shame', 'points-malus', 'empty-box'))
    `);
    console.log('   ✅ Nouvelle contrainte ajoutée');

    // 3. Vérifier la contrainte
    console.log('\n3️⃣ Vérification...');
    const constraints = await db.queryAll(`
      SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'traps' AND con.conname = 'traps_type_check'
    `);

    if (constraints.length > 0) {
      console.log('   ✅ Contrainte:', constraints[0].definition);
    }

    console.log('\n✅ Migration terminée !');
    console.log('\nVous pouvez maintenant:');
    console.log('   node create-empty-box-trap.js');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

migrateAddEmptyBoxType();
