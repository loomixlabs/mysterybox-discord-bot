const db = require('../utils/database-pg');

async function checkBonusId8() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test

    console.log('🔍 VÉRIFICATION DU BONUS ID 8\n');
    console.log('='.repeat(80));

    // Récupérer le bonus ID 8
    const bonus = await db.queryOne(
      `SELECT
        pab.*,
        sb.name,
        sb.description,
        sb.icon,
        sb.effect_type,
        sb.duration_type,
        sb.duration_value,
        sb.activation_mode
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.id = $1
       AND pab.guild_id = $2`,
      [8, guildId]
    );

    if (!bonus) {
      console.log('❌ Aucun bonus trouvé avec ID 8\n');

      // Vérifier s'il a été supprimé
      console.log('🔍 Recherche dans les bonus inactifs ou expirés...\n');

      const allBonuses = await db.query(
        `SELECT
          pab.*,
          sb.name,
          sb.description,
          sb.icon
         FROM player_active_bonuses pab
         LEFT JOIN super_bonuses sb ON pab.bonus_id = sb.id
         WHERE pab.guild_id = $1
         ORDER BY pab.id DESC
         LIMIT 20`,
        [guildId]
      );

      console.log(`📊 Les 20 derniers bonus (ID décroissant):\n`);
      allBonuses.forEach(b => {
        console.log(`ID: ${b.id} | ${b.icon || '?'} ${b.name || 'Inconnu'} | Actif: ${b.is_active ? '✅' : '❌'} | Charges: ${b.remaining_charges || 'N/A'}`);
      });

      process.exit(0);
    }

    console.log(`✅ Bonus ID 8 trouvé:\n`);
    console.log(`  ${bonus.icon || '✨'} ${bonus.name}`);
    console.log(`  Description: ${bonus.description}`);
    console.log(`  Type: ${bonus.effect_type}`);
    console.log(`  Mode: ${bonus.activation_mode}`);
    console.log(`  Durée: ${bonus.duration_type} (${bonus.duration_value})`);
    console.log(`\n  État dans player_active_bonuses:`);
    console.log(`  - bonus_id: ${bonus.bonus_id}`);
    console.log(`  - user_id: ${bonus.user_id}`);
    console.log(`  - activated_at: ${bonus.activated_at ? new Date(bonus.activated_at).toLocaleString('fr-FR') : 'NULL'}`);
    console.log(`  - expires_at: ${bonus.expires_at ? new Date(bonus.expires_at).toLocaleString('fr-FR') : 'NULL'}`);
    console.log(`  - remaining_charges: ${bonus.remaining_charges}`);
    console.log(`  - is_active: ${bonus.is_active ? '✅ OUI' : '❌ NON'}`);
    console.log(`  - obtained_from: ${bonus.obtained_from}\n`);

    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkBonusId8();
