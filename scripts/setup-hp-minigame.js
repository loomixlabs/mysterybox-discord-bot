/**
 * Setup du mini-jeu Harry Potter
 * - Liste les canaux accessibles
 * - Crée le rôle "Sorcier Perspicace"
 */
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('⚡ SETUP MINI-JEU HARRY POTTER');
  console.log('═'.repeat(60));

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`\n✅ Connecté au serveur: ${guild.name}`);

    // ═══════════════════════════════════════════════════════════════
    // 1. LISTER TOUS LES CANAUX TEXTE ACCESSIBLES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📋 1. CANAUX TEXTE ACCESSIBLES:');
    console.log('─'.repeat(60));

    const channels = await guild.channels.fetch();
    const textChannels = channels.filter(c =>
      c && c.type === 0 && // 0 = GUILD_TEXT
      c.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages)
    );

    const channelList = [];
    textChannels.forEach(channel => {
      channelList.push({
        id: channel.id,
        name: channel.name,
        category: channel.parent?.name || 'Sans catégorie'
      });
    });

    // Trier par catégorie
    channelList.sort((a, b) => a.category.localeCompare(b.category));

    console.log('\n| ID                  | Nom                    | Catégorie            |');
    console.log('|---------------------|------------------------|----------------------|');
    channelList.forEach(ch => {
      console.log(`| ${ch.id} | ${ch.name.padEnd(22)} | ${ch.category.padEnd(20)} |`);
    });

    console.log(`\n📊 Total: ${channelList.length} canaux accessibles`);

    // ═══════════════════════════════════════════════════════════════
    // 2. CRÉER LE RÔLE "SORCIER PERSPICACE"
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📋 2. CRÉATION DU RÔLE:');
    console.log('─'.repeat(60));

    // Vérifier si le rôle existe déjà
    const existingRole = guild.roles.cache.find(r => r.name === 'Sorcier Perspicace');

    if (existingRole) {
      console.log(`⚠️ Le rôle existe déjà: "${existingRole.name}" (ID: ${existingRole.id})`);
      console.log(`\n📝 À mettre dans messageReactionAdd.js:`);
      console.log(`   const HP_ROLE_ID = '${existingRole.id}';`);
    } else {
      // Créer le rôle
      const newRole = await guild.roles.create({
        name: 'Sorcier Perspicace',
        color: '#9B59B6', // Violet magique
        reason: 'Rôle récompense du mini-jeu Harry Potter',
        permissions: [] // Aucune permission spéciale
      });

      console.log(`✅ Rôle créé: "${newRole.name}" (ID: ${newRole.id})`);
      console.log(`   Couleur: ${newRole.hexColor}`);
      console.log(`\n📝 À mettre dans messageReactionAdd.js:`);
      console.log(`   const HP_ROLE_ID = '${newRole.id}';`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. RÉSUMÉ DES PROCHAINES ÉTAPES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('📝 PROCHAINES ÉTAPES:');
    console.log('═'.repeat(60));
    console.log(`
1. CHOISIR les canaux pour les FAUSSES images (leurres)
   → Images de baguettes magiques HP dans plusieurs salons
   → Les joueurs réagiront avec 🪄 mais rien ne se passera

2. POSTER LE VRAI MESSAGE dans le canal ${HP_GUILD_ID}:
   → Canal secret: #1339571870755717120
   → Seule cette image déclenche le mini-jeu

3. RÉCUPÉRER L'ID DU MESSAGE et mettre à jour:
   - messageReactionAdd.js → HP_ROLE_ID
   - index.js → reactionHandler.setHPGameMessageId('ID_MESSAGE')

4. THÈME DES IMAGES suggéré:
   → Baguettes magiques célèbres (Sureau, Phoenix, etc.)
   → Ollivander / Boutique de baguettes
   → Harry avec sa baguette
`);

    // ═══════════════════════════════════════════════════════════════
    // 4. SUGGESTION D'IMAGES THÉMATIQUES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('🖼️ SUGGESTIONS D\'IMAGES (Thème Baguettes):');
    console.log('═'.repeat(60));
    console.log(`
LEURRES (fausses images dans plusieurs canaux):
• La boutique d'Ollivander
• Différentes baguettes magiques exposées
• Hermione avec sa baguette
• Ron avec sa baguette
• Voldemort avec la baguette de Sureau
• Dumbledore avec la baguette de Sureau

VRAIE IMAGE (canal secret):
• La baguette de Harry Potter (plume de phoenix)
  avec un message énigmatique du genre:
  "Seuls les vrais sorciers reconnaissent cette baguette..."
`);

    console.log('\n✅ Setup terminé !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
