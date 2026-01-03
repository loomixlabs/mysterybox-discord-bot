const db = require('../utils/database-pg');

async function verifyAimantConfig() {
  try {
    const GUILD_ID = '1248028543389143070';
    const USER_ID = '692649463805640724';

    console.log('🔍 VÉRIFICATION - Configuration Aimant à Légendaires\n');
    console.log('='.repeat(80));

    // 1. Vérifier la configuration du bonus dans super_bonuses
    console.log('\n📋 ÉTAPE 1: Configuration du bonus\n');

    const bonusConfig = await db.query(`
      SELECT id, name, activation_mode, effect_type, effect_config, duration_type, duration_value
      FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Aimant à Légendaires'
    `, [GUILD_ID]);

    if (bonusConfig.length === 0) {
      console.log('❌ Aucun bonus "Aimant à Légendaires" trouvé pour ce serveur !');
      process.exit(1);
    }

    console.log(`✅ Bonus trouvé (ID: ${bonusConfig[0].id})`);
    console.log(`   Nom: ${bonusConfig[0].name}`);
    console.log(`   activation_mode: ${bonusConfig[0].activation_mode} ${bonusConfig[0].activation_mode === 'manual' ? '✅' : '❌ Devrait être "manual"'}`);
    console.log(`   effect_type: ${bonusConfig[0].effect_type} ${bonusConfig[0].effect_type === 'rarity_boost' ? '✅' : '❌ Devrait être "rarity_boost"'}`);
    console.log(`   duration_type: ${bonusConfig[0].duration_type} ${bonusConfig[0].duration_type === 'temporary' ? '✅' : '❌ Devrait être "temporary"'}`);
    console.log(`   duration_value: ${bonusConfig[0].duration_value}s (${Math.floor(bonusConfig[0].duration_value / 86400)} jours)`);
    console.log(`   effect_config: ${JSON.stringify(bonusConfig[0].effect_config, null, 2)}`);

    // 2. Vérifier l'instance active du joueur
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 ÉTAPE 2: Instance active du joueur\n');

    const activeBonus = await db.query(`
      SELECT pab.*, sb.name, sb.effect_type, sb.effect_config
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.user_id = $2
      AND sb.name = 'Aimant à Légendaires'
    `, [GUILD_ID, USER_ID]);

    if (activeBonus.length === 0) {
      console.log('❌ Aucune instance active trouvée pour cet utilisateur !');
    } else {
      const bonus = activeBonus[0];
      const now = new Date();
      const expiresAt = bonus.expires_at ? new Date(bonus.expires_at) : null;
      const isExpired = expiresAt && expiresAt < now;
      const isActivated = bonus.activated_at !== null;

      console.log(`✅ Instance trouvée (ID: ${bonus.id})`);
      console.log(`   Bonus ID: ${bonus.bonus_id}`);
      console.log(`   activated_at: ${bonus.activated_at || 'NULL'} ${isActivated ? '✅ ACTIVÉ' : '❌ PAS ENCORE ACTIVÉ'}`);
      console.log(`   is_active: ${bonus.is_active} ${bonus.is_active ? '✅' : '❌ INACTIF'}`);
      console.log(`   expires_at: ${bonus.expires_at || 'NULL'}`);

      if (expiresAt) {
        const timeLeft = Math.floor((expiresAt - now) / 1000 / 60 / 60); // heures
        console.log(`   Temps restant: ${timeLeft}h ${isExpired ? '❌ EXPIRÉ' : '✅'}`);
      }

      console.log(`\n   effect_config: ${JSON.stringify(bonus.effect_config, null, 2)}`);

      // 3. Vérifier les conditions pour que le boost fonctionne
      console.log('\n' + '='.repeat(80));
      console.log('\n📋 ÉTAPE 3: Vérification des conditions\n');

      const checks = {
        'effect_type === rarity_boost': bonus.effect_type === 'rarity_boost',
        'is_active === true': bonus.is_active,
        'activated_at !== NULL': bonus.activated_at !== null,
        'not expired': !isExpired,
        'effect_config.target_rarity existe': bonus.effect_config?.target_rarity !== undefined,
        'effect_config.boost_value existe': bonus.effect_config?.boost_value !== undefined
      };

      let allGood = true;
      Object.entries(checks).forEach(([condition, pass]) => {
        console.log(`   ${pass ? '✅' : '❌'} ${condition}`);
        if (!pass) allGood = false;
      });

      console.log('\n' + '='.repeat(80));

      if (allGood) {
        console.log('\n✅ ✅ ✅ TOUT EST BON ! L\'Aimant devrait fonctionner correctement.\n');
        console.log(`🎯 Boost attendu: legendary ${bonus.effect_config.target_rarity === 'legendary' ? '5%' : '?%'} → ~44% (avec boost de +${bonus.effect_config.boost_value})\n`);
      } else {
        console.log('\n❌ PROBLÈME DÉTECTÉ ! L\'Aimant ne fonctionnera PAS correctement.\n');
      }
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyAimantConfig();
