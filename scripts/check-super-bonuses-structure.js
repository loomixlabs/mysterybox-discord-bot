const db = require('../utils/database-pg');

async function checkStructure() {
  console.log('\n🔍 VÉRIFICATION STRUCTURE - super_bonuses\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Structure de la table
    console.log('\n📊 COLONNES DE LA TABLE:\n');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(columns);

    // Exemple de bonus
    console.log('\n📋 EXEMPLE DE BONUS (Jackpot x2):\n');
    const bonus = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE bonus_id = 'jackpot_x2' AND guild_id = $1
    `, [guildId]);
    console.table([bonus]);

    // Liste des bonus avec leur rareté
    console.log('\n✨ LISTE DES BONUS PAR RARETÉ:\n');
    const bonuses = await db.queryAll(`
      SELECT bonus_id, name, rarity, icon, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY
        CASE rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
        END,
        name
    `, [guildId]);
    console.table(bonuses);

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkStructure();
