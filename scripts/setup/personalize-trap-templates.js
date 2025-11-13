const db = require('./utils/database-pg');

async function personalizeTrapTemplates() {
  try {
    const guildId = '1248028543389143070';

    console.log('🎨 Personnalisation des templates d\'annonces pour Blanche-Neige...\n');

    const templates = [
      {
        type: 'trap_cooldown',
        title: '🍎 La Pomme Empoisonnée !',
        description: '**{userName}** a croqué dans la pomme empoisonnée !\n\n🎯 **Piège:** {trapName}\n😴 **Effet:** Sommeil magique de **{cooldownMinutes} minutes**\n\n💡 Il tombe dans un sommeil profond et ne peut plus ouvrir de boîtes mystère...',
        color: '#dc143c',
        footer_text: 'Le sort se dissipera automatiquement'
      },
      {
        type: 'trap_lose_collectible',
        title: '🧙‍♀️ La Sorcière Voleuse !',
        description: '**{userName}** a été ensorcelé par la méchante sorcière !\n\n🎯 **Piège:** {trapName}\n💎 **Objet volé:** {collectibleLost}\n\n⚠️ La sorcière déguisée a jeté un sort et volé un objet précieux de sa collection !',
        color: '#4b0082',
        footer_text: 'La sorcière s\'est enfuie avec le trésor'
      },
      {
        type: 'trap_public_shame',
        title: '👨‍👨‍👦‍👦 Les 7 Nains te Voient !',
        description: '**{userName}** est tombé sous les yeux des 7 nains !\n\n🎯 **Piège:** {trapName}\n\n🤡 **Prof dit:** "Je te l\'avais bien dit !"\n😄 **Joyeux dit:** "Ah ah ah ! Quelle rigolade !"\n🤪 **Simplet dit:** "Hi hi hi !"\n\n💡 Les 7 nains se moquent de sa maladresse !',
        color: '#ff6347',
        footer_text: 'Les 7 nains se souviendront de ça'
      },
      {
        type: 'trap_malus_points',
        title: '👑 Malédiction Royale !',
        description: '**{userName}** a été maudit par la méchante Reine !\n\n🎯 **Piège:** {trapName}\n👻 **Effet:** +{malusPoints} points de malédiction de la Reine\n\n⚠️ La Reine jalouse a jeté une malédiction sombre par vengeance !',
        color: '#8b008b',
        footer_text: 'La malédiction de la Reine est éternelle'
      }
    ];

    for (const template of templates) {
      await db.query(
        `UPDATE announcement_templates
         SET title = $1, description = $2, color = $3, footer_text = $4
         WHERE guild_id = $5 AND type = $6`,
        [template.title, template.description, template.color, template.footer_text, guildId, template.type]
      );

      console.log(`✅ Template personnalisé: ${template.type}`);
    }

    // Afficher les templates mis à jour
    const allTemplates = await db.queryAll(
      `SELECT type, title, color FROM announcement_templates
       WHERE guild_id = $1 AND type LIKE 'trap_%'
       ORDER BY type`,
      [guildId]
    );

    console.log('\n📋 Templates personnalisés pour Blanche-Neige:');
    allTemplates.forEach(t => {
      console.log(`   - ${t.type}: ${t.title}`);
    });

    console.log('\n✅ Tous les templates ont été personnalisés ! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

personalizeTrapTemplates();
