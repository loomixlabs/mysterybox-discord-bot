const db = require('./utils/database-pg');

async function personalizeTraps() {
  try {
    console.log('🎨 Personnalisation des pièges pour le thème Blanche-Neige...\n');

    // Récupérer le thème Blanche-Neige
    const theme = await db.queryOne(`
      SELECT id, name, guild_id
      FROM themes
      WHERE name LIKE '%Blanche%'
    `);

    if (!theme) {
      console.error('❌ Thème Blanche-Neige introuvable');
      process.exit(1);
    }

    console.log(`✅ Thème trouvé: ${theme.name} (ID: ${theme.id})\n`);

    const guildId = theme.guild_id;
    const themeId = theme.id;

    // 1. Piège Temporel → La Pomme Empoisonnée
    console.log('🍎 Mise à jour: La Pomme Empoisonnée (cooldown)...');
    await db.query(`
      UPDATE traps
      SET
        name = 'La Pomme Empoisonnée',
        description = 'Une pomme rouge empoisonnée offerte par la Reine. Un simple croquer et tu tomberas dans un sommeil profond...',
        shame_message = '🍎 Tu as croqué dans la pomme empoisonnée ! Tu t''endors pour {duration} minutes...',
        notif_title = '🍎 Pomme Empoisonnée !',
        notif_description = '**Oh non !** Tu as croqué dans la pomme rouge de la Reine !\n\n😴 Tu tombes dans un sommeil magique et ne peux plus ouvrir de boîtes pendant **{duration} minutes**.\n\n💡 Seul un baiser d''amour véritable... ou la patience te réveillera !',
        notif_color = '#dc143c',
        notif_footer = 'Le sort se dissipera automatiquement'
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'cooldown'
    `, [guildId, themeId]);
    console.log('✅ Pomme Empoisonnée personnalisée\n');

    // 2. Piège Voleur → Le Miroir de la Reine
    console.log('🪞 Mise à jour: Le Miroir de la Reine (lose-collectible)...');
    await db.query(`
      UPDATE traps
      SET
        name = 'Le Miroir de la Reine',
        description = 'Le miroir magique de la méchante Reine. Il peut faire disparaître ce qui te rend plus beau que la Reine...',
        shame_message = '🪞 Le Miroir Magique a jugé que tu étais trop beau ! Il t''a volé : **{collectible}**',
        notif_title = '🪞 Miroir, Miroir Magique !',
        notif_description = '**Miroir, mon beau miroir...**\n\nLa Reine jalouse a utilisé son miroir pour te voler un objet précieux !\n\n💎 **Objet perdu:** {collectible}\n\n⚠️ La Reine ne supporte pas qu''on soit plus beau qu''elle !',
        notif_color = '#9400d3',
        notif_footer = 'Le miroir a parlé... et volé'
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'lose-collectible'
    `, [guildId, themeId]);
    console.log('✅ Miroir de la Reine personnalisé\n');

    // 3. Piège de la Honte → Les 7 Nains Moqueurs
    console.log('👨‍👨‍👦‍👦 Mise à jour: Les 7 Nains Moqueurs (public-shame)...');
    await db.query(`
      UPDATE traps
      SET
        name = 'Les 7 Nains Moqueurs',
        description = 'Les 7 nains adorent se moquer des maladroits ! Prof, Joyeux, Simplet, Dormeur, Timide, Atchoum et Grincheux te montrent du doigt.',
        shame_message = '🤡 Les 7 Nains se moquent de {user} ! "Ah ah ah ! Quelle maladresse !" - Joyeux | "Je te l''avais dit !" - Prof | "Hi hi hi !" - Simplet',
        notif_title = '👨‍👨‍👦‍👦 Les 7 Nains te Voient !',
        notif_description = '**Oups !** Les 7 nains t''ont vu tomber dans le piège !\n\n🤡 **Prof dit:** "Je te l''avais bien dit !"\n😄 **Joyeux dit:** "Ah ah ah ! Quelle rigolade !"\n🤪 **Simplet dit:** "Hi hi hi !"\n\n💡 Tout le monde est au courant de ta maladresse maintenant !',
        notif_color = '#ff6347',
        notif_footer = 'Les 7 nains se souviendront de ça'
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'public-shame'
    `, [guildId, themeId]);
    console.log('✅ 7 Nains Moqueurs personnalisés\n');

    // 4. Piège Maudit → La Malédiction de la Reine
    console.log('👑 Mise à jour: La Malédiction de la Reine (points-malus)...');
    await db.query(`
      UPDATE traps
      SET
        name = 'La Malédiction de la Reine',
        description = 'La méchante Reine a jeté une malédiction sombre sur toi. Des points de malchance s''accumulent...',
        shame_message = '👑 La Reine t''a maudit ! +{points} points de malédiction de la méchante Reine !',
        notif_title = '👑 Malédiction Royale !',
        notif_description = '**La méchante Reine t''a repéré !**\n\nElle a jeté une malédiction sombre sur toi par jalousie.\n\n👻 **+{points} points de malédiction** s''ajoutent à ton âme.\n\n⚠️ La Reine ne pardonne jamais à ceux qui osent être plus beaux qu''elle !',
        notif_color = '#8b008b',
        notif_footer = 'La malédiction de la Reine est éternelle'
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'points-malus'
    `, [guildId, themeId]);
    console.log('✅ Malédiction de la Reine personnalisée\n');

    // Afficher le résultat final
    console.log('📋 Récapitulatif des pièges personnalisés:\n');
    const traps = await db.queryAll(`
      SELECT name, type, description
      FROM traps
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY
        CASE type
          WHEN 'cooldown' THEN 1
          WHEN 'lose-collectible' THEN 2
          WHEN 'public-shame' THEN 3
          WHEN 'points-malus' THEN 4
        END
    `, [guildId, themeId]);

    traps.forEach((trap, index) => {
      console.log(`${index + 1}. 🎭 ${trap.name} (${trap.type})`);
      console.log(`   ${trap.description}\n`);
    });

    console.log('✅ Tous les pièges ont été personnalisés pour Blanche-Neige ! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

personalizeTraps();
