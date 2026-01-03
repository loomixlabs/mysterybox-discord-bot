require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const DISCUSSION_CHANNEL_ID = '1264703299584786484';
const TARGET_TIME = new Date('2025-11-14T08:03:00'); // Autour de 08:03

async function investigateKeywordConflict() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔍 INVESTIGATION: Conflit de mots-clés potentiel\n');
    console.log('━'.repeat(80));

    // 1. Vérifier TOUTES les missions actives autour de 08:03
    console.log('📊 Étape 1: Missions actives autour de 08:03\n');

    const before = new Date(TARGET_TIME.getTime() - 600000); // 10 min avant
    const after = new Date(TARGET_TIME.getTime() + 600000); // 10 min après

    const activeMissions = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type, m.validation_data,
              p.username, p.discord_id
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       JOIN players p ON mp.player_id = p.id
       WHERE mp.guild_id = $1
       AND mp.created_at BETWEEN $2 AND $3
       AND m.type = 'keyword-message'
       ORDER BY mp.created_at`,
      [GUILD_ID, before, after]
    );

    console.log(`   Total missions actives: ${activeMissions.length}\n`);

    // Grouper par mot-clé
    const keywordMap = {};

    activeMissions.forEach(mission => {
      if (mission.validation_data) {
        const data = JSON.parse(mission.validation_data);
        const keyword = data.keyword;

        if (!keywordMap[keyword]) {
          keywordMap[keyword] = [];
        }

        keywordMap[keyword].push({
          username: mission.username,
          discord_id: mission.discord_id,
          thread_id: mission.thread_id,
          status: mission.status,
          created_at: mission.created_at,
          completed_at: mission.completed_at
        });
      }
    });

    console.log('   📝 Mots-clés assignés:\n');

    Object.keys(keywordMap).forEach(keyword => {
      const missions = keywordMap[keyword];
      console.log(`   🔑 "${keyword}" - ${missions.length} mission(s):`);

      missions.forEach(m => {
        const status = m.status === 'completed' ? '✅' : m.status === 'in_progress' ? '⏳' : '❌';
        console.log(`      ${status} ${m.username} (Thread: ${m.thread_id})`);
        console.log(`         Créée: ${new Date(m.created_at).toLocaleTimeString()}`);
        console.log(`         Complétée: ${m.completed_at ? new Date(m.completed_at).toLocaleTimeString() : 'N/A'}`);
      });
      console.log('');
    });

    // Vérifier s'il y a des doublons
    const duplicates = Object.keys(keywordMap).filter(k => keywordMap[k].length > 1);

    if (duplicates.length > 0) {
      console.log('   ⚠️  DOUBLONS DÉTECTÉS !\n');
      duplicates.forEach(keyword => {
        console.log(`   ❗ Mot "${keyword}" assigné à ${keywordMap[keyword].length} joueurs différents`);
      });
      console.log('');
    }

    console.log('━'.repeat(80));

    // 2. Lire les messages du canal de discussion autour de 08:03
    console.log('\n📨 Étape 2: Messages dans #discussion-blabla autour de 08:03\n');

    await client.login(process.env.DISCORD_TOKEN);
    const channel = await client.channels.fetch(DISCUSSION_CHANNEL_ID);

    // Récupérer les messages autour de 08:03
    const messages = await channel.messages.fetch({ limit: 100 });

    // Filtrer les messages entre 08:00 et 08:10
    const targetMessages = Array.from(messages.values()).filter(msg => {
      const msgTime = msg.createdAt;
      return msgTime >= new Date('2025-11-14T08:00:00') &&
             msgTime <= new Date('2025-11-14T08:10:00');
    }).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    console.log(`   Messages entre 08:00 et 08:10: ${targetMessages.length}\n`);

    // Chercher les mots-clés dans les messages
    const keywordsToSearch = Object.keys(keywordMap);

    targetMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      const foundKeywords = keywordsToSearch.filter(k => content.includes(k.toLowerCase()));

      if (foundKeywords.length > 0) {
        console.log(`   [${msg.createdAt.toLocaleTimeString()}] ${msg.author.tag}`);
        console.log(`      Message: ${msg.content}`);
        console.log(`      🔑 Mots trouvés: ${foundKeywords.join(', ')}`);
        console.log('');
      }
    });

    console.log('━'.repeat(80));

    // 3. Vérifier spécifiquement le mot "sorcière"
    console.log('\n🎯 Étape 3: Focus sur le mot "sorcière"\n');

    if (keywordMap['sorcière']) {
      console.log(`   Joueurs ayant ce mot:`);
      keywordMap['sorcière'].forEach(m => {
        console.log(`   - ${m.username} (Thread: ${m.thread_id}, Statut: ${m.status})`);
      });
      console.log('');

      // Chercher qui a dit "sorcière"
      const sorciereMessages = targetMessages.filter(msg =>
        msg.content.toLowerCase().includes('sorcière')
      );

      console.log(`   Messages contenant "sorcière": ${sorciereMessages.length}\n`);

      sorciereMessages.forEach(msg => {
        console.log(`   [${msg.createdAt.toLocaleTimeString()}] ${msg.author.tag} (${msg.author.id})`);
        console.log(`      "${msg.content}"`);
        console.log('');
      });
    }

    console.log('━'.repeat(80));

    await db.close();
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

investigateKeywordConflict();
