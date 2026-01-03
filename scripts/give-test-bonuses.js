const db = require('../utils/database-pg');

async function giveTestBonuses() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🎁 ATTRIBUTION DE BONUS DE TEST\n');
    console.log('='.repeat(80));

    // Récupérer tous les super bonuses disponibles
    const availableBonuses = await db.query(
      `SELECT id, name, icon, effect_type, duration_type, duration_value, activation_mode
       FROM super_bonuses
       WHERE guild_id = $1
       ORDER BY id`,
      [guildId]
    );

    if (availableBonuses.length === 0) {
      console.log('❌ Aucun super bonus configuré sur ce serveur\n');
      process.exit(1);
    }

    console.log(`✅ ${availableBonuses.length} super bonus disponibles\n`);

    // Sélectionner quelques bonus pour le test
    const bonusesToGive = [
      { id: 12, name: 'Chance du Diable' }, // Automatique temporaire
      { id: 13, name: 'Vision Divine' }, // Manuel charges
      { id: 14, name: 'Aimant à Légendaires' }, // Automatique temporaire
      { id: 19, name: 'Jackpot x2' }, // Manuel charges
      { id: 15, name: 'Aura de Célébrité' }, // Manuel temporaire
    ];

    console.log('📦 Attribution de 5 bonus de test:');
    console.log('-'.repeat(80));

    for (const bonusToGive of bonusesToGive) {
      // Trouver le bonus dans la liste
      const bonus = availableBonuses.find(b => b.id === bonusToGive.id);

      if (!bonus) {
        console.log(`⚠️  Bonus ${bonusToGive.name} (ID ${bonusToGive.id}) introuvable`);
        continue;
      }

      // Vérifier si le joueur a déjà ce bonus
      const existing = await db.query(
        `SELECT id FROM player_active_bonuses
         WHERE user_id = $1 AND guild_id = $2 AND bonus_id = $3`,
        [userId, guildId, bonus.id]
      );

      if (existing.length > 0) {
        console.log(`⚠️  ${bonus.icon || '✨'} ${bonus.name} - Déjà possédé (ID: ${existing[0].id})`);
        continue;
      }

      // Calculer expires_at selon le type
      let expiresAt = null;
      let remainingCharges = null;

      if (bonus.activation_mode === 'automatic') {
        // Les bonus automatiques sont activés immédiatement
        if (bonus.duration_type === 'temporary' && bonus.duration_value) {
          expiresAt = new Date(Date.now() + bonus.duration_value * 1000);
        } else if (bonus.duration_type === 'charges') {
          remainingCharges = bonus.duration_value;
        }

        // Ajouter le bonus avec activated_at = NOW()
        const result = await db.query(
          `INSERT INTO player_active_bonuses (
            guild_id, user_id, bonus_id, activated_at, expires_at, remaining_charges, is_active, obtained_from
          ) VALUES ($1, $2, $3, NOW(), $4, $5, TRUE, 'admin_test')
          RETURNING id`,
          [guildId, userId, bonus.id, expiresAt, remainingCharges]
        );

        let statusText = '';
        if (bonus.duration_type === 'permanent') {
          statusText = '♾️ Permanent';
        } else if (bonus.duration_type === 'charges') {
          statusText = `🔢 ${remainingCharges} charge(s)`;
        } else if (bonus.duration_type === 'temporary') {
          const hours = Math.floor(bonus.duration_value / 3600);
          const minutes = Math.floor((bonus.duration_value % 3600) / 60);
          statusText = `⏱️ ${hours}h ${minutes}min`;
        }

        console.log(`✅ ${bonus.icon || '✨'} ${bonus.name} - ACTIF (${bonus.activation_mode}) ${statusText} (ID: ${result[0].id})`);
      } else {
        // Les bonus manuels restent en attente (activated_at = NULL)
        const result = await db.query(
          `INSERT INTO player_active_bonuses (
            guild_id, user_id, bonus_id, activated_at, expires_at, remaining_charges, is_active, obtained_from
          ) VALUES ($1, $2, $3, NULL, NULL, $4, TRUE, 'admin_test')
          RETURNING id`,
          [guildId, userId, bonus.id, bonus.duration_type === 'charges' ? bonus.duration_value : null]
        );

        let durationText = '';
        if (bonus.duration_type === 'permanent') {
          durationText = '♾️ Permanent';
        } else if (bonus.duration_type === 'charges') {
          durationText = `🔢 ${bonus.duration_value} charge(s)`;
        } else if (bonus.duration_type === 'temporary') {
          const hours = Math.floor(bonus.duration_value / 3600);
          const minutes = Math.floor((bonus.duration_value % 3600) / 60);
          durationText = `⏱️ ${hours}h ${minutes}min`;
        }

        console.log(`✅ ${bonus.icon || '🎯'} ${bonus.name} - EN ATTENTE (${bonus.activation_mode}) ${durationText} (ID: ${result[0].id})`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Attribution terminée');
    console.log('\n💡 Utilise /profile sur Discord puis clique sur "💫 Mes Bonus" pour voir et activer tes bonus!\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

giveTestBonuses();
