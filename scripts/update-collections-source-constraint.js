/**
 * Mettre à jour la contrainte CHECK sur collections.source pour inclure 'joker'
 */
const db = require('../utils/database-pg');

async function updateConstraint() {
  console.log('🔧 MISE À JOUR CONTRAINTE collections.source\n');
  console.log('='.repeat(60));

  try {
    // 1. Vérifier la contrainte actuelle
    console.log('\n📋 1. Contrainte actuelle:');
    const current = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source%'
    `);
    console.log(`   ${current?.definition || 'AUCUNE'}`);

    // 2. Supprimer l'ancienne contrainte si elle existe
    console.log('\n📋 2. Suppression de l\'ancienne contrainte...');
    try {
      await db.query(`ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_source_check`);
      console.log('   ✅ Contrainte supprimée');
    } catch (e) {
      console.log('   ⚠️  Pas de contrainte à supprimer ou nom différent');
    }

    // 3. Vérifier s'il y a d'autres contraintes sur source
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass AND contype = 'c'
    `);
    console.log(`\n📋 3. Contraintes CHECK existantes (${constraints.length}):`);
    for (const c of constraints) {
      console.log(`   - ${c.conname}: ${c.definition}`);
      // Supprimer si c'est une contrainte sur source
      if (c.definition.includes('source')) {
        await db.query(`ALTER TABLE collections DROP CONSTRAINT IF EXISTS ${c.conname}`);
        console.log(`     → Supprimée`);
      }
    }

    // 4. Ajouter la nouvelle contrainte avec 'joker'
    console.log('\n📋 4. Ajout de la nouvelle contrainte...');
    await db.query(`
      ALTER TABLE collections ADD CONSTRAINT collections_source_check
      CHECK (source IN ('mystery_box', 'mission', 'admin_give', 'trade', 'reroll', 'joker', 'campaign'))
    `);
    console.log('   ✅ Nouvelle contrainte ajoutée');

    // 5. Vérifier
    console.log('\n📋 5. Vérification:');
    const updated = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);
    console.log(`   ${updated?.definition || 'ERREUR - contrainte non trouvée'}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Contrainte mise à jour avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

updateConstraint();
