/**
 * Mettre à jour la contrainte CHECK sur collections.source pour inclure 'joker'
 * V2: Inclut toutes les valeurs existantes
 */
const db = require('../utils/database-pg');

async function updateConstraint() {
  console.log('🔧 MISE À JOUR CONTRAINTE collections.source (V2)\n');
  console.log('='.repeat(60));

  try {
    // 1. Vérifier les valeurs source existantes
    console.log('\n📋 1. Valeurs source existantes:');
    const existingSources = await db.queryAll(`
      SELECT DISTINCT source FROM collections WHERE source IS NOT NULL
    `);
    console.log(`   ${existingSources.map(s => s.source).join(', ')}`);

    // 2. Supprimer toute contrainte existante sur source
    console.log('\n📋 2. Suppression des anciennes contraintes...');
    const constraints = await db.queryAll(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass AND contype = 'c'
    `);
    for (const c of constraints) {
      await db.query(`ALTER TABLE collections DROP CONSTRAINT IF EXISTS ${c.conname}`);
      console.log(`   ✅ ${c.conname} supprimée`);
    }
    if (constraints.length === 0) {
      console.log('   Aucune contrainte à supprimer');
    }

    // 3. Ajouter la nouvelle contrainte avec TOUTES les valeurs possibles
    console.log('\n📋 3. Ajout de la nouvelle contrainte...');
    // Inclure: give, mystery_box, mission, admin_give, trade, reroll, joker, campaign
    await db.query(`
      ALTER TABLE collections ADD CONSTRAINT collections_source_check
      CHECK (source IN ('give', 'mystery_box', 'mission', 'admin_give', 'trade', 'reroll', 'joker', 'campaign'))
    `);
    console.log('   ✅ Nouvelle contrainte ajoutée');

    // 4. Vérifier
    console.log('\n📋 4. Vérification:');
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
