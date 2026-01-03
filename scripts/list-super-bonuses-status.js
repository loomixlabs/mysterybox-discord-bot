require('dotenv').config();
const db = require('../utils/database-pg');

async function listBonuses() {
  try {
    console.log('🎁 LISTE DES SUPER BONUSES - STATUT D\'ACTIVATION\n');
    console.log('='.repeat(120));

    const bonuses = await db.queryAll(`
      SELECT
        bonus_id,
        name,
        rarity,
        effect_type,
        activation_mode,
        is_enabled,
        guild_id,
        (SELECT COUNT(*) FROM player_active_bonuses
         WHERE player_active_bonuses.bonus_id = super_bonuses.id) as active_users
      FROM super_bonuses
      ORDER BY guild_id,
               CASE rarity
                 WHEN 'legendary' THEN 1
                 WHEN 'epic' THEN 2
                 WHEN 'rare' THEN 3
                 WHEN 'common' THEN 4
               END,
               name
    `);

    if (bonuses.length === 0) {
      console.log('⚠️  Aucun super bonus trouvé dans la base de données\n');
      process.exit(0);
    }

    // Grouper par guild_id
    const byGuild = bonuses.reduce((acc, bonus) => {
      if (!acc[bonus.guild_id]) {
        acc[bonus.guild_id] = [];
      }
      acc[bonus.guild_id].push(bonus);
      return acc;
    }, {});

    for (const [guildId, guildBonuses] of Object.entries(byGuild)) {
      console.log(`\n📍 Guild: ${guildId}`);
      console.log('-'.repeat(120));

      const tableData = guildBonuses.map(b => ({
        '🆔 ID': b.bonus_id,
        '📛 Nom': b.name,
        '⭐ Rareté': b.rarity,
        '🎯 Type': b.effect_type,
        '🔄 Mode': b.activation_mode,
        '✅ Activé': b.is_enabled ? '🟢 OUI' : '🔴 NON',
        '👥 Utilisateurs': b.active_users
      }));

      console.table(tableData);

      const enabled = guildBonuses.filter(b => b.is_enabled).length;
      const disabled = guildBonuses.filter(b => !b.is_enabled).length;
      console.log(`📊 Résumé: ${enabled} activés | ${disabled} désactivés | ${guildBonuses.length} total`);
    }

    console.log('\n' + '='.repeat(120));
    console.log(`✅ Total global: ${bonuses.length} super bonuses`);
    console.log(`🟢 Activés: ${bonuses.filter(b => b.is_enabled).length}`);
    console.log(`🔴 Désactivés: ${bonuses.filter(b => !b.is_enabled).length}`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listBonuses();
