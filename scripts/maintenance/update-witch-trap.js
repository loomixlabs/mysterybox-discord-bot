const db = require('./utils/database-pg');

async function updateWitchTrap() {
  try {
    console.log('🧙‍♀️ Mise à jour du piège Voleur avec le thème de la Sorcière...\n');

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

    // Mise à jour du Piège Voleur → La Sorcière Voleuse
    console.log('🧙‍♀️ Mise à jour: La Sorcière Voleuse (lose-collectible)...');
    await db.query(`
      UPDATE traps
      SET
        name = 'La Sorcière Voleuse',
        description = 'La méchante sorcière déguisée rode et convoite tes objets précieux. Elle peut t''ensorceler et voler ce que tu as de plus cher...',
        shame_message = '🧙‍♀️ La Sorcière t''a ensorcelé ! Elle t''a volé : **{collectible}**',
        notif_title = '🧙‍♀️ La Sorcière Voleuse !',
        notif_description = '**Attention !** La méchante sorcière déguisée t''a jeté un sort !\\n\\nElle a volé un objet précieux de ta collection par jalousie et magie noire.\\n\\n💎 **Objet volé:** {collectible}\\n\\n⚠️ La sorcière est rusée et vole les plus beaux trésors !',
        notif_color = '#4b0082',
        notif_footer = 'La sorcière s''est enfuie avec ton trésor'
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'lose-collectible'
    `, [guildId, themeId]);
    console.log('✅ La Sorcière Voleuse personnalisée\n');

    // Vérifier le résultat
    const trap = await db.queryOne(`
      SELECT name, type, description, shame_message
      FROM traps
      WHERE guild_id = $1 AND theme_id = $2 AND type = 'lose-collectible'
    `, [guildId, themeId]);

    if (trap) {
      console.log('📋 Résultat final:\n');
      console.log(`🎭 ${trap.name} (${trap.type})`);
      console.log(`   ${trap.description}`);
      console.log(`   Message: ${trap.shame_message}\n`);
    }

    console.log('✅ Le piège a été modifié avec succès ! 🧙‍♀️');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

updateWitchTrap();
