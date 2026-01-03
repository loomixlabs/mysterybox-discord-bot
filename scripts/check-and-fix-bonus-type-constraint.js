const db = require('../utils/database-pg');

async function checkAndFixBonusTypeConstraint() {
  try {
    console.log('🔍 VÉRIFICATION DE LA CONTRAINTE bonus_type\\n');
    console.log('='.repeat(80));

    // 1. Vérifier la contrainte actuelle
    console.log('📋 CONTRAINTE ACTUELLE:');
    console.log('-'.repeat(80));
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_bonus_type_check'
    `);

    if (!constraint) {
      console.log('❌ Contrainte introuvable\\n');
      process.exit(1);
    }

    console.log(`   ${constraint.definition}\\n`);

    // 2. Supprimer l'ancienne contrainte
    console.log('\\n🔧 SUPPRESSION DE L\'ANCIENNE CONTRAINTE...');
    console.log('-'.repeat(80));
    await db.query(`
      ALTER TABLE super_bonuses
      DROP CONSTRAINT super_bonuses_bonus_type_check
    `);
    console.log('✅ Contrainte supprimée\\n');

    // 3. Créer la nouvelle contrainte avec "reveal" inclus
    console.log('\\n📝 CRÉATION DE LA NOUVELLE CONTRAINTE (avec "reveal")...');
    console.log('-'.repeat(80));
    await db.query(`
      ALTER TABLE super_bonuses
      ADD CONSTRAINT super_bonuses_bonus_type_check
      CHECK (bonus_type IN ('boost', 'reveal', 'multiplier', 'protection'))
    `);
    console.log('✅ Nouvelle contrainte créée\\n');

    // 4. Vérifier la nouvelle contrainte
    const newConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_bonus_type_check'
    `);

    console.log('\\n📋 NOUVELLE CONTRAINTE:');
    console.log('-'.repeat(80));
    console.log(`   ${newConstraint.definition}\\n`);

    // 5. Maintenant, corriger le type de Vision Divine
    console.log('\\n🔧 CORRECTION DU TYPE DE VISION DIVINE...');
    console.log('-'.repeat(80));

    const guildId = '297309737135898624';
    await db.query(`
      UPDATE super_bonuses
      SET bonus_type = 'reveal'
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    console.log('✅ Vision Divine mis à jour: boost → reveal\\n');

    // 6. Vérifier le résultat
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

checkAndFixBonusTypeConstraint();
