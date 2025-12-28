/**
 * Script d'annonce v2.1.0 - Système d'Évolution des Collectibles
 * Design premium avec embeds Discord
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Configuration des canaux d'annonce (à remplir)
const ANNOUNCEMENT_CHANNELS = [
  // { guildId: 'ID_SERVEUR', channelId: 'ID_CANAL' },
];

async function sendAnnouncement(channel) {

  // ═══════════════════════════════════════════════════════════════
  // EMBED 1 : Header Principal
  // ═══════════════════════════════════════════════════════════════
  const headerEmbed = new EmbedBuilder()
    .setColor(0x9B59B6) // Violet premium
    .setTitle('🚀 MISE À JOUR v2.1.0')
    .setDescription(
      '# ✨ Système d\'Évolution des Collectibles\n\n' +
      '> *Vos collectibles prennent vie ! Faites-les évoluer,*\n' +
      '> *collectionnez les premiers mints, et montrez votre collection.*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .setImage('https://i.imgur.com/8QjZmJK.png') // Placeholder - bannière décorative
    .setTimestamp();

  // ═══════════════════════════════════════════════════════════════
  // EMBED 2 : Système de Niveaux
  // ═══════════════════════════════════════════════════════════════
  const levelsEmbed = new EmbedBuilder()
    .setColor(0xF1C40F) // Or
    .setTitle('⭐ Système de Niveaux')
    .setDescription(
      '**Vos collectibles peuvent maintenant évoluer !**\n\n' +
      'Obtenez des **doublons** pour gagner de l\'XP et faire monter vos collectibles en niveau.\n\n'
    )
    .addFields(
      {
        name: '📊 Progression des Niveaux',
        value:
          '```\n' +
          '★       Niveau 1  │  Base\n' +
          '★★      Niveau 2  │  +1 doublon (100 XP)\n' +
          '★★★     Niveau 3  │  +3 doublons (300 XP)\n' +
          '★★★★    Niveau 4  │  +7 doublons (700 XP)\n' +
          '```',
        inline: false
      },
      {
        name: '🖼️ Frames Automatiques',
        value:
          '> Niveau 2 → Frame **Rare** (bleue)\n' +
          '> Niveau 3 → Frame **Épique** (violette)\n' +
          '> Niveau 4 → Frame **Légendaire** (dorée)',
        inline: true
      },
      {
        name: '🔄 Fusion',
        value:
          '> Les doublons ne sont plus perdus !\n' +
          '> Ils **fusionnent** avec votre collectible\n' +
          '> et lui donnent **+100 XP**',
        inline: true
      }
    );

  // ═══════════════════════════════════════════════════════════════
  // EMBED 3 : Système de Mint
  // ═══════════════════════════════════════════════════════════════
  const mintEmbed = new EmbedBuilder()
    .setColor(0xE74C3C) // Rouge
    .setTitle('🏷️ Numéros de Mint')
    .setDescription(
      '**Chaque collectible a désormais un numéro d\'édition unique !**\n\n' +
      'Le **premier** à obtenir un collectible reçoit le **Mint #1** — le plus prestigieux !\n\n'
    )
    .addFields(
      {
        name: '🎨 Codes Couleur',
        value:
          '🥇 **Mint #1** — Fond doré (Premier !)\n' +
          '💜 **Mint #2-10** — Fond violet (Top 10)\n' +
          '💙 **Mint #11-50** — Fond bleu (Top 50)\n' +
          '⬜ **Mint #51+** — Standard',
        inline: true
      },
      {
        name: '💎 Prestige',
        value:
          '> Plus votre numéro est bas,\n' +
          '> plus votre collectible est rare !\n' +
          '> \n' +
          '> *Soyez rapide pour obtenir*\n' +
          '> *les premiers numéros !*',
        inline: true
      }
    );

  // ═══════════════════════════════════════════════════════════════
  // EMBED 4 : Favoris & Carte FLEX
  // ═══════════════════════════════════════════════════════════════
  const favoritesEmbed = new EmbedBuilder()
    .setColor(0x3498DB) // Bleu
    .setTitle('⭐ Favoris & Carte FLEX')
    .setDescription(
      '**Mettez en avant vos plus beaux collectibles !**\n\n'
    )
    .addFields(
      {
        name: '❤️ 3 Favoris',
        value:
          '> Sélectionnez **3 collectibles favoris**\n' +
          '> depuis votre inventaire.\n' +
          '> \n' +
          '> Ils seront mis en avant dans\n' +
          '> votre profil et votre carte FLEX !',
        inline: true
      },
      {
        name: '🃏 Carte FLEX',
        value:
          '> Nouvelle carte visuelle premium !\n' +
          '> \n' +
          '> Affiche vos favoris avec :\n' +
          '> • Frames d\'évolution\n' +
          '> • Étoiles de niveau\n' +
          '> • Numéros de mint',
        inline: true
      }
    )
    .addFields(
      {
        name: '📍 Comment sélectionner ses favoris ?',
        value: '`/profile` → `📦 Inventaire` → Cliquez sur un collectible → `⭐ Favori`',
        inline: false
      }
    );

  // ═══════════════════════════════════════════════════════════════
  // EMBED 5 : Frames de Profil
  // ═══════════════════════════════════════════════════════════════
  const framesEmbed = new EmbedBuilder()
    .setColor(0x9B59B6) // Violet
    .setTitle('🖼️ Frames de Profil Déblocables')
    .setDescription(
      '**Débloquez des frames exclusives pour votre avatar !**\n\n'
    )
    .addFields(
      {
        name: '🥈 Frame Argent',
        value:
          '> **Condition :**\n' +
          '> 5 collectibles au Niveau 3+\n' +
          '> \n' +
          '> *Montrez votre dedication !*',
        inline: true
      },
      {
        name: '🥇 Frame Or',
        value:
          '> **Condition :**\n' +
          '> 1 Légendaire au Niveau 4\n' +
          '> \n' +
          '> *Le graal ultime !*',
        inline: true
      }
    )
    .addFields(
      {
        name: '🌐 Multi-Serveur',
        value: '> Les frames débloquées sont **conservées définitivement** et utilisables sur **tous les serveurs** !',
        inline: false
      }
    );

  // ═══════════════════════════════════════════════════════════════
  // EMBED 6 : Bonus - Restauration
  // ═══════════════════════════════════════════════════════════════
  const bonusEmbed = new EmbedBuilder()
    .setColor(0x2ECC71) // Vert
    .setTitle('🛡️ Restauration des Collectibles')
    .setDescription(
      '**Bonne nouvelle pour les victimes de pièges !**\n\n' +
      '> Si vous perdez un collectible à cause d\'un piège\n' +
      '> et que vous le **regagnez** plus tard...\n' +
      '> \n' +
      '> ✅ Vous **conservez** votre niveau\n' +
      '> ✅ Vous **conservez** votre XP\n' +
      '> ✅ Vous **conservez** votre numéro de mint\n' +
      '> \n' +
      '> *Votre progression n\'est jamais vraiment perdue !*'
    );

  // ═══════════════════════════════════════════════════════════════
  // EMBED 7 : Footer / Call to Action
  // ═══════════════════════════════════════════════════════════════
  const footerEmbed = new EmbedBuilder()
    .setColor(0x1ABC9C) // Turquoise
    .setDescription(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '## 🎮 Prêt à faire évoluer votre collection ?\n\n' +
      '> Utilisez `/profile` pour découvrir toutes les nouveautés !\n' +
      '> \n' +
      '> **Commandes utiles :**\n' +
      '> • `/profile` — Voir votre profil et inventaire\n' +
      '> • `📦 Inventaire` — Gérer vos collectibles\n' +
      '> • `🃏 Carte FLEX` — Partager votre collection\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '*Merci de jouer avec nous !* 💜\n' +
      '*— L\'équipe Loomix Labs*'
    )
    .setFooter({ text: 'Mise à jour v2.1.0 • Décembre 2025' });

  // ═══════════════════════════════════════════════════════════════
  // ENVOI
  // ═══════════════════════════════════════════════════════════════

  try {
    // Envoyer tous les embeds
    await channel.send({
      embeds: [headerEmbed]
    });

    // Petit délai pour l'effet visuel
    await new Promise(r => setTimeout(r, 500));

    await channel.send({
      embeds: [levelsEmbed, mintEmbed]
    });

    await new Promise(r => setTimeout(r, 500));

    await channel.send({
      embeds: [favoritesEmbed, framesEmbed]
    });

    await new Promise(r => setTimeout(r, 500));

    await channel.send({
      embeds: [bonusEmbed, footerEmbed]
    });

    console.log(`✅ Annonce envoyée dans ${channel.guild.name} #${channel.name}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi dans ${channel.id}:`, error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// PREVIEW MODE - Affiche les embeds dans la console
// ═══════════════════════════════════════════════════════════════
function previewAnnouncement() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║            📢 PREVIEW ANNONCE v2.1.0                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 1: Header Principal                                       │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ 🚀 MISE À JOUR v2.1.0                                           │');
  console.log('│                                                                 │');
  console.log('│ ✨ Système d\'Évolution des Collectibles                         │');
  console.log('│                                                                 │');
  console.log('│ > Vos collectibles prennent vie ! Faites-les évoluer,           │');
  console.log('│ > collectionnez les premiers mints, et montrez votre collection │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 2: Système de Niveaux                              [OR]   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ ⭐ Système de Niveaux                                           │');
  console.log('│                                                                 │');
  console.log('│ 📊 Progression des Niveaux                                      │');
  console.log('│ ┌───────────────────────────────────────────┐                   │');
  console.log('│ │ ★       Niveau 1  │  Base                 │                   │');
  console.log('│ │ ★★      Niveau 2  │  +1 doublon (100 XP)  │                   │');
  console.log('│ │ ★★★     Niveau 3  │  +3 doublons (300 XP) │                   │');
  console.log('│ │ ★★★★    Niveau 4  │  +7 doublons (700 XP) │                   │');
  console.log('│ └───────────────────────────────────────────┘                   │');
  console.log('│                                                                 │');
  console.log('│ 🖼️ Frames Automatiques    │  🔄 Fusion                          │');
  console.log('│ > Niv.2 → Frame Rare      │  > Les doublons fusionnent !        │');
  console.log('│ > Niv.3 → Frame Épique    │  > +100 XP par doublon              │');
  console.log('│ > Niv.4 → Frame Légendaire│                                     │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 3: Système de Mint                               [ROUGE]  │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ 🏷️ Numéros de Mint                                              │');
  console.log('│                                                                 │');
  console.log('│ Chaque collectible a un numéro d\'édition unique !               │');
  console.log('│ Premier à obtenir = Mint #1 (le plus prestigieux !)             │');
  console.log('│                                                                 │');
  console.log('│ 🎨 Codes Couleur           │  💎 Prestige                       │');
  console.log('│ 🥇 #1     → Fond doré      │  Plus votre numéro est bas,        │');
  console.log('│ 💜 #2-10  → Fond violet    │  plus c\'est rare !                 │');
  console.log('│ 💙 #11-50 → Fond bleu      │                                    │');
  console.log('│ ⬜ #51+   → Standard       │  Soyez rapide !                    │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 4: Favoris & Carte FLEX                          [BLEU]   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ ⭐ Favoris & Carte FLEX                                         │');
  console.log('│                                                                 │');
  console.log('│ ❤️ 3 Favoris                │  🃏 Carte FLEX                     │');
  console.log('│ Sélectionnez 3 collectibles │  Nouvelle carte visuelle !        │');
  console.log('│ favoris depuis l\'inventaire │  Affiche frames + étoiles + mint  │');
  console.log('│                                                                 │');
  console.log('│ 📍 Comment ? /profile → Inventaire → Collectible → ⭐ Favori    │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 5: Frames de Profil                             [VIOLET]  │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ 🖼️ Frames de Profil Déblocables                                 │');
  console.log('│                                                                 │');
  console.log('│ 🥈 Frame Argent             │  🥇 Frame Or                       │');
  console.log('│ 5 collectibles Niveau 3+    │  1 Légendaire Niveau 4            │');
  console.log('│                                                                 │');
  console.log('│ 🌐 Multi-Serveur : Conservées définitivement sur tous serveurs! │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 6: Restauration                                  [VERT]   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ 🛡️ Restauration des Collectibles                                │');
  console.log('│                                                                 │');
  console.log('│ Si vous perdez un collectible (piège) et le regagnez :          │');
  console.log('│ ✅ Vous conservez votre niveau                                  │');
  console.log('│ ✅ Vous conservez votre XP                                      │');
  console.log('│ ✅ Vous conservez votre numéro de mint                          │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ EMBED 7: Footer                                    [TURQUOISE]  │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│ 🎮 Prêt à faire évoluer votre collection ?                      │');
  console.log('│                                                                 │');
  console.log('│ Commandes utiles :                                              │');
  console.log('│ • /profile — Voir votre profil et inventaire                    │');
  console.log('│ • 📦 Inventaire — Gérer vos collectibles                        │');
  console.log('│ • 🃏 Carte FLEX — Partager votre collection                     │');
  console.log('│                                                                 │');
  console.log('│ Merci de jouer avec nous ! 💜                                   │');
  console.log('│ — L\'équipe Loomix Labs                                          │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Total: 7 embeds • Envoyés en 4 messages avec délais');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);

  // Mode preview
  if (args.includes('--preview') || args.includes('-p')) {
    previewAnnouncement();
    process.exit(0);
  }

  // Mode envoi
  if (ANNOUNCEMENT_CHANNELS.length === 0) {
    console.log('⚠️  Aucun canal configuré !');
    console.log('');
    console.log('Ajoutez les canaux dans ANNOUNCEMENT_CHANNELS :');
    console.log('  { guildId: "123456789", channelId: "987654321" }');
    console.log('');
    console.log('Ou lancez avec --preview pour voir l\'annonce :');
    console.log('  node scripts/post-v2.1.0-evolution-announcement.js --preview');
    process.exit(1);
  }

  console.log('🚀 Connexion au bot...');

  client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    console.log('');

    let success = 0;
    let failed = 0;

    for (const config of ANNOUNCEMENT_CHANNELS) {
      try {
        const channel = await client.channels.fetch(config.channelId);
        if (channel) {
          const result = await sendAnnouncement(channel);
          if (result) success++;
          else failed++;
        } else {
          console.error(`❌ Canal non trouvé: ${config.channelId}`);
          failed++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${config.channelId}:`, error.message);
        failed++;
      }

      // Délai entre serveurs
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ Succès: ${success} | ❌ Échecs: ${failed}`);
    console.log('═══════════════════════════════════════════════════════════════');

    client.destroy();
    process.exit(0);
  });

  client.login(process.env.DISCORD_TOKEN);
}

main();
