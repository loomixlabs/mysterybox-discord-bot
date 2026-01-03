/**
 * Analyse complète du système Daily Rewards - V2
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function analyze() {
  console.log('='.repeat(80));
  console.log('🔍 ANALYSE COMPLÈTE DU SYSTÈME DAILY REWARDS - V2');
  console.log('='.repeat(80));

  try {
    // 1. Structure de super_bonuses
    console.log('\n⚡ 1. STRUCTURE TABLE super_bonuses');
    console.log('-'.repeat(60));

    const sbColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(sbColumns);

    // 2. Liste des super bonuses disponibles
    console.log('\n⚡ 2. SUPER BONUSES DISPONIBLES');
    console.log('-'.repeat(60));

    const superBonuses = await db.queryAll(`
      SELECT id, name, effect_type, duration_type, rarity
      FROM super_bonuses
      ORDER BY rarity DESC, name
    `);
    console.table(superBonuses);

    // 3. Contrainte source sur collections
    console.log('\n📦 3. CONTRAINTE source sur collections');
    console.log('-'.repeat(60));

    const sourceConstraint = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass
      AND contype = 'c'
    `);
    if (sourceConstraint.length > 0) {
      sourceConstraint.forEach(c => {
        console.log(`  ${c.conname}:`);
        console.log(`    ${c.definition}\n`);
      });
    } else {
      console.log('  ⚠️  Aucune contrainte trouvée sur collections');
    }

    // 4. Contraintes obtaned_from sur player_active_bonuses
    console.log('\n🎯 4. TOUTES LES CONTRAINTES sur player_active_bonuses');
    console.log('-'.repeat(60));

    const pabConstraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'player_active_bonuses'::regclass
    `);
    if (pabConstraints.length > 0) {
      pabConstraints.forEach(c => {
        console.log(`  ${c.conname}:`);
        console.log(`    ${c.definition}\n`);
      });
    } else {
      console.log('  ⚠️  Aucune contrainte trouvée');
    }

    // 5. Vérifier les valeurs existantes de obtained_from
    console.log('\n📊 5. VALEURS EXISTANTES de obtained_from');
    console.log('-'.repeat(60));

    const obtainedValues = await db.queryAll(`
      SELECT DISTINCT obtained_from, COUNT(*) as count
      FROM player_active_bonuses
      GROUP BY obtained_from
      ORDER BY count DESC
    `);
    console.table(obtainedValues);

    // 6. Vérifier les valeurs existantes de source dans collections
    console.log('\n📊 6. VALEURS EXISTANTES de source dans collections');
    console.log('-'.repeat(60));

    const sourceValues = await db.queryAll(`
      SELECT DISTINCT source, COUNT(*) as count
      FROM collections
      GROUP BY source
      ORDER BY count DESC
    `);
    console.table(sourceValues);

    // 7. Vérifier le handler dailyClaimHandler.js
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ DE L\'ANALYSE');
    console.log('='.repeat(80));

    console.log(`
📌 CONTRAINTE ACTUELLE reward_type:
   ('mystery_box', 'points', 'currency', 'collectible', 'super_bonus', 'random_collectible', 'choice')

   ✅ super_bonus EXISTE déjà dans la contrainte!
   ❌ super_bonus_random N'EXISTE PAS - À AJOUTER

📌 STRUCTURE daily_rewards_config:
   - reward_type: Type de récompense
   - reward_rarity: Rareté (pour mystery_box, collectible)
   - reward_amount: Quantité
   - reward_item_id: ID spécifique (collectible ou super_bonus)
   - choice_options: JSONB pour type 'choice'

📌 TRACKING daily_claim_logs:
   - reward_type: ✅
   - reward_rarity: ✅
   - reward_amount: ✅
   - reward_detail: ✅ (texte libre pour détails JSON)
`);

    console.log('\n📋 MODIFICATIONS NÉCESSAIRES:');
    console.log('-'.repeat(60));
    console.log(`
1. CONTRAINTE reward_type (daily_rewards_config):
   → Ajouter 'super_bonus_random'

2. CONTRAINTE source (collections):
   → Ajouter 'daily_claim' si pas présent

3. CONTRAINTE obtained_from (player_active_bonuses):
   → Ajouter 'daily_claim' si pas présent

4. HANDLER dailyClaimHandler.js:
   → Implémenter les cas:
      - 'super_bonus': db.addBonusToPlayer(guildId, discordId, reward_item_id, 'daily_claim')
      - 'super_bonus_random': Pioche aléatoire + db.addBonusToPlayer()
      - 'collectible': db.addCollectible(guildId, playerId, reward_item_id, 'daily_claim')
      - 'random_collectible': Pioche aléatoire + db.addCollectible()
`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyze();
