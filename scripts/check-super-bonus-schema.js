const db = require('../utils/database-pg');

/**
 * Vérifier les schémas des tables pour le système de super bonus
 * - player_active_bonuses: Voir structure actuelle
 * - super_bonuses: Vérifier si activation_mode existe
 */
async function checkSchemas() {
  console.log('\n🔍 VÉRIFICATION SCHÉMAS - Système Super Bonus\n');
  console.log('='.repeat(100));

  try {
    // 1. Vérifier structure de player_active_bonuses
    console.log('\n📋 TABLE: player_active_bonuses');
    console.log('-'.repeat(100));

    const playerBonusColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    if (playerBonusColumns.length > 0) {
      console.table(playerBonusColumns);
    } else {
      console.log('⚠️  Table introuvable ou vide');
    }

    // 2. Vérifier structure de super_bonuses
    console.log('\n📋 TABLE: super_bonuses');
    console.log('-'.repeat(100));

    const superBonusColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);

    if (superBonusColumns.length > 0) {
      console.table(superBonusColumns);
    } else {
      console.log('⚠️  Table introuvable ou vide');
    }

    // 3. Vérifier si activation_mode existe déjà
    console.log('\n🔍 RECHERCHE: Colonne activation_mode dans super_bonuses');
    console.log('-'.repeat(100));

    const activationModeExists = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      AND column_name = 'activation_mode'
    `);

    if (activationModeExists) {
      console.log('✅ Colonne activation_mode EXISTE déjà');

      // Vérifier les contraintes
      const constraint = await db.queryOne(`
        SELECT pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conname LIKE '%activation_mode%'
      `);

      if (constraint) {
        console.log('📌 Contrainte:', constraint.definition);
      }

      // Voir les valeurs actuelles
      const values = await db.queryAll(`
        SELECT activation_mode, COUNT(*) as count
        FROM super_bonuses
        WHERE guild_id = $1
        GROUP BY activation_mode
      `, [process.env.GUILD_ID || '1248028543389143070']);

      console.log('\n📊 Valeurs actuelles:');
      console.table(values);

    } else {
      console.log('❌ Colonne activation_mode N\'EXISTE PAS');
      console.log('   → Migration nécessaire');
    }

    // 4. Vérifier les contraintes CHECK sur player_active_bonuses
    console.log('\n🔍 CONTRAINTES: player_active_bonuses');
    console.log('-'.repeat(100));

    const constraints = await db.queryAll(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'player_active_bonuses'::regclass
      AND contype = 'c'
    `);

    if (constraints.length > 0) {
      console.table(constraints);
    } else {
      console.log('ℹ️  Aucune contrainte CHECK trouvée');
    }

    // 5. Exemple de données player_active_bonuses
    console.log('\n📊 DONNÉES EXEMPLE: player_active_bonuses (5 derniers)');
    console.log('-'.repeat(100));

    const exampleData = await db.queryAll(`
      SELECT *
      FROM player_active_bonuses
      WHERE guild_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [process.env.GUILD_ID || '1248028543389143070']);

    if (exampleData.length > 0) {
      console.table(exampleData);
    } else {
      console.log('ℹ️  Aucune donnée (normal si table vide)');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Vérification terminée\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkSchemas();
