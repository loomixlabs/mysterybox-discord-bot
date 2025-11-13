const db = require('./utils/database-pg');
require('dotenv').config();

async function giveMissionCompensation() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('🎁 Compensation des missions échouées\n');

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    if (!player) {
      console.log('❌ Joueur introuvable');
      process.exit(1);
    }

    console.log(`Joueur: ${player.username} (ID: ${player.id})\n`);

    // 2. Récupérer le thème actif
    const theme = await db.queryOne(`
      SELECT id, name, required_items FROM themes
      WHERE guild_id = $1 AND name LIKE '%Blanche%'
      LIMIT 1
    `, [guildId]);

    if (!theme) {
      console.log('❌ Thème introuvable');
      process.exit(1);
    }

    console.log(`Thème: ${theme.name} (ID: ${theme.id})\n`);

    // 3. Vérifier les collectibles actuels
    const currentCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      ORDER BY col.rarity DESC, col.name
    `, [guildId, player.id]);

    console.log(`📊 Collectibles actuels: ${currentCollectibles.length}\n`);
    currentCollectibles.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - source: ${c.source}`);
    });

    const missionCollectibles = currentCollectibles.filter(c => c.source === 'mission').length;
    console.log(`\n   → Dont ${missionCollectibles} de missions`);
    console.log(`   → Compensation: 3 collectibles\n`);

    // 4. Donner 3 collectibles aléatoires
    console.log('🎁 Attribution des collectibles de compensation:\n');

    const givenCollectibles = [];

    for (let i = 1; i <= 3; i++) {
      // Obtenir un collectible aléatoire
      const randomCollectible = await db.getRandomCollectible(guildId, theme.id);

      if (!randomCollectible) {
        console.log(`   ⚠️  Pas de collectible disponible pour l'attribution ${i}`);
        continue;
      }

      // Vérifier si le joueur l'a déjà (et pas perdu)
      const alreadyHas = await db.hasCollectible(guildId, player.id, randomCollectible.id);

      if (alreadyHas) {
        console.log(`   ⚠️  ${randomCollectible.name} déjà possédé, nouveau tirage...`);
        i--; // Retenter
        continue;
      }

      // Ajouter le collectible avec source "mission"
      await db.addCollectible(guildId, player.id, randomCollectible.id, 'mission');

      const emoji = randomCollectible.rarity === 'legendary' ? '⭐' :
                    randomCollectible.rarity === 'epic' ? '💎' :
                    randomCollectible.rarity === 'rare' ? '🔷' : '⚪';

      console.log(`   ${i}. ✅ ${emoji} ${randomCollectible.name} (${randomCollectible.rarity})`);
      givenCollectibles.push(randomCollectible);
    }

    // 5. Mettre à jour le compteur de progression
    const newCount = await db.queryOne(`
      SELECT COUNT(*) as total FROM collections
      WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
    `, [guildId, player.id]);

    await db.query(`
      UPDATE player_progress
      SET collected_count = $1
      WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
    `, [parseInt(newCount.total), guildId, player.id, theme.id]);

    console.log(`\n📊 Progression mise à jour: ${newCount.total}/${theme.required_items} collectibles\n`);

    // 6. Résumé
    console.log('═'.repeat(70));
    console.log('\n✅ COMPENSATION TERMINÉE\n');
    console.log(`   🎁 ${givenCollectibles.length} collectibles donnés`);
    console.log(`   📊 Progression: ${newCount.total}/${theme.required_items}`);
    console.log(`   🎯 Collection complète dans ${theme.required_items - parseInt(newCount.total)} collectibles\n`);

    console.log('💡 COLLECTIBLES DONNÉS:');
    givenCollectibles.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' :
                    c.rarity === 'epic' ? '💎' :
                    c.rarity === 'rare' ? '🔷' : '⚪';
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity})`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('\n🎉 Le joueur a maintenant reçu sa compensation pour les 3 missions !');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

giveMissionCompensation();
