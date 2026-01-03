const db = require('../utils/database-pg');

/**
 * Analyse complète du système de durée des super bonus
 * Identifie tous les endroits où la durée est stockée/affichée/calculée
 */

const GUILD_ID = process.env.GUILD_ID || '1248028543389143070';

async function analyzeDuration() {
  console.log('\n🔍 ANALYSE COMPLÈTE - Système de Durée des Super Bonus\n');
  console.log('='.repeat(80));

  try {
    // 1. Structure de la table super_bonuses
    console.log('\n📊 1. STRUCTURE TABLE super_bonuses\n');

    const superBonusColumns = await db.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);

    console.table(superBonusColumns);

    // 2. Champs liés à la durée dans super_bonuses
    console.log('\n📋 2. CHAMPS DE DURÉE - super_bonuses\n');

    const durationFields = superBonusColumns.filter(col =>
      col.column_name.includes('duration') ||
      col.column_name.includes('expires') ||
      col.column_name.includes('time')
    );

    console.table(durationFields);

    // 3. Exemples de bonus avec durées
    console.log('\n✨ 3. EXEMPLES DE BONUS (avec durée)\n');

    const bonuses = await db.query(`
      SELECT
        bonus_id,
        name,
        rarity,
        duration_type,
        duration_value,
        activation_mode
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY
        CASE rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
        END
    `, [GUILD_ID]);

    console.table(bonuses);

    // 4. Répartition des types de durée
    console.log('\n📈 4. RÉPARTITION DES TYPES DE DURÉE\n');

    const durationTypes = await db.query(`
      SELECT
        duration_type,
        COUNT(*) as count,
        ARRAY_AGG(name) as bonus_names
      FROM super_bonuses
      WHERE guild_id = $1
      GROUP BY duration_type
      ORDER BY count DESC
    `, [GUILD_ID]);

    console.table(durationTypes);

    // 5. Valeurs de durée utilisées (pour duration_type = 'temporary')
    console.log('\n⏱️  5. VALEURS DE DURÉE ACTUELLES (en jours)\n');

    const temporaryBonuses = await db.query(`
      SELECT
        name,
        duration_value as jours_actuels,
        (duration_value * 24) as heures_equivalentes
      FROM super_bonuses
      WHERE guild_id = $1 AND duration_type = 'temporary'
      ORDER BY duration_value DESC
    `, [GUILD_ID]);

    console.table(temporaryBonuses);

    // 6. Structure de player_active_bonuses
    console.log('\n📊 6. STRUCTURE TABLE player_active_bonuses\n');

    const activeColumns = await db.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    console.table(activeColumns);

    // 7. Champs liés au temps dans player_active_bonuses
    console.log('\n📋 7. CHAMPS TEMPORELS - player_active_bonuses\n');

    const timeFields = activeColumns.filter(col =>
      col.column_name.includes('time') ||
      col.column_name.includes('expires') ||
      col.column_name.includes('activated')
    );

    console.table(timeFields);

    // 8. Exemples de bonus actifs avec dates
    console.log('\n🎯 8. EXEMPLES DE BONUS ACTIFS (avec dates)\n');

    const activeBonuses = await db.query(`
      SELECT
        pab.id,
        pab.user_id,
        sb.name as bonus_name,
        sb.duration_type,
        sb.duration_value,
        pab.activated_at,
        pab.expires_at,
        pab.is_active,
        EXTRACT(EPOCH FROM (pab.expires_at - pab.activated_at))/3600 as duree_heures,
        EXTRACT(EPOCH FROM (pab.expires_at - NOW()))/3600 as reste_heures
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      ORDER BY pab.id DESC
      LIMIT 10
    `, [GUILD_ID]);

    if (activeBonuses.length > 0) {
      console.table(activeBonuses);
    } else {
      console.log('⚠️  Aucun bonus actif trouvé');
    }

    // 9. Résumé de l'impact du changement
    console.log('\n📝 9. RÉSUMÉ DE L\'IMPACT DU CHANGEMENT JOURS → HEURES\n');
    console.log('='.repeat(80));

    const temporaryCount = bonuses.filter(b => b.duration_type === 'temporary').length;
    const chargesCount = bonuses.filter(b => b.duration_type === 'charges').length;
    const permanentCount = bonuses.filter(b => b.duration_type === 'permanent').length;

    console.log(`\n📊 Types de durée:`);
    console.log(`   • temporary (impacté): ${temporaryCount} bonus`);
    console.log(`   • charges (non impacté): ${chargesCount} bonus`);
    console.log(`   • permanent (non impacté): ${permanentCount} bonus`);

    console.log(`\n🔄 Changements à effectuer:`);
    console.log(`   1. DB: super_bonuses.duration_value (jours → heures)`);
    console.log(`   2. DB: Migration des valeurs existantes (x24)`);
    console.log(`   3. Code: Calcul de expires_at (jours → heures)`);
    console.log(`   4. UI: Affichage "mes bonus" (/profile)`);
    console.log(`   5. UI: Admin panel (création/édition)`);
    console.log(`   6. UI: Affichage dans les messages`);

    console.log(`\n⚠️  ZONES À VÉRIFIER:`);
    console.log(`   • handlers/superBonusHandler.js (activation)`);
    console.log(`   • commands/player/profile.js (affichage)`);
    console.log(`   • views/profileView.js (formatage)`);
    console.log(`   • Admin panel (création/sélection)`);

    console.log('\n' + '='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeDuration();
