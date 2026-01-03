const db = require('../utils/database-pg');

async function removeConstraints() {
  console.log('\n🔧 SUPPRESSION DES ANCIENNES CONTRAINTES DE RARETÉ\n');
  console.log('='.repeat(80));

  try {
    console.log('\n📋 Contraintes à supprimer:\n');
    console.log('  1. collectible_rarity_weights_positive (bloque valeurs à 0)');
    console.log('  2. super_bonus_rarity_weights_positive (bloque valeurs à 0)');

    console.log('\n🔄 Suppression en cours...\n');

    // Supprimer la contrainte collectibles
    await db.query(`
      ALTER TABLE theme_config
      DROP CONSTRAINT IF EXISTS collectible_rarity_weights_positive;
    `);
    console.log('✅ Contrainte collectible_rarity_weights_positive supprimée');

    // Supprimer la contrainte super bonuses
    await db.query(`
      ALTER TABLE theme_config
      DROP CONSTRAINT IF EXISTS super_bonus_rarity_weights_positive;
    `);
    console.log('✅ Contrainte super_bonus_rarity_weights_positive supprimée');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Contraintes supprimées avec succès !');
    console.log('');
    console.log('💡 Vous pouvez maintenant utiliser des valeurs de 0% à 100%');
    console.log('   pour les probabilités de rareté.');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

removeConstraints();
