const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

/**
 * Exécuter la migration pour ajouter 'reroll' à la contrainte effect_type
 */
async function runMigration() {
  console.log('\n🔧 MIGRATION: Ajout de "reroll" à effect_type\n');
  console.log('='.repeat(100));

  try {
    // 1. Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-reroll-effect-type.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Fichier SQL introuvable:', sqlPath);
      process.exit(1);
    }

    console.log('📄 Lecture du fichier SQL...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ Fichier chargé\n');

    // 2. Afficher la contrainte actuelle
    console.log('📋 AVANT MIGRATION:');
    console.log('-'.repeat(100));

    const beforeConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);

    if (beforeConstraint) {
      console.log('Contrainte actuelle:', beforeConstraint.definition);
    } else {
      console.log('⚠️  Contrainte introuvable');
    }

    // 3. Exécuter la migration
    console.log('\n\n🚀 EXÉCUTION DE LA MIGRATION...\n');

    await db.query(sql);

    console.log('✅ Migration exécutée avec succès\n');

    // 4. Vérifier la nouvelle contrainte
    console.log('📋 APRÈS MIGRATION:');
    console.log('-'.repeat(100));

    const afterConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);

    if (afterConstraint) {
      console.log('Nouvelle contrainte:', afterConstraint.definition);

      // Vérifier que 'reroll' est présent
      if (afterConstraint.definition.includes('reroll')) {
        console.log('\n✅ "reroll" est bien présent dans la contrainte');
      } else {
        console.log('\n⚠️  "reroll" ne semble pas présent dans la contrainte');
      }
    } else {
      console.log('❌ Contrainte introuvable après migration');
    }

    // 5. Tester l'insertion d'un bonus avec effect_type 'reroll'
    console.log('\n\n🧪 TEST: Insertion d\'un bonus avec effect_type "reroll"...\n');

    try {
      const testInsert = await db.query(`
        INSERT INTO super_bonuses (
          guild_id, bonus_id, name, description, icon, bonus_type,
          effect_type, effect_config, duration_type, duration_value, color, rarity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (guild_id, bonus_id) DO NOTHING
        RETURNING id
      `, [
        '1248028543389143070', // guild_id de test
        'test_reroll',
        'Test Reroll',
        'Test de la contrainte reroll',
        '🧪',
        'test',
        'reroll', // Type à tester
        JSON.stringify({ test: true }),
        'charges',
        1,
        '#000000',
        'common'
      ]);

      if (testInsert && testInsert.length > 0) {
        console.log('✅ Insertion test réussie avec effect_type "reroll"');

        // Supprimer le test
        await db.query(`
          DELETE FROM super_bonuses
          WHERE guild_id = $1 AND bonus_id = $2
        `, ['1248028543389143070', 'test_reroll']);

        console.log('✅ Bonus test supprimé');
      } else {
        console.log('ℹ️  Bonus test déjà existant (normal si relance)');
      }

    } catch (testError) {
      console.error('❌ Test d\'insertion échoué:', testError.message);
      throw testError;
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Migration terminée avec succès');
    console.log('\n💡 Prochaine étape: Relancer install-bonuses-existing-guilds.js\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR lors de la migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
