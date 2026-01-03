require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const THREAD_ID = '1440615770626195498';
const GUILD_ID = '1248028543389143070'; // Monopoly Friends (prod)

async function analyzeMission() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🔍 ANALYSE COMPLÈTE DE LA MISSION\n');
    console.log('='.repeat(80));
    console.log(`Thread ID: ${THREAD_ID}`);
    console.log(`Guild ID: ${GUILD_ID}\n`);

    // =====================================================
    // 1. VÉRIFIER LE THREAD SUR DISCORD
    // =====================================================
    console.log('📌 ÉTAPE 1: Vérification du thread Discord');
    console.log('-'.repeat(80));

    let thread = null;
    try {
      thread = await client.channels.fetch(THREAD_ID);
      if (thread) {
        console.log('✅ Thread trouvé sur Discord:');
        console.table({
          name: thread.name,
          type: thread.type,
          archived: thread.archived,
          locked: thread.locked,
          parent_id: thread.parentId,
          parent_name: thread.parent?.name || 'N/A',
          created_at: thread.createdAt ? new Date(thread.createdAt).toLocaleString('fr-FR') : 'N/A'
        });

        // Lire les derniers messages
        console.log('\n📝 Derniers messages du thread:');
        const messages = await thread.messages.fetch({ limit: 10 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        for (const msg of sortedMessages) {
          console.log(`   [${new Date(msg.createdTimestamp).toLocaleTimeString('fr-FR')}] ${msg.author.tag}: ${msg.content.substring(0, 100)}`);
          if (msg.components.length > 0) {
            console.log(`      → Boutons: ${msg.components[0]?.components.map(c => c.customId).join(', ')}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Thread introuvable sur Discord:', error.message);
    }

    // =====================================================
    // 2. VÉRIFIER MISSION_PROGRESS EN BASE
    // =====================================================
    console.log('\n\n📌 ÉTAPE 2: Vérification mission_progress en base de données');
    console.log('-'.repeat(80));

    const mp = await db.queryOne(
      `SELECT mp.*,
              p.username, p.discord_id, p.id as player_db_id,
              m.id as mission_db_id, m.name as mission_name, m.type as mission_type,
              m.validation_type, m.timeout
       FROM mission_progress mp
       JOIN players p ON mp.player_id = p.id
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.thread_id = $1 AND mp.guild_id = $2`,
      [THREAD_ID, GUILD_ID]
    );

    if (mp) {
      console.log('✅ Mission progress trouvé:');
      console.table({
        id: mp.id,
        player: mp.username,
        discord_id: mp.discord_id,
        player_db_id: mp.player_db_id,
        mission_name: mp.mission_name,
        mission_db_id: mp.mission_db_id,
        mission_type: mp.mission_type,
        validation_type: mp.validation_type,
        status: mp.status,
        created_at: new Date(mp.created_at).toLocaleString('fr-FR'),
        expires_at: new Date(mp.expires_at).toLocaleString('fr-FR'),
        completed_at: mp.completed_at ? new Date(mp.completed_at).toLocaleString('fr-FR') : 'N/A'
      });

      // Vérifier expiration
      const now = new Date();
      const expiresAt = new Date(mp.expires_at);
      const isExpired = expiresAt < now;

      if (isExpired) {
        const minutesAgo = Math.round((now - expiresAt) / 1000 / 60);
        console.log(`\n⚠️  MISSION EXPIRÉE depuis ${minutesAgo} minutes`);
      } else {
        const minutesLeft = Math.round((expiresAt - now) / 1000 / 60);
        console.log(`\n⏳ Mission expire dans ${minutesLeft} minutes`);
      }

      // =====================================================
      // 3. VÉRIFIER LES KEYWORDS DE LA MISSION
      // =====================================================
      console.log('\n\n📌 ÉTAPE 3: Keywords de la mission');
      console.log('-'.repeat(80));

      if (mp.mission_type === 'keyword-message') {
        const keywords = await db.queryAll(
          `SELECT * FROM mission_keywords WHERE mission_id = $1`,
          [mp.mission_db_id]
        );

        if (keywords.length > 0) {
          console.log(`✅ ${keywords.length} keyword(s) trouvé(s):`);
          console.table(keywords.map(k => ({
            id: k.id,
            keyword: k.keyword,
            difficulty: k.difficulty
          })));
        } else {
          console.log('❌ AUCUN keyword trouvé pour cette mission !');
        }

        // Vérifier le keyword assigné dans mission_progress
        if (mp.target_keyword) {
          console.log(`\n🎯 Keyword assigné au joueur: "${mp.target_keyword}"`);
          console.log(`📍 Canal cible: ${mp.target_channel_id || 'N/A'}`);
        } else {
          console.log('\n❌ AUCUN keyword assigné dans mission_progress !');
        }
      }

      // =====================================================
      // 4. VÉRIFIER L'HISTORIQUE DES MESSAGES DU JOUEUR
      // =====================================================
      console.log('\n\n📌 ÉTAPE 4: Recherche des messages du joueur dans le serveur');
      console.log('-'.repeat(80));

      if (thread && mp.target_channel_id) {
        try {
          const targetChannel = await client.channels.fetch(mp.target_channel_id);
          if (targetChannel) {
            console.log(`✅ Canal cible trouvé: #${targetChannel.name} (${mp.target_channel_id})`);

            // Chercher les messages récents du joueur
            console.log(`\n🔍 Recherche des messages de ${mp.username} dans #${targetChannel.name}...`);
            const channelMessages = await targetChannel.messages.fetch({ limit: 100 });
            const playerMessages = channelMessages.filter(m => m.author.id === mp.discord_id);

            if (playerMessages.size > 0) {
              console.log(`\n📨 ${playerMessages.size} message(s) trouvé(s) du joueur:`);
              const sortedPlayerMessages = Array.from(playerMessages.values())
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                .slice(-10); // Derniers 10 messages

              for (const msg of sortedPlayerMessages) {
                const matchesKeyword = mp.target_keyword && msg.content.toLowerCase().includes(mp.target_keyword.toLowerCase());
                console.log(`   [${new Date(msg.createdTimestamp).toLocaleTimeString('fr-FR')}] "${msg.content}" ${matchesKeyword ? '✅ MATCH!' : ''}`);
              }
            } else {
              console.log(`⚠️  Aucun message du joueur trouvé dans les 100 derniers messages`);
            }
          }
        } catch (error) {
          console.error('❌ Impossible de récupérer le canal cible:', error.message);
        }
      }

      // =====================================================
      // 5. VÉRIFIER LES COOLDOWNS ET MALUS
      // =====================================================
      console.log('\n\n📌 ÉTAPE 5: Cooldowns et malus du joueur');
      console.log('-'.repeat(80));

      const cooldowns = await db.queryAll(
        `SELECT * FROM player_cooldowns
         WHERE guild_id = $1 AND player_id = $2 AND expires_at > NOW()
         ORDER BY expires_at ASC`,
        [GUILD_ID, mp.player_db_id]
      );

      if (cooldowns.length > 0) {
        console.log(`⚠️  ${cooldowns.length} cooldown(s) actif(s):`);
        console.table(cooldowns.map(c => ({
          type: c.cooldown_type,
          expires: new Date(c.expires_at).toLocaleString('fr-FR')
        })));
      } else {
        console.log('✅ Aucun cooldown actif');
      }

      const malus = await db.queryOne(
        `SELECT * FROM player_malus_points
         WHERE guild_id = $1 AND player_id = $2`,
        [GUILD_ID, mp.player_db_id]
      );

      if (malus && malus.points > 0) {
        console.log(`\n⚠️  Points de malus: ${malus.points}`);
      } else {
        console.log('✅ Aucun point de malus');
      }

    } else {
      console.log('❌ AUCUN mission_progress trouvé pour ce thread !');

      // Essayer de trouver le bouton dans le thread pour extraire les infos
      if (thread) {
        console.log('\n🔍 Tentative de récupération des infos depuis le bouton...');
        const messages = await thread.messages.fetch({ limit: 10 });

        for (const msg of messages.values()) {
          if (msg.components.length > 0) {
            const button = msg.components[0]?.components[0];
            if (button && button.customId && button.customId.startsWith('mission_start_')) {
              const parts = button.customId.split('_');
              const missionId = parseInt(parts[2]);
              const userId = parts[3];

              console.log('✅ Informations extraites du bouton:');
              console.log(`   Mission ID: ${missionId}`);
              console.log(`   User ID: ${userId}`);

              // Chercher le joueur
              const player = await db.queryOne(
                'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
                [GUILD_ID, userId]
              );

              if (player) {
                console.log(`   Joueur: ${player.username} (DB ID: ${player.id})`);
              }

              break;
            }
          }
        }
      }
    }

    // =====================================================
    // 6. DIAGNOSTIC FINAL
    // =====================================================
    console.log('\n\n📌 DIAGNOSTIC FINAL');
    console.log('='.repeat(80));

    if (!thread) {
      console.log('🔴 PROBLÈME: Thread introuvable sur Discord');
      console.log('   Solution: Thread peut avoir été supprimé manuellement');
    }

    if (!mp) {
      console.log('🔴 PROBLÈME: Mission progress manquant en base de données');
      console.log('   Solution: Exécuter un script de récupération pour créer le mission_progress');
    } else {
      if (mp.status === 'in_progress') {
        const now = new Date();
        const expiresAt = new Date(mp.expires_at);
        if (expiresAt < now) {
          console.log('🔴 PROBLÈME: Mission expirée mais pas marquée comme failed');
          console.log('   Solution: Marquer la mission comme failed et archiver le thread');
        } else {
          console.log('🟢 Mission en cours et non expirée');
        }
      } else if (mp.status === 'completed') {
        console.log('🟢 Mission déjà complétée');
      } else if (mp.status === 'failed') {
        console.log('🟠 Mission marquée comme failed');
      }
    }

    console.log('\n✅ Analyse terminée\n');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
    console.error(error);
    await client.destroy();
    process.exit(1);
  }
}

analyzeMission();
