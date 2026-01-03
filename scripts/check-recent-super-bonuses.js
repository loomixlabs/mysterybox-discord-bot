const db = require('../utils/database-pg');

/**
 * Vérifier les super bonus récemment obtenus
 */
async function checkRecentSuperBonuses() {
  console.log('\n🔍 VÉRIFICATION - Super Bonus Récents\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Super bonus actifs pour l'utilisateur
    console.log('\n✨ SUPER BONUS ACTIFS (tous joueurs):\n');

    const activeBonuses = await db.queryAll(`
      SELECT
        p.username,
        sb.name as bonus_name,
        sb.rarity,
        sb.activation_mode,
        pab.activated_at,
        pab.expires_at,
        pab.created_at,
        CASE
          WHEN pab.activated_at IS NULL THEN '⏳ En attente'
          WHEN pab.expires_at IS NULL THEN '♾️ Actif (permanent)'
          WHEN pab.expires_at > NOW() THEN '✅ Actif'
          ELSE '❌ Expiré'
        END as status
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      AND pab.is_active = true
      ORDER BY pab.created_at DESC
      LIMIT 10
    `, [guildId]);

    if (activeBonuses.length > 0) {
      console.table(activeBonuses.map(b => ({
        'Joueur': b.username,
        'Bonus': b.bonus_name,
        'Rareté': b.rarity,
        'Mode': b.activation_mode,
        'Status': b.status,
        'Créé il y a': Math.round((Date.now() - new Date(b.created_at).getTime()) / 60000) + ' min'
      })));

      // Détails complets pour les 2 derniers
      console.log('\n📋 DÉTAILS DES 2 DERNIERS BONUS:\n');
      for (const bonus of activeBonuses.slice(0, 2)) {
        console.log(`${bonus.bonus_name} (${bonus.activation_mode})`);
        console.log(`  Joueur: ${bonus.username}`);
        console.log(`  Rareté: ${bonus.rarity}`);
        console.log(`  Créé: ${bonus.created_at}`);
        console.log(`  Activé: ${bonus.activated_at || 'NULL (en attente)'}`);
        console.log(`  Expire: ${bonus.expires_at || 'NULL (permanent ou charges)'}`);
        console.log(`  Status: ${bonus.status}\n`);
      }
    } else {
      console.log('⚠️  Aucun bonus actif trouvé');
    }

    // Statistiques par mode d'activation
    console.log('\n📊 STATISTIQUES PAR MODE:\n');

    const stats = await db.queryAll(`
      SELECT
        sb.activation_mode,
        COUNT(*) as count,
        COUNT(CASE WHEN pab.activated_at IS NULL THEN 1 END) as pending,
        COUNT(CASE WHEN pab.activated_at IS NOT NULL THEN 1 END) as activated
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.is_active = true
      GROUP BY sb.activation_mode
    `, [guildId]);

    if (stats.length > 0) {
      console.table(stats.map(s => ({
        'Mode': s.activation_mode,
        'Total': parseInt(s.count),
        'En attente': parseInt(s.pending),
        'Activés': parseInt(s.activated)
      })));
    }

    // Vérifications attendues
    console.log('\n🎯 VÉRIFICATIONS:\n');

    const detectorPiege = activeBonuses.find(b => b.bonus_name === 'Détecteur de Pièges');
    const parrain = activeBonuses.find(b => b.bonus_name === 'Parrain/Marraine');

    if (detectorPiege) {
      console.log('✅ Détecteur de Pièges trouvé');
      console.log(`   Mode: ${detectorPiege.activation_mode} (attendu: automatic)`);
      console.log(`   Activé: ${detectorPiege.activated_at ? 'OUI ✅' : 'NON ❌'}`);
    } else {
      console.log('❌ Détecteur de Pièges non trouvé');
    }

    if (parrain) {
      console.log('\n✅ Parrain/Marraine trouvé');
      console.log(`   Mode: ${parrain.activation_mode} (attendu: manual)`);
      console.log(`   Activé: ${parrain.activated_at ? 'OUI (inattendu)' : 'NON ✅'}`);
    } else {
      console.log('❌ Parrain/Marraine non trouvé');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkRecentSuperBonuses();
