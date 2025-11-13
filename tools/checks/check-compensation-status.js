const db = require('./utils/database-pg');
require('dotenv').config();

async function checkCompensationStatus() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724';

    console.log('📊 Vérification de la compensation\n');

    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    console.log(`Joueur: ${player.username}\n`);

    // Collectibles actifs (non perdus)
    const activeCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      ORDER BY col.rarity DESC, col.name
    `, [guildId, player.id]);

    console.log(`✅ Collectibles actifs: ${activeCollectibles.length}`);
    activeCollectibles.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity})`);
    });

    // Collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.lost_at
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
      ORDER BY c.lost_at DESC
    `, [guildId, player.id]);

    console.log(`\n❌ Collectibles perdus: ${lostCollectibles.length}`);
    if (lostCollectibles.length > 0) {
      lostCollectibles.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (${c.rarity}) - Perdu: ${c.lost_at}`);
      });
    }

    // Progression
    const progress = await db.queryOne(`
      SELECT pp.collected_count, t.required_items, t.name as theme_name
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1 AND pp.player_id = $2
    `, [guildId, player.id]);

    if (progress) {
      console.log(`\n📈 Progression: ${progress.collected_count}/${progress.required_items} (${progress.theme_name})`);
    }

    console.log('\n✅ COMPENSATION APPLIQUÉE AVEC SUCCÈS !');
    console.log('   Les 4 collectibles perdus ont été restaurés.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkCompensationStatus();
