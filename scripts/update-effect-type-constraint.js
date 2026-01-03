/**
 * Mise à jour de la contrainte CHECK effect_type
 * Réduit de 11 à 7 types autorisés
 */

const db = require('../utils/database-pg');

async function updateConstraint() {
  console.log('🔧 MISE À JOUR CONTRAINTE effect_type\n');

  try {
    // 1. Vérifier contrainte actuelle
    const current = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);
    console.log('Contrainte actuelle:', current?.definition || 'AUCUNE');

    // 2. Supprimer l'ancienne contrainte
    try {
      await db.query('ALTER TABLE super_bonuses DROP CONSTRAINT IF EXISTS super_bonuses_effect_type_check');
      console.log('✅ Ancienne contrainte supprimée');
    } catch (e) {
      console.log('⚠️  Pas de contrainte à supprimer');
    }

    // 3. Ajouter la nouvelle contrainte (7 types)
    // Types gardés: reveal, rarity_boost, multiplier, protection, cooldown, cosmetic, transfer
    await db.query(`
      ALTER TABLE super_bonuses ADD CONSTRAINT super_bonuses_effect_type_check
      CHECK (effect_type IN ('reveal', 'rarity_boost', 'multiplier', 'protection', 'cooldown', 'cosmetic', 'transfer'))
    `);
    console.log('✅ Nouvelle contrainte ajoutée (7 types)');

    // 4. Vérifier
    const updated = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);
    console.log('\n📋 Nouvelle contrainte:', updated?.definition);

    console.log('\n✅ Terminé !');
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

updateConstraint();
