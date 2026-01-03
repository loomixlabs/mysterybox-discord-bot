/**
 * Setup du mini-jeu de réaction Harry Potter
 * Similaire au jeu de la pomme de Blanche-Neige
 *
 * Pour le serveur: 1182395170273099806 (Test HP)
 */
const db = require('../utils/database-pg');

const HP_GUILD_ID = '1182395170273099806';

async function setup() {
  console.log('\n' + '═'.repeat(60));
  console.log('⚡ SETUP MINI-JEU RÉACTION HARRY POTTER');
  console.log('═'.repeat(60));

  try {
    // 1. Créer la table générique reaction_game_winners si elle n'existe pas
    console.log('\n📋 1. Création/vérification table reaction_game_winners...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS reaction_game_winners (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        game_type VARCHAR(50) NOT NULL DEFAULT 'apple',
        won_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, guild_id, game_type)
      )
    `);
    console.log('   ✅ Table reaction_game_winners prête');

    // 2. Créer la table de configuration des mini-jeux
    console.log('\n📋 2. Création/vérification table reaction_games...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS reaction_games (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        game_type VARCHAR(50) NOT NULL,
        message_id VARCHAR(20),
        channel_id VARCHAR(20) NOT NULL,
        emoji VARCHAR(50) NOT NULL,
        role_id VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        theme_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, game_type)
      )
    `);
    console.log('   ✅ Table reaction_games prête');

    // 3. Vérifier si le jeu HP existe déjà
    console.log('\n📋 3. Vérification configuration existante...');

    const existingGame = await db.queryOne(
      `SELECT * FROM reaction_games WHERE guild_id = $1 AND game_type = $2`,
      [HP_GUILD_ID, 'hp_golden_snitch']
    );

    if (existingGame) {
      console.log('   ⚠️ Configuration HP déjà existante:');
      console.log(`      - Channel: ${existingGame.channel_id}`);
      console.log(`      - Message: ${existingGame.message_id || 'Non défini'}`);
      console.log(`      - Emoji: ${existingGame.emoji}`);
      console.log(`      - Rôle: ${existingGame.role_id || 'Non défini'}`);
      console.log(`      - Actif: ${existingGame.is_active ? 'Oui' : 'Non'}`);
    } else {
      // 4. Insérer la configuration HP
      console.log('\n📋 4. Insertion configuration Harry Potter...');

      // Note: Les IDs devront être mis à jour avec les vrais IDs du serveur
      await db.query(`
        INSERT INTO reaction_games (guild_id, game_type, channel_id, emoji, theme_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        HP_GUILD_ID,
        'hp_golden_snitch',
        '0000000000000000000', // À remplacer par le vrai channel ID
        '⚡', // Emoji éclair pour HP
        'Harry Potter',
        false // Inactif tant que le message_id n'est pas défini
      ]);

      console.log('   ✅ Configuration HP créée (inactive, en attente des IDs)');
    }

    // 5. Afficher les instructions
    console.log('\n' + '═'.repeat(60));
    console.log('📝 PROCHAINES ÉTAPES:');
    console.log('═'.repeat(60));
    console.log(`
1. CRÉER LE MESSAGE MYSTÈRE sur le serveur HP:
   - Poster un message énigmatique dans un canal
   - Copier l'ID du message

2. CRÉER LE RÔLE sur le serveur HP:
   - Créer un rôle type "Attrapeur de Vif d'Or" ou "Sorcier Émérite"
   - Copier l'ID du rôle

3. METTRE À JOUR LA CONFIGURATION:
   UPDATE reaction_games
   SET message_id = 'ID_MESSAGE',
       channel_id = 'ID_CHANNEL',
       role_id = 'ID_ROLE',
       is_active = true
   WHERE guild_id = '${HP_GUILD_ID}' AND game_type = 'hp_golden_snitch';

4. ACTIVER LE JEU dans index.js:
   reactionHandler.addGame({
     guildId: '${HP_GUILD_ID}',
     gameType: 'hp_golden_snitch',
     messageId: 'ID_MESSAGE',
     channelId: 'ID_CHANNEL',
     emoji: '⚡',
     roleId: 'ID_ROLE'
   });
`);

    // 6. Lister tous les mini-jeux configurés
    console.log('\n📊 TOUS LES MINI-JEUX CONFIGURÉS:');
    const allGames = await db.queryAll(`SELECT * FROM reaction_games ORDER BY guild_id, game_type`);

    if (allGames.length === 0) {
      console.log('   Aucun mini-jeu configuré');
    } else {
      console.table(allGames.map(g => ({
        guild_id: g.guild_id,
        type: g.game_type,
        theme: g.theme_name,
        emoji: g.emoji,
        actif: g.is_active ? '✅' : '❌',
        message: g.message_id ? g.message_id.substring(0, 10) + '...' : 'Non défini'
      })));
    }

    console.log('\n✅ Setup terminé !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

setup();
