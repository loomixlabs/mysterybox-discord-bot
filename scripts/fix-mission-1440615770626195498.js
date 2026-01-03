require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const THREAD_ID = '1440615770626195498';
const GUILD_ID = '1248028543389143070';
const MISSION_PROGRESS_ID = 268;
const KEYWORD = 'Joyeux';

async function fixMission() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🔧 RÉPARATION DE LA MISSION\n');
    console.log('='.repeat(80));
    console.log(`Thread ID: ${THREAD_ID}`);
    console.log(`Mission Progress ID: ${MISSION_PROGRESS_ID}`);
    console.log(`Keyword à assigner: "${KEYWORD}"\n`);

    // =====================================================
    // 1. RÉCUPÉRER LE THREAD ET LE MISSION_PROGRESS
    // =====================================================
    console.log('📌 ÉTAPE 1: Récupération des données\n');

    const thread = await client.channels.fetch(THREAD_ID);
    if (!thread) {
      throw new Error('Thread introuvable');
    }
    console.log(`✅ Thread trouvé: "${thread.name}"`);

    const mp = await db.queryOne(
      `SELECT mp.*, m.timeout
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.id = $1 AND mp.guild_id = $2`,
      [MISSION_PROGRESS_ID, GUILD_ID]
    );

    if (!mp) {
      throw new Error('Mission progress introuvable');
    }
    console.log(`✅ Mission progress trouvé (ID: ${mp.id})`);
    console.log(`   Timeout de la mission: ${mp.timeout} minutes\n`);

    // =====================================================
    // 2. CALCULER LA NOUVELLE DATE D'EXPIRATION
    // =====================================================
    console.log('📌 ÉTAPE 2: Calcul de la nouvelle date d\'expiration\n');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + mp.timeout * 60000);

    console.log(`   Maintenant: ${now.toLocaleString('fr-FR')}`);
    console.log(`   Expire dans: ${mp.timeout} minutes`);
    console.log(`   Nouvelle expiration: ${expiresAt.toLocaleString('fr-FR')}\n`);

    // =====================================================
    // 3. METTRE À JOUR LE MISSION_PROGRESS
    // =====================================================
    console.log('📌 ÉTAPE 3: Mise à jour du mission_progress\n');

    const parentChannelId = thread.parentId;
    console.log(`   Canal cible (parent): ${parentChannelId}\n`);

    await db.query(
      `UPDATE mission_progress
       SET target_keyword = $1,
           target_channel_id = $2,
           expires_at = $3
       WHERE id = $4 AND guild_id = $5`,
      [KEYWORD, parentChannelId, expiresAt, MISSION_PROGRESS_ID, GUILD_ID]
    );

    console.log('✅ Mission progress mis à jour avec:');
    console.table({
      target_keyword: KEYWORD,
      target_channel_id: parentChannelId,
      expires_at: expiresAt.toLocaleString('fr-FR')
    });

    // =====================================================
    // 4. VÉRIFIER QUE LA MISE À JOUR A FONCTIONNÉ
    // =====================================================
    console.log('\n📌 ÉTAPE 4: Vérification de la mise à jour\n');

    const updatedMp = await db.queryOne(
      `SELECT * FROM mission_progress WHERE id = $1`,
      [MISSION_PROGRESS_ID]
    );

    if (updatedMp.target_keyword === KEYWORD && updatedMp.target_channel_id === parentChannelId) {
      console.log('✅ Vérification réussie - Données correctement enregistrées\n');
    } else {
      throw new Error('Échec de la vérification - Les données n\'ont pas été sauvegardées');
    }

    // =====================================================
    // 5. RENVOYER LE MESSAGE D'INSTRUCTION DANS LE THREAD
    // =====================================================
    console.log('📌 ÉTAPE 5: Envoi du message d\'instruction dans le thread\n');

    // Récupérer le branding
    const branding = await db.getGuildBranding(GUILD_ID);

    const instructionEmbed = new EmbedBuilder()
      .setTitle('🎯 **Mission: Faire deviner un mot !**')
      .setDescription(
        `📝 Tu dois faire dire le mot **"${KEYWORD}"** 🟡 *(medium)* à un autre joueur dans le salon <#${parentChannelId}> !\n\n` +
        `💬 **Comment ?**\n` +
        `Engage une conversation naturelle et amène l'autre joueur à dire ce mot.\n\n` +
        `⏰ **Temps restant:** ${mp.timeout} minutes\n\n` +
        `✅ **Validation:** Automatique dès que quelqu'un dit le mot`
      )
      .setColor(branding.secondary_color)
      .setFooter({ text: 'Loomix • Bot de Giveaway Gamifié', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

    await thread.send({
      embeds: [instructionEmbed]
    });

    console.log('✅ Message d\'instruction envoyé dans le thread\n');

    // =====================================================
    // 6. RÉSUMÉ FINAL
    // =====================================================
    console.log('📌 RÉSUMÉ FINAL');
    console.log('='.repeat(80));
    console.log('✅ Mission réparée avec succès !');
    console.log(`✅ Keyword assigné: "${KEYWORD}"`);
    console.log(`✅ Canal cible: ${parentChannelId}`);
    console.log(`✅ Expire le: ${expiresAt.toLocaleString('fr-FR')}`);
    console.log(`✅ Message d'instruction renvoyé dans le thread`);
    console.log('\n🎯 Le joueur peut maintenant compléter sa mission !');
    console.log('🔍 Le bot surveillera les messages dans le canal cible\n');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la réparation:', error);
    console.error(error);
    await client.destroy();
    process.exit(1);
  }
}

fixMission();
