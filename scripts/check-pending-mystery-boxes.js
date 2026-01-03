const db = require('../utils/database-pg');

/**
 * Vérifier les mystery boxes en attente (non ouvertes)
 */
async function checkPendingMysteryBoxes() {
  console.log('\n🔍 VÉRIFICATION - Mystery Boxes en Attente\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Mystery boxes non ouvertes
    const pendingBoxes = await db.queryAll(`
      SELECT
        gl.id,
        gl.item_type,
        gl.item_id,
        gl.channel_id,
        gl.message_id,
        gl.winner_id,
        gl.winner_username,
        gl.created_at,
        CASE
          WHEN gl.item_type = 'collectible' THEN c.name
          WHEN gl.item_type = 'mission' THEN m.name
          WHEN gl.item_type = 'trap' THEN t.name
          WHEN gl.item_type = 'super_bonus' THEN sb.name
          ELSE 'Unknown'
        END as item_name,
        CASE
          WHEN gl.item_type = 'collectible' THEN c.rarity
          WHEN gl.item_type = 'super_bonus' THEN sb.rarity
          ELSE NULL
        END as rarity
      FROM give_logs gl
      LEFT JOIN collectibles c ON gl.item_type = 'collectible' AND gl.item_id = c.id AND gl.guild_id = c.guild_id
      LEFT JOIN missions m ON gl.item_type = 'mission' AND gl.item_id = m.id AND gl.guild_id = m.guild_id
      LEFT JOIN traps t ON gl.item_type = 'trap' AND gl.item_id = t.id AND gl.guild_id = t.guild_id
      LEFT JOIN super_bonuses sb ON gl.item_type = 'super_bonus' AND gl.item_id = sb.id AND gl.guild_id = sb.guild_id
      WHERE gl.guild_id = $1
      AND gl.winner_id IS NULL
      AND gl.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY gl.created_at DESC
    `, [guildId]);

    console.log(`\n📋 Mystery Boxes en attente (dernière heure): ${pendingBoxes.length}\n`);

    if (pendingBoxes.length > 0) {
      console.table(pendingBoxes.map(box => ({
        'ID': box.id,
        'Type': box.item_type,
        'Item ID': box.item_id,
        'Nom': box.item_name,
        'Rareté': box.rarity || 'N/A',
        'Message ID': box.message_id,
        'Créé il y a': Math.round((Date.now() - new Date(box.created_at).getTime()) / 60000) + ' min'
      })));
    } else {
      console.log('⚠️  Aucune mystery box en attente dans la dernière heure');
    }

    // Statistiques par type
    console.log('\n📊 STATISTIQUES PAR TYPE (dernière heure):\n');
    const stats = await db.queryAll(`
      SELECT
        item_type,
        COUNT(*) as total,
        COUNT(winner_id) as opened,
        COUNT(*) - COUNT(winner_id) as pending
      FROM give_logs
      WHERE guild_id = $1
      AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY item_type
      ORDER BY total DESC
    `, [guildId]);

    if (stats.length > 0) {
      console.table(stats);
    } else {
      console.log('⚠️  Aucune mystery box créée dans la dernière heure');
    }

    // Derniers super bonus créés
    console.log('\n✨ DERNIERS SUPER BONUS CRÉÉS:\n');
    const recentSuperBonuses = await db.queryAll(`
      SELECT
        gl.id,
        gl.item_id,
        sb.name,
        sb.rarity,
        sb.activation_mode,
        gl.message_id,
        gl.winner_id,
        gl.created_at
      FROM give_logs gl
      JOIN super_bonuses sb ON gl.item_id = sb.id AND gl.guild_id = sb.guild_id
      WHERE gl.guild_id = $1
      AND gl.item_type = 'super_bonus'
      ORDER BY gl.created_at DESC
      LIMIT 10
    `, [guildId]);

    if (recentSuperBonuses.length > 0) {
      console.table(recentSuperBonuses.map(bonus => ({
        'ID': bonus.id,
        'Bonus': bonus.name,
        'Rareté': bonus.rarity,
        'Mode': bonus.activation_mode,
        'Message ID': bonus.message_id,
        'Ouvert': bonus.winner_id ? '✅' : '⏳',
        'Créé il y a': Math.round((Date.now() - new Date(bonus.created_at).getTime()) / 60000) + ' min'
      })));
    } else {
      console.log('⚠️  Aucun super bonus créé récemment');
    }

    // Configuration actuelle
    console.log('\n⚙️  CONFIGURATION ACTUELLE:\n');
    const config = await db.queryOne(`
      SELECT
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1 AND t.is_active = true
    `, [guildId]);

    console.table([{
      'Collectible (%)': config.probability_collectible,
      'Mission (%)': config.probability_mission,
      'Trap (%)': config.probability_trap,
      'Super Bonus (%)': config.probability_super_bonus,
      'TOTAL (%)': config.probability_collectible + config.probability_mission + config.probability_trap + config.probability_super_bonus
    }]);

    console.log('\n💡 ACTIONS RECOMMANDÉES:');
    if (pendingBoxes.filter(b => b.item_type === 'super_bonus').length > 0) {
      console.log('   1. Il y a des super bonus en attente d\'ouverture');
      console.log('   2. Cliquer sur "🎁 Ouvrir" dans Discord');
      console.log('   3. Vérifier les logs du bot pour voir si handleMysteryBoxOpen() est appelé');
    } else {
      console.log('   1. Aucun super bonus en attente actuellement');
      console.log('   2. Créer une nouvelle mystery box en utilisant /admin-panel → Give');
      console.log('   3. Avec config actuelle (100% super bonus), la prochaine box sera un super bonus');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkPendingMysteryBoxes();
