const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./utils/database-pg');
require('dotenv').config();

async function fixSpecificThread() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🤖 Connexion au bot Discord...\n');
    await client.login(process.env.DISCORD_TOKEN);

    const guildId = '1248028543389143070';
    const threadId = '1438267586495119380';

    console.log('✅ Bot connecté !\n');
    console.log(`🔍 Analyse du thread ${threadId}...\n`);

    const guild = await client.guilds.fetch(guildId);
    const thread = await guild.channels.fetch(threadId);

    if (!thread || !thread.isThread()) {
      console.log('❌ Thread introuvable');
      await client.destroy();
      process.exit(1);
    }

    console.log(`✅ Thread trouvé: ${thread.name}\n`);

    // Récupérer le propriétaire du thread (joueur de la mission)
    const ownerId = thread.ownerId;
    console.log(`👤 Propriétaire du thread: ${ownerId}\n`);

    // Récupérer les informations du joueur depuis la base de données
    const player = await db.queryOne(`
      SELECT id, username, discord_id FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, ownerId]);

    if (!player) {
      console.log('❌ Joueur introuvable dans la base de données');
      await client.destroy();
      process.exit(1);
    }

    console.log(`✅ Joueur: ${player.username} (Player ID: ${player.id})\n`);

    // Analyser la situation actuelle
    console.log('═'.repeat(70));
    console.log('📊 ANALYSE DE LA SITUATION\n');

    // Collectibles actifs
    const activeCollectibles = await db.queryAll(`
      SELECT col.id as collectible_id, col.name, col.rarity, c.collected_at, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      ORDER BY c.collected_at DESC
    `, [guildId, player.id]);

    console.log(`📦 Collectibles actifs: ${activeCollectibles.length}`);
    activeCollectibles.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
      const date = new Date(c.collected_at).toLocaleString('fr-FR');
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - ${c.source} - ${date}`);
    });

    const missionCollectibles = activeCollectibles.filter(c => c.source === 'mission').length;
    console.log(`\n   → ${missionCollectibles} de missions\n`);

    // Collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT col.id as collectible_id, col.name, col.rarity, c.lost_at, c.source, c.id as collection_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
      ORDER BY c.lost_at DESC
    `, [guildId, player.id]);

    console.log(`❌ Collectibles perdus: ${lostCollectibles.length}`);
    if (lostCollectibles.length > 0) {
      lostCollectibles.forEach((c, i) => {
        const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
        const date = new Date(c.lost_at).toLocaleString('fr-FR');
        console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - ${c.source} - perdu: ${date}`);
      });
    }

    // Missions complétées
    const missions = await db.queryAll(`
      SELECT mp.status, mp.created_at, mp.completed_at, m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2
      ORDER BY mp.created_at DESC
      LIMIT 10
    `, [guildId, player.id]);

    const completedMissions = missions.filter(m => m.status === 'completed').length;
    console.log(`\n✅ Missions complétées: ${completedMissions}`);

    // Progression
    const progress = await db.queryOne(`
      SELECT pp.collected_count, t.required_items, t.name as theme_name, t.id as theme_id
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1 AND pp.player_id = $2
    `, [guildId, player.id]);

    console.log(`📈 Progression: ${progress.collected_count}/${progress.required_items} (${progress.theme_name})\n`);

    // Analyse du problème
    console.log('═'.repeat(70));
    console.log('🔍 ANALYSE DU PROBLÈME\n');

    const missingRewards = completedMissions - missionCollectibles;
    console.log(`Missions complétées: ${completedMissions}`);
    console.log(`Collectibles de missions: ${missionCollectibles}`);
    console.log(`Récompenses manquantes: ${missingRewards}`);
    console.log(`Collectibles perdus: ${lostCollectibles.length}\n`);

    // Déterminer la compensation
    let compensationNeeded = 0;
    const actions = [];

    if (lostCollectibles.length > 0) {
      actions.push(`Restaurer ${lostCollectibles.length} collectible(s) perdu(s)`);
      compensationNeeded += lostCollectibles.length;
    }

    if (missingRewards > 0) {
      actions.push(`Donner ${missingRewards} collectible(s) pour missions non récompensées`);
      compensationNeeded += missingRewards;
    }

    console.log('💡 COMPENSATION REQUISE:\n');
    actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });

    if (compensationNeeded === 0) {
      console.log('\n✅ Aucune compensation nécessaire - Le joueur est déjà à jour\n');
      await client.destroy();
      process.exit(0);
    }

    // Appliquer la compensation
    console.log('\n═'.repeat(70));
    console.log('🎁 APPLICATION DE LA COMPENSATION\n');

    const restoredCollectibles = [];
    const givenCollectibles = [];

    // 1. Restaurer les collectibles perdus
    if (lostCollectibles.length > 0) {
      console.log('🔧 Restauration des collectibles perdus:\n');

      for (const lost of lostCollectibles) {
        await db.query(`
          UPDATE collections
          SET lost_at = NULL
          WHERE id = $1
        `, [lost.collection_id]);

        const emoji = lost.rarity === 'legendary' ? '⭐' : lost.rarity === 'epic' ? '💎' : lost.rarity === 'rare' ? '🔷' : '⚪';
        console.log(`   ✅ ${emoji} ${lost.name} (${lost.rarity})`);
        restoredCollectibles.push(lost);
      }
    }

    // 2. Donner les récompenses manquantes
    if (missingRewards > 0) {
      console.log('\n🎁 Récompenses de missions:\n');

      let givenCount = 0;
      let attempts = 0;
      const maxAttempts = 200;

      while (givenCount < missingRewards && attempts < maxAttempts) {
        attempts++;

        const randomCollectible = await db.getRandomCollectible(guildId, progress.theme_id);
        if (!randomCollectible) break;

        const alreadyHas = await db.hasCollectible(guildId, player.id, randomCollectible.id);
        if (alreadyHas) continue;

        await db.addCollectible(guildId, player.id, randomCollectible.id, 'mission');

        givenCount++;
        const emoji = randomCollectible.rarity === 'legendary' ? '⭐' :
                      randomCollectible.rarity === 'epic' ? '💎' :
                      randomCollectible.rarity === 'rare' ? '🔷' : '⚪';

        console.log(`   ${givenCount}. ✅ ${emoji} ${randomCollectible.name} (${randomCollectible.rarity})`);
        givenCollectibles.push(randomCollectible);
      }
    }

    // 3. Mettre à jour la progression
    console.log('\n📊 Mise à jour de la progression:\n');

    const newCount = await db.queryOne(`
      SELECT COUNT(*) as total FROM collections
      WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
    `, [guildId, player.id]);

    await db.query(`
      UPDATE player_progress
      SET collected_count = $1
      WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
    `, [parseInt(newCount.total), guildId, player.id, progress.theme_id]);

    console.log(`   Progression: ${newCount.total}/${progress.required_items}`);

    if (parseInt(newCount.total) >= progress.required_items) {
      console.log(`   🎉 THÈME COMPLÉTÉ !`);
    }

    // 4. Envoyer le message de compensation dans le thread
    console.log('\n📨 Envoi du message de compensation dans le thread:\n');

    const embed = new EmbedBuilder()
      .setTitle('🔧 COMPENSATION - Bug Résolu')
      .setDescription(
        `Bonjour ${player.username} ! 👋\n\n` +
        `Un bug a empêché la validation de cette mission. ` +
        `Le problème a été corrigé et tu as reçu ta compensation ! 🎁`
      )
      .setColor('#00FF00');

    embed.addFields({
      name: '🐛 Problème',
      value: `Le système ne pouvait pas donner de récompense aux joueurs qui avaient perdu des collectibles via un piège.`,
      inline: false
    });

    if (restoredCollectibles.length > 0) {
      const restoredList = restoredCollectibles.map((c, i) => {
        const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
        return `${i + 1}. ${emoji} **${c.name}** (${c.rarity})`;
      }).join('\n');

      embed.addFields({
        name: '🔧 Collectibles Restaurés',
        value: restoredList,
        inline: false
      });
    }

    if (givenCollectibles.length > 0) {
      const givenList = givenCollectibles.map((c, i) => {
        const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
        return `${i + 1}. ${emoji} **${c.name}** (${c.rarity})`;
      }).join('\n');

      embed.addFields({
        name: '🎁 Récompenses de Missions',
        value: givenList,
        inline: false
      });
    }

    embed.addFields({
      name: '📊 Ta Progression',
      value: `Tu as maintenant **${newCount.total}/${progress.required_items}** collectibles !` +
             (parseInt(newCount.total) >= progress.required_items ? '\n\n🎉 **Thème complété !** Tu peux obtenir ton rôle final !' : ''),
      inline: false
    });

    embed.setFooter({ text: 'Merci de ta patience !' });
    embed.setTimestamp();

    await thread.send({ embeds: [embed] });

    console.log(`   ✅ Message envoyé dans le thread "${thread.name}"`);

    console.log('\n═'.repeat(70));
    console.log('\n✅ COMPENSATION TERMINÉE\n');
    console.log(`👤 Joueur: ${player.username}`);
    console.log(`📊 Progression: ${newCount.total}/${progress.required_items}`);
    console.log(`📦 Collectibles restaurés: ${restoredCollectibles.length}`);
    console.log(`🎁 Collectibles donnés: ${givenCollectibles.length}`);
    console.log(`📨 Message envoyé dans le thread\n`);
    console.log('═'.repeat(70));

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

fixSpecificThread();