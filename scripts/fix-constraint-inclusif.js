const db = require('../utils/database-pg');

async function fixConstraintInclusif() {
  try {
    console.log('🔧 CORRECTION INCLUSIVE DE LA CONTRAINTE\\n');
    console.log('='.repeat(80));

    // 1. Lister tous les bonus_type existants
    console.log('📋 TOUS LES bonus_type EXISTANTS:');
    console.log('-'.repeat(80));
    const existingTypes = await db.query(`
      SELECT DISTINCT bonus_type FROM super_bonuses ORDER BY bonus_type
    `);

    const typesList = existingTypes.map(t => t.bonus_type);
    console.log(`   Types trouvés: ${typesList.join(', ')}\\n`);

    // 2. Supprimer la contrainte existante
    console.log('\\n🔧 SUPPRESSION DE LA CONTRAINTE EXISTANTE...');
    console.log('-'.repeat(80));
    await db.query(`
      ALTER TABLE super_bonuses
      DROP CONSTRAINT IF EXISTS super_bonuses_bonus_type_check
    `);
    console.log('✅ Contrainte supprimée\\n');

    // 3. Créer la nouvelle contrainte avec TOUS les types existants + 'reveal'
    const allTypes = [...new Set([...typesList, 'reveal'])]; // Ajouter 'reveal' et dédupliquer
    const typesForConstraint = allTypes.map(t => `'${t}'`).join(', ');

    console.log('\\n📝 CRÉATION DE LA NOUVELLE CONTRAINTE...');
    console.log('-'.repeat(80));
    console.log(`   Types autorisés: ${allTypes.join(', ')}\\n`);

    await db.query(`
      ALTER TABLE super_bonuses
      ADD CONSTRAINT super_bonuses_bonus_type_check
      CHECK (bonus_type IN (${typesForConstraint}))
    `);
    console.log('✅ Nouvelle contrainte créée\\n');

    // 4. Corriger le type de Vision Divine
    console.log('\\n🔧 CORRECTION DU TYPE DE VISION DIVINE...');
    console.log('-'.repeat(80));

    const guildId = '297309737135898624';
    await db.query(`
      UPDATE super_bonuses
      SET bonus_type = 'reveal'
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    console.log('✅ Vision Divine mis à jour: boost → reveal\\n');

    // 5. Vérifier le résultat
    const visionDivine = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    console.log('\\n📊 RÉSULTAT FINAL:');
    console.log('-'.repeat(80));
    console.log(`   Name: ${visionDivine.name}`);
    console.log(`   Type: ${visionDivine.bonus_type} ✅`);
    console.log(`   Effect type: ${visionDivine.effect_type}\\n`);

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Correction terminée! Vision Divine devrait maintenant fonctionner!\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

fixConstraintInclusif();
