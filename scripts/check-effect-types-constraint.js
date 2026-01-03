const db = require('../utils/database-pg');

/**
 * Vérifier la contrainte CHECK sur effect_type dans super_bonuses
 * pour voir quels types sont autorisés
 */
async function checkEffectTypesConstraint() {
  console.log('\n🔍 VÉRIFICATION CONTRAINTE effect_type\n');
  console.log('='.repeat(100));

  try {
    // 1. Récupérer la définition de la contrainte
    console.log('\n📋 1. Définition de la contrainte super_bonuses_effect_type_check...\n');

    const constraint = await db.queryOne(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);

    if (!constraint) {
      console.log('⚠️  Contrainte introuvable.');
      process.exit(1);
    }

    console.log(`✅ Contrainte: ${constraint.constraint_name}`);
    console.log(`📝 Définition: ${constraint.constraint_definition}\n`);

    // 2. Extraire les valeurs autorisées (parsing de la définition)
    const definition = constraint.constraint_definition;
    const match = definition.match(/\((.*?)\)/);

    if (match) {
      const allowedValues = match[1]
        .split('::')
        .map(v => v.trim().replace(/'/g, ''));

      console.log('✅ Valeurs autorisées extraites:');
      allowedValues.forEach((val, index) => {
        console.log(`   ${index + 1}. ${val}`);
      });
    }

    // 3. Vérifier les effect_types actuellement utilisés
    console.log('\n\n📊 2. effect_types actuellement en base de données...\n');

    const usedTypes = await db.queryAll(`
      SELECT DISTINCT effect_type, COUNT(*) as count
      FROM super_bonuses
      GROUP BY effect_type
      ORDER BY count DESC
    `);

    if (usedTypes.length > 0) {
      console.log('✅ effect_types utilisés:');
      console.table(usedTypes);
    } else {
      console.log('⚠️  Aucun super bonus en base (table vide)');
    }

    // 4. Vérifier les effect_types dans le code
    console.log('\n\n🔧 3. effect_types définis dans installSuperBonusesForGuild()...\n');

    const codeTypes = [
      'probability',  // Chance du Diable
      'reveal',       // Vision Divine
      'rarity_boost', // Aimant Légendaire
      'cosmetic',     // Aura de Célébrité
      'protection',   // Bouclier Anti-Piège
      'recovery',     // Assurance Collector (was this one used?)
      'cooldown',     // Accélérateur de Cooldown
      'multiplier',   // Jackpot x2
      'detector',     // Détecteur de Pièges
      'reroll',       // Retour dans le Futur (PROBLÈME)
      'transfer'      // Parrainage Divin
    ];

    console.log('📝 effect_types dans le code:');
    codeTypes.forEach((type, index) => {
      console.log(`   ${index + 1}. ${type}`);
    });

    // 5. Recommandation
    console.log('\n\n💡 RECOMMANDATIONS\n');
    console.log('='.repeat(100));
    console.log('\nOption A: Ajouter "reroll" à la contrainte (requiert ALTER TABLE)');
    console.log('   ALTER TABLE super_bonuses DROP CONSTRAINT super_bonuses_effect_type_check;');
    console.log('   ALTER TABLE super_bonuses ADD CONSTRAINT super_bonuses_effect_type_check');
    console.log('   CHECK (effect_type IN (\'probability\', \'reveal\', \'rarity_boost\', \'cosmetic\',');
    console.log('                         \'protection\', \'cooldown\', \'multiplier\', \'detector\',');
    console.log('                         \'transfer\', \'reroll\', \'voice\'));');

    console.log('\nOption B: Changer "reroll" en type existant dans le code');
    console.log('   Exemple: Utiliser "transfer" au lieu de "reroll" pour le bonus');
    console.log('   (Si "transfer" est déjà autorisé dans la contrainte)');

    console.log('\n' + '='.repeat(100));
    console.log('✅ Analyse terminée\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'analyse:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkEffectTypesConstraint();
