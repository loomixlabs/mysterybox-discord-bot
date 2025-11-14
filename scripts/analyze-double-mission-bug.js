require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const THREAD_ID = '1438873799436013694';
const GUILD_ID = '1248028543389143070';

async function analyzeDoubleMissionBug() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    console.log('━'.repeat(80));
    console.log('📍 ÉTAPE 1: Lecture du thread Discord\n');

    const thread = await client.channels.fetch(THREAD_ID);

    if (!thread) {
      console.error('❌ Thread introuvable');
      process.exit(1);
    }

    console.log(`🧵 Thread: ${thread.name}`);
    console.log(`   Parent: ${thread.parent?.name || 'N/A'}`);
    console.log(`   Archivé: ${thread.archived ? 'Oui' : 'Non'}`);
    console.log(`   Créé: ${thread.createdAt}\n`);

    // Récupérer tous les messages du thread
    const messages = await thread.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).reverse();

    console.log('📨 MESSAGES DU THREAD:\n');

    sortedMessages.forEach((msg, index) => {
      console.log(`[${index + 1}] ${msg.author.tag} - ${msg.createdAt.toLocaleString()}`);
      if (msg.content) {
        console.log(`    ${msg.content}`);
      }
      if (msg.embeds.length > 0) {
        msg.embeds.forEach(embed => {
          if (embed.title) console.log(`    📋 ${embed.title}`);
          if (embed.description) {
            const desc = embed.description.substring(0, 200);
            console.log(`       ${desc}${embed.description.length > 200 ? '...' : ''}`);
          }
        });
      }
      console.log('');
    });

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 2: Vérification en base de données\n');

    // Récupérer la mission du thread
    const threadMission = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type, p.username, p.discord_id, p.id as player_id
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       JOIN players p ON mp.player_id = p.id
       WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
      [GUILD_ID, THREAD_ID]
    );

    if (threadMission.length === 0) {
      console.log('❌ Aucune mission trouvée pour ce thread');
      await client.destroy();
      await db.close();
      process.exit(0);
    }

    const mission = threadMission[0];
    console.log(`🎯 Mission du thread:`);
    console.log(`   Joueur: ${mission.username} (ID: ${mission.player_id}, Discord: ${mission.discord_id})`);
    console.log(`   Mission: ${mission.mission_name}`);
    console.log(`   Type: ${mission.type}`);
    console.log(`   Statut: ${mission.status}`);
    console.log(`   Créée: ${mission.created_at}`);
    console.log(`   Complétée: ${mission.completed_at || 'N/A'}`);
    console.log(`   Mot-clé: ${mission.target_keyword || 'N/A'}`);
    console.log(`   Canal cible: ${mission.target_channel_id || 'N/A'}`);
    console.log('');

    console.log('━'.repeat(80));
    console.log('🔍 ÉTAPE 3: Recherche de missions simultanées\n');

    // Trouver TOUTES les missions de ce joueur actives au même moment
    const before = new Date(mission.created_at);
    before.setMinutes(before.getMinutes() - 30); // 30 min avant
    const after = new Date(mission.created_at);
    after.setMinutes(after.getMinutes() + 30); // 30 min après

    const simultaneousMissions = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1
       AND mp.player_id = $2
       AND mp.created_at BETWEEN $3 AND $4
       ORDER BY mp.created_at`,
      [GUILD_ID, mission.player_id, before, after]
    );

    console.log(`   Missions autour de ${mission.created_at.toLocaleString()}:`);
    console.log(`   (Période: ${before.toLocaleTimeString()} - ${after.toLocaleTimeString()})\n`);

    simultaneousMissions.forEach((m, i) => {
      const isCurrent = m.thread_id === THREAD_ID;
      const marker = isCurrent ? '👉' : '  ';
      console.log(`${marker} [${i + 1}] ${m.mission_name} (${m.type})`);
      console.log(`      Thread: ${m.thread_id}`);
      console.log(`      Statut: ${m.status}`);
      console.log(`      Créée: ${m.created_at.toLocaleString()}`);
      console.log(`      Mot-clé: ${m.target_keyword || 'N/A'}`);
      console.log(`      Canal: ${m.target_channel_id || 'N/A'}`);
      console.log('');
    });

    // Vérifier si plusieurs missions avaient le même mot-clé
    console.log('━'.repeat(80));
    console.log('⚠️  ÉTAPE 4: Analyse des conflits de mots-clés\n');

    const keywords = simultaneousMissions
      .filter(m => m.target_keyword)
      .map(m => m.target_keyword);

    const keywordCounts = {};
    keywords.forEach(kw => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });

    const duplicateKeywords = Object.keys(keywordCounts).filter(kw => keywordCounts[kw] > 1);

    if (duplicateKeywords.length > 0) {
      console.log('   🚨 CONFLIT DÉTECTÉ !');
      console.log(`   Le joueur avait ${duplicateKeywords.length} mot(s)-clé(s) en DOUBLON:\n`);
      duplicateKeywords.forEach(kw => {
        console.log(`   ⚠️  Mot "${kw}" - ${keywordCounts[kw]} missions simultanées`);

        // Lister les missions avec ce mot-clé
        const missionsWithKeyword = simultaneousMissions.filter(m => m.target_keyword === kw);
        missionsWithKeyword.forEach(m => {
          console.log(`      - Thread ${m.thread_id}: ${m.status}`);
        });
        console.log('');
      });

      console.log('   💡 EXPLICATION DU BUG:');
      console.log('   Quand un autre joueur dit le mot-clé en doublon,');
      console.log('   le système ne sait pas quelle mission compléter !');
      console.log('   Résultat: Une mission est complétée, l\'autre reste bloquée.');
    } else if (simultaneousMissions.length > 1) {
      console.log('   ✅ Pas de conflit de mots-clés détecté');
      console.log(`   ${simultaneousMissions.length} missions simultanées mais avec des mots différents`);
    } else {
      console.log('   ℹ️  Une seule mission trouvée dans cette période');
    }

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 5: Vérification des collectibles reçus\n');

    // Vérifier les collectibles autour de ces missions
    const firstMission = simultaneousMissions[0];
    const lastMission = simultaneousMissions[simultaneousMissions.length - 1];

    const collectiblesBefore = new Date(firstMission.created_at);
    collectiblesBefore.setMinutes(collectiblesBefore.getMinutes() - 5);

    const collectiblesAfter = new Date(lastMission.created_at);
    collectiblesAfter.setMinutes(collectiblesAfter.getMinutes() + 120); // 2h après

    const collectibles = await db.query(
      `SELECT col.*, c.name, c.rarity
       FROM collections col
       JOIN collectibles c ON col.collectible_id = c.id
       WHERE col.guild_id = $1 AND col.player_id = $2
       AND col.collected_at BETWEEN $3 AND $4
       AND col.source = 'mission'
       ORDER BY col.collected_at`,
      [GUILD_ID, mission.player_id, collectiblesBefore, collectiblesAfter]
    );

    if (collectibles.length === 0) {
      console.log('   ❌ AUCUN collectible reçu pour ces missions !');
    } else {
      console.log(`   Collectibles reçus: ${collectibles.length}\n`);
      collectibles.forEach((col, i) => {
        console.log(`   [${i + 1}] ${col.name} (${col.rarity})`);
        console.log(`       Collecté: ${col.collected_at.toLocaleString()}`);
        console.log(`       Source: ${col.source}`);
        console.log('');
      });

      // Comparer avec le nombre de missions complétées
      const completedCount = simultaneousMissions.filter(m => m.status === 'completed').length;

      if (collectibles.length < completedCount) {
        console.log(`   ⚠️  PROBLÈME: ${completedCount} missions complétées mais seulement ${collectibles.length} collectible(s) reçu(s)`);
      } else if (collectibles.length > completedCount) {
        console.log(`   ⚠️  PROBLÈME: ${collectibles.length} collectibles reçus mais seulement ${completedCount} mission(s) complétée(s)`);
      } else {
        console.log(`   ✅ Cohérence: ${completedCount} missions complétées = ${collectibles.length} collectible(s)`);
      }
    }

    console.log('\n' + '━'.repeat(80));

    await db.close();
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

analyzeDoubleMissionBug();
