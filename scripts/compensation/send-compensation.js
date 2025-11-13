const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./utils/database-pg');
require('dotenv').config();

async function sendCompensation() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages
    ]
  });

  try {
    console.log('🤖 Connexion au bot Discord...\n');
    await client.login(process.env.DISCORD_TOKEN);

    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('✅ Bot connecté !\n');
    console.log('🔍 Récupération des informations...\n');

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    if (!player) {
      console.log('❌ Joueur introuvable');
      await client.destroy();
      process.exit(1);
    }

    console.log(`Joueur: ${player.username} (ID: ${player.id})`);

    // 2. Récupérer les collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT c.id, col.name, col.rarity, col.image_url, c.collectible_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
      ORDER BY col.rarity DESC, c.lost_at DESC
    `, [guildId, player.id]);

    console.log(`📊 Collectibles à restaurer: ${lostCollectibles.length}\n`);

    if (lostCollectibles.length === 0) {
      console.log('✅ Aucun collectible à restaurer !');
      await client.destroy();
      process.exit(0);
    }

    // 3. Restaurer les collectibles (mettre lost_at à NULL)
    console.log('🔧 Restauration des collectibles...\n');

    for (const collectible of lostCollectibles) {
      await db.query(`
        UPDATE collections
        SET lost_at = NULL
        WHERE id = $1
      `, [collectible.id]);

      console.log(`   ✅ Restauré: ${collectible.name} (${collectible.rarity})`);
    }

    // 4. Mettre à jour la progression
    const theme = await db.queryOne(`
      SELECT id, name, required_items FROM themes
      WHERE guild_id = $1 AND name LIKE '%Blanche%'
      LIMIT 1
    `, [guildId]);

    if (theme) {
      const count = await db.queryOne(`
        SELECT COUNT(*) as total FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
      `, [guildId, player.id]);

      await db.query(`
        UPDATE player_progress
        SET collected_count = $1
        WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
      `, [parseInt(count.total), guildId, player.id, theme.id]);

      console.log(`\n   📊 Progression mise à jour: ${count.total}/${theme.required_items} collectibles\n`);
    }

    // 5. Envoyer un message privé au joueur
    console.log('💌 Envoi du message de compensation au joueur...\n');

    const user = await client.users.fetch(discordId);

    // Créer l'embed de compensation
    const embed = new EmbedBuilder()
      .setTitle('🎁 COMPENSATION - Bug Corrigé')
      .setDescription(
        `Bonjour ${player.username} !\n\n` +
        `Un bug dans le système de validation des missions a empêché la distribution des récompenses aujourd'hui. ` +
        `Le problème a été identifié et corrigé.\n\n` +
        `**En compensation, nous t'avons restauré les ${lostCollectibles.length} collectibles perdus :**`
      )
      .setColor('#2ecc71')
      .setTimestamp();

    // Ajouter chaque collectible restauré
    lostCollectibles.forEach((c, i) => {
      const rarityEmoji = {
        'legendary': '⭐',
        'epic': '💎',
        'rare': '🔷',
        'common': '⚪'
      }[c.rarity] || '⚪';

      embed.addFields({
        name: `${i + 1}. ${rarityEmoji} ${c.name}`,
        value: `Rareté: **${c.rarity}**`,
        inline: true
      });
    });

    embed.addFields({
      name: '\n✅ Statut',
      value: 'Tous les collectibles ont été restaurés dans ta collection !',
      inline: false
    });

    embed.addFields({
      name: '🔧 Système Corrigé',
      value:
        `Le bug a été corrigé. Les missions fonctionnent maintenant correctement :\n` +
        `• ✅ Quiz: Récompense donnée après bonne réponse\n` +
        `• ✅ Mot Deviné: Récompense donnée après validation\n` +
        `• ✅ Collectibles perdus peuvent être re-collectés\n\n` +
        `Merci pour ta patience ! 🙏`,
      inline: false
    });

    embed.setFooter({ text: 'Désolé pour ce désagrément !' });

    // Utiliser le thumbnail du collectible légendaire s'il existe
    const legendaryCollectible = lostCollectibles.find(c => c.rarity === 'legendary');
    if (legendaryCollectible && legendaryCollectible.image_url) {
      embed.setThumbnail(legendaryCollectible.image_url);
    }

    try {
      await user.send({ embeds: [embed] });
      console.log('✅ Message de compensation envoyé avec succès !\n');
    } catch (dmError) {
      console.log('⚠️  Impossible d\'envoyer le MP (MPs fermés)\n');
      console.log('💡 Alternative: Envoyer le message dans un canal du serveur\n');
    }

    // 6. Résumé
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ ${lostCollectibles.length} collectibles restaurés`);
    console.log(`   ✅ Progression mise à jour`);
    console.log(`   ✅ Joueur notifié`);
    console.log('\n🎉 Compensation terminée avec succès !');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

sendCompensation();
