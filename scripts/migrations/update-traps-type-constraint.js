require('dotenv').config();
const db = require('../../utils/database-pg');

/**
 * MIGRATION: Mettre à jour la contrainte CHECK sur le type de piège
 * Ajouter 'lose-all-collectibles' aux types autorisés
 */

async function updateTrapsTypeConstraint() {
  console.log('🔧 MIGRATION: Mise à jour de la contrainte CHECK sur traps.type\n');
  console.log('━'.repeat(80));

  try {
    // 1. Récupérer les contraintes existantes
    console.log('\n📊 ÉTAPE 1: Vérification des contraintes actuelles\n');

    const constraints = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'traps'::regclass AND contype = 'c'
    `);

    console.log(`   ✅ ${constraints.length} contrainte(s) trouvée(s):`);
    constraints.forEach(c => {
      console.log(`      - ${c.conname}`);
      console.log(`        ${c.definition}\n`);
    });

    // Trouver la contrainte sur le type
    const typeConstraint = constraints.find(c => c.conname.includes('type_check'));

    if (!typeConstraint) {
      console.log('   ⚠️  Aucune contrainte type_check trouvée');
      console.log('   ℹ️  La table accepte peut-être tous les types');
      return;
    }

    // 2. Supprimer l'ancienne contrainte
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 2: Suppression de l\'ancienne contrainte\n');

    await db.query(`ALTER TABLE traps DROP CONSTRAINT ${typeConstraint.conname}`);
    console.log(`   ✅ Contrainte "${typeConstraint.conname}" supprimée`);

    // 3. Créer la nouvelle contrainte avec le nouveau type
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 3: Création de la nouvelle contrainte\n');

    await db.query(`
      ALTER TABLE traps
      ADD CONSTRAINT traps_type_check
      CHECK (type IN (
        'cooldown',
        'lose-collectible',
        'lose-all-collectibles',
        'public-shame',
        'points-malus',
        'empty-box'
      ))
    `);

    console.log('   ✅ Nouvelle contrainte créée avec les types:');
    console.log('      - cooldown');
    console.log('      - lose-collectible');
    console.log('      - lose-all-collectibles ✨ NOUVEAU');
    console.log('      - public-shame');
    console.log('      - points-malus');
    console.log('      - empty-box');

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

updateTrapsTypeConstraint();
