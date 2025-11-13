const db = require('./utils/database-pg');
require('dotenv').config();

async function compensateLostCollectibles() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('🔍 Analyse des collectibles perdus\n');

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

    // 2. Vérifier les collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT c.id, col.name, col.rarity, c.collected_at, c.lost_at, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
      ORDER BY c.lost_at DESC
    `, [guildId, player.id]);

    console.log(`📊 Collectibles perdus: ${lostCollectibles.length}\n`);

    if (lostCollectibles.length === 0) {
      console.log('✅ Aucun collectible perdu !');
      process.exit(0);
    }

    // Afficher les collectibles perdus
    lostCollectibles.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.rarity})`);
      console.log(`   - Collecté: ${c.collected_at}`);
      console.log(`   - Perdu: ${c.lost_at}`);
      console.log(`   - Source: ${c.source}`);
      console.log(`   - ID collection: ${c.id}`);
    });

    console.log('\n🎁 OPTIONS DE COMPENSATION:\n');
    console.log('Option 1: Re-collecter les 3 collectibles perdus (mettre lost_at à NULL)');
    console.log('   → Les collectibles redeviennent actifs dans la collection du joueur');
    console.log('   → Commande: node compensate-lost-collectibles.js restore\n');

    console.log('Option 2: Via Discord - Donner des mystery boxes');
    console.log('   → Utilise /admin-panel → Donner Unique → Mystery Box');
    console.log('   → Donne 3 mystery boxes au joueur pour compenser\n');

    console.log('Option 3: Via Discord - Donner des collectibles spécifiques');
    console.log('   → Utilise /admin-panel → Donner Unique → Collectible');
    console.log('   → Choisis les collectibles perdus et redonne-les\n');

    // Si l'argument "restore" est passé, restaurer automatiquement
    if (process.argv[2] === 'restore') {
      console.log('🔧 Restauration des collectibles perdus...\n');

      for (const collectible of lostCollectibles) {
        await db.query(`
          UPDATE collections
          SET lost_at = NULL, updated_at = NOW()
          WHERE id = $1
        `, [collectible.id]);

        console.log(`   ✅ Restauré: ${collectible.name}`);
      }

      // Mettre à jour le compteur de progression
      const theme = await db.queryOne(`
        SELECT id FROM themes WHERE guild_id = $1 AND name LIKE '%Blanche%'
      `, [guildId]);

      if (theme) {
        const count = await db.queryOne(`
          SELECT COUNT(*) as total FROM collections
          WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
        `, [guildId, player.id]);

        await db.query(`
          UPDATE player_progress
          SET collected_count = $1, updated_at = NOW()
          WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
        `, [parseInt(count.total), guildId, player.id, theme.id]);

        console.log(`\n   📊 Compteur de progression mis à jour: ${count.total} collectibles`);
      }

      console.log('\n✅ Restauration terminée !');
      console.log(`Le joueur a maintenant récupéré ses ${lostCollectibles.length} collectibles perdus.\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

compensateLostCollectibles();
