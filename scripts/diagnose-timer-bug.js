require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  try {
    console.log('🔍 DIAGNOSTIC: Bug de timer des super bonus\n');
    console.log('='.repeat(80));

    // 1. Récupérer tous les bonus temporaires actifs
    const activeBonuses = await db.queryAll(`
      SELECT
        pab.id,
        pab.user_id,
        pab.bonus_id,
        pab.is_active,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        sb.name as bonus_name,
        sb.duration_type,
        sb.duration_value,
        NOW() as current_time,
        CASE
          WHEN pab.expires_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (pab.expires_at - NOW()))
          ELSE NULL
        END as seconds_remaining
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.is_active = TRUE
      AND sb.duration_type = 'temporary'
      ORDER BY pab.expires_at ASC NULLS FIRST
    `);

    console.log(`\n📊 Total: ${activeBonuses.length} bonus temporaires actifs\n`);

    // Séparer les bonus problématiques
    const problemBonuses = activeBonuses.filter(b => {
      if (!b.expires_at) return true; // NULL expires_at = problème
      return b.seconds_remaining !== null && b.seconds_remaining < 0; // Expiré
    });

    const validBonuses = activeBonuses.filter(b => {
      if (!b.expires_at) return false;
      return b.seconds_remaining > 0;
    });

    console.log(`\n❌ BONUS PROBLÉMATIQUES (${problemBonuses.length}):`);
    console.log('━'.repeat(80));

    for (const bonus of problemBonuses) {
      console.log(`\n🆔 ID: ${bonus.id}`);
      console.log(`   👤 User: ${bonus.user_id}`);
      console.log(`   🎯 Bonus: ${bonus.bonus_name} (ID: ${bonus.bonus_id})`);
      console.log(`   📅 activated_at: ${bonus.activated_at || 'NULL ❌'}`);
      console.log(`   ⏰ expires_at: ${bonus.expires_at || 'NULL ❌'}`);
      console.log(`   🕐 duration_value: ${bonus.duration_value}s (${Math.floor(bonus.duration_value / 3600)}h)`);

      if (bonus.seconds_remaining !== null) {
        const hours = Math.floor(Math.abs(bonus.seconds_remaining) / 3600);
        const minutes = Math.floor((Math.abs(bonus.seconds_remaining) % 3600) / 60);
        console.log(`   ⚠️  Temps restant: ${bonus.seconds_remaining}s → ${bonus.seconds_remaining < 0 ? '-' : ''}${hours}h ${minutes}min`);

        if (bonus.seconds_remaining < 0) {
          console.log(`   🔴 EXPIRÉ depuis ${hours}h ${minutes}min`);
        }
      }
    }

    console.log(`\n\n✅ BONUS VALIDES (${validBonuses.length}):`);
    console.log('━'.repeat(80));

    for (const bonus of validBonuses.slice(0, 5)) { // Afficher max 5
      const hours = Math.floor(bonus.seconds_remaining / 3600);
      const minutes = Math.floor((bonus.seconds_remaining % 3600) / 60);
      console.log(`\n🆔 ID: ${bonus.id}`);
      console.log(`   👤 User: ${bonus.user_id}`);
      console.log(`   🎯 Bonus: ${bonus.bonus_name}`);
      console.log(`   ⏱️  Temps restant: ${hours}h ${minutes}min`);
    }

    if (validBonuses.length > 5) {
      console.log(`\n   ... et ${validBonuses.length - 5} autres bonus valides`);
    }

    // 2. Analyser les causes
    console.log('\n\n📋 ANALYSE DES CAUSES:');
    console.log('━'.repeat(80));

    const nullExpiresCount = activeBonuses.filter(b => !b.expires_at).length;
    const expiredButActiveCount = activeBonuses.filter(b => b.seconds_remaining !== null && b.seconds_remaining < 0).length;

    console.log(`\n1. Bonus avec expires_at = NULL: ${nullExpiresCount}`);
    console.log(`   → Ces bonus n'ont jamais eu de date d'expiration définie`);
    console.log(`   → Le timer affiche probablement une valeur invalide`);

    console.log(`\n2. Bonus expirés mais toujours is_active = TRUE: ${expiredButActiveCount}`);
    console.log(`   → Le job de nettoyage n'a pas désactivé ces bonus`);
    console.log(`   → Le timer affiche un temps négatif`);

    // 3. Recommandations
    console.log('\n\n🔧 RECOMMANDATIONS:');
    console.log('━'.repeat(80));

    if (nullExpiresCount > 0) {
      console.log('\n1. CORRIGER les bonus sans expires_at:');
      console.log('   Option A: Définir expires_at basé sur activated_at + duration_value');
      console.log('   Option B: Désactiver ces bonus invalides');
    }

    if (expiredButActiveCount > 0) {
      console.log('\n2. NETTOYER les bonus expirés:');
      console.log('   UPDATE player_active_bonuses SET is_active = FALSE WHERE expires_at <= NOW()');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
