const db = require('../utils/database-pg');

async function monitorAimantResults() {
  try {
    const GUILD_ID = '297309737135898624'; // Serveur de TEST
    const USER_ID = '297307186307006464'; // Ton user ID

    console.log('📊 MONITORING - Résultats Aimant à Légendaires\n');
    console.log('='.repeat(80));

    // 1. Vérifier que l'Aimant est toujours actif
    const aimant = await db.query(`
      SELECT pab.*, sb.name, sb.effect_config
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.user_id = $2
      AND sb.name = 'Aimant à Légendaires'
      AND pab.is_active = TRUE
      LIMIT 1
    `, [GUILD_ID, USER_ID]);

    if (aimant.length === 0) {
      console.log('❌ Aimant à Légendaires INACTIF ou expiré !\n');
    } else {
      const now = new Date();
      const expiresAt = new Date(aimant[0].expires_at);
      const timeLeftHours = Math.floor((expiresAt - now) / 1000 / 60 / 60);
      const timeLeftMinutes = Math.floor(((expiresAt - now) / 1000 / 60) % 60);

      console.log(`✅ Aimant à Légendaires ACTIF`);
      console.log(`   Temps restant: ${timeLeftHours}h ${timeLeftMinutes}min\n`);
    }

    console.log('='.repeat(80));
    console.log('\n📦 DERNIERS COLLECTIBLES REÇUS (20 derniers)\n');

    // 2. Récupérer les 20 derniers collectibles collectés
    const recentCollectibles = await db.query(`
      SELECT
        col.name,
        col.rarity,
        c.collected_at,
        c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      JOIN players p ON c.player_id = p.id
      WHERE c.guild_id = $1
      AND p.discord_id = $2
      AND c.lost_at IS NULL
      ORDER BY c.collected_at DESC
      LIMIT 20
    `, [GUILD_ID, USER_ID]);

    if (recentCollectibles.length === 0) {
      console.log('❌ Aucun collectible trouvé pour cet utilisateur\n');
      process.exit(0);
    }

    // Afficher tableau avec numérotation inversée
    const formattedData = recentCollectibles.map((item, index) => {
      const rarityEmoji = {
        legendary: '🟡',
        epic: '🟣',
        rare: '🔵',
        common: '⚪'
      }[item.rarity.toLowerCase()] || '⚪';

      const timeAgo = Math.floor((Date.now() - new Date(item.collected_at)) / 1000 / 60);
      const timeDisplay = timeAgo < 1
        ? 'À l\'instant'
        : timeAgo < 60
          ? `Il y a ${timeAgo}min`
          : `Il y a ${Math.floor(timeAgo / 60)}h ${timeAgo % 60}min`;

      return {
        '#': (recentCollectibles.length - index).toString(),
        'Rareté': `${rarityEmoji} ${item.rarity}`,
        'Nom': item.name,
        'Source': item.source || 'mystery_box',
        'Quand': timeDisplay
      };
    });

    console.table(formattedData);

    // 3. Calculer les statistiques de rareté
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 STATISTIQUES DE RARETÉ (sur les 20 derniers)\n');

    const rarityCounts = {
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0
    };

    recentCollectibles.forEach(item => {
      const rarity = item.rarity.toLowerCase();
      if (rarityCounts[rarity] !== undefined) {
        rarityCounts[rarity]++;
      }
    });

    const total = recentCollectibles.length;
    const stats = {
      'Legendary 🟡': {
        'Nombre': rarityCounts.legendary,
        'Pourcentage': `${Math.round((rarityCounts.legendary / total) * 100)}%`
      },
      'Epic 🟣': {
        'Nombre': rarityCounts.epic,
        'Pourcentage': `${Math.round((rarityCounts.epic / total) * 100)}%`
      },
      'Rare 🔵': {
        'Nombre': rarityCounts.rare,
        'Pourcentage': `${Math.round((rarityCounts.rare / total) * 100)}%`
      },
      'Common ⚪': {
        'Nombre': rarityCounts.common,
        'Pourcentage': `${Math.round((rarityCounts.common / total) * 100)}%`
      }
    };

    console.table(stats);

    console.log('\n📊 COMPARAISON AVEC L\'ATTENDU:\n');

    const expected = {
      legendary: 47,
      epic: 13,
      rare: 20,
      common: 20
    };

    const actual = {
      legendary: Math.round((rarityCounts.legendary / total) * 100),
      epic: Math.round((rarityCounts.epic / total) * 100),
      rare: Math.round((rarityCounts.rare / total) * 100),
      common: Math.round((rarityCounts.common / total) * 100)
    };

    console.log(`   Legendary: ${actual.legendary}% (attendu: ${expected.legendary}%) ${actual.legendary >= expected.legendary - 10 ? '✅' : '⚠️'}`);
    console.log(`   Epic:      ${actual.epic}% (attendu: ${expected.epic}%) ${Math.abs(actual.epic - expected.epic) <= 10 ? '✅' : '⚠️'}`);
    console.log(`   Rare:      ${actual.rare}% (attendu: ${expected.rare}%) ${Math.abs(actual.rare - expected.rare) <= 10 ? '✅' : '⚠️'}`);
    console.log(`   Common:    ${actual.common}% (attendu: ${expected.common}%) ${Math.abs(actual.common - expected.common) <= 10 ? '✅' : '⚠️'}`);

    console.log('\n💡 Note: Sur 10-20 essais, des variations sont normales.');
    console.log('   Pour vérifier la tendance, il faudrait 50-100 essais.\n');

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

monitorAimantResults();
