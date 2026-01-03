const db = require('../utils/database-pg');

/**
 * Migration: Ajouter 'mystery_box' à la contrainte collections_source_check
 *
 * PROBLÈME: La contrainte ne permet que 'give' et 'mission'
 * SOLUTION: Ajouter 'mystery_box' à la liste des valeurs autorisées
 */

async function fixSourceConstraint() {
  try {
    console.log('🔧 MIGRATION - Ajout de "mystery_box" à collections_source_check\n');
    console.log('='.repeat(80));

    // ÉTAPE 1: Vérifier la contrainte actuelle
    console.log('\n📋 ÉTAPE 1: Vérification de la contrainte actuelle\n');

    const currentConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);

    console.log(`Contrainte actuelle: ${currentConstraint.definition}\n`);

    // ÉTAPE 2: Supprimer l'ancienne contrainte
    console.log('='.repeat(80));
    console.log('\n🗑️  ÉTAPE 2: Suppression de l\'ancienne contrainte\n');

    await db.query(`
      ALTER TABLE collections
      DROP CONSTRAINT IF EXISTS collections_source_check
    `);

    console.log('✅ Ancienne contrainte supprimée\n');

    // ÉTAPE 3: Créer la nouvelle contrainte avec 'mystery_box'
    console.log('='.repeat(80));
    console.log('\n✨ ÉTAPE 3: Création de la nouvelle contrainte\n');

    await db.query(`
      ALTER TABLE collections
      ADD CONSTRAINT collections_source_check
      CHECK (source = ANY (ARRAY['give'::text, 'mission'::text, 'mystery_box'::text]))
    `);

    console.log('✅ Nouvelle contrainte créée avec les valeurs:');
    console.log('   - give');
    console.log('   - mission');
    console.log('   - mystery_box\n');

    // ÉTAPE 4: Vérification
    console.log('='.repeat(80));
    console.log('\n🔍 ÉTAPE 4: Vérification finale\n');

    const newConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);

    console.log(`Nouvelle contrainte: ${newConstraint.definition}\n`);

    if (newConstraint.definition.includes('mystery_box')) {
      console.log('✅ SUCCESS! La valeur "mystery_box" est maintenant autorisée\n');
    } else {
      console.log('❌ ERREUR: La valeur "mystery_box" n\'a pas été ajoutée\n');
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log('\n💡 PROCHAINES ÉTAPES:\n');
    console.log('   1. Les mystery boxes enregistreront maintenant la source correctement');
    console.log('   2. Aucun redémarrage du bot nécessaire');
    console.log('   3. Les prochaines ouvertures de mystery boxes fonctionneront\n');

    console.log('🧪 POUR TESTER:');
    console.log('   - Ouvre quelques mystery boxes sur Discord');
    console.log('   - Lance: node scripts/verify-collectible-sources.js');
    console.log('   - Vérifie que les collectibles ont source="mystery_box"\n');

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

fixSourceConstraint();
