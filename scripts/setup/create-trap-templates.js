const db = require('./utils/database-pg');

async function createTrapTemplates() {
  try {
    const guildId = '1248028543389143070';

    console.log(`🎨 Création des templates d'annonces de pièges pour le serveur ${guildId}...\n`);

    const templates = [
      {
        type: 'trap_cooldown',
        title: '⏱️ Piège de Cooldown Déclenché !',
        description: '**{userName}** est tombé dans un piège !\n\n🎯 **Piège:** {trapName}\n⏱️ **Effet:** Cooldown de **{cooldownMinutes} minutes**\n\n💡 Il ne pourra pas ouvrir de boîtes mystère pendant un moment...',
        color: '#f39c12',
        footer_text: 'Système de Pièges'
      },
      {
        type: 'trap_lose_collectible',
        title: '💀 Piège Voleur Activé !',
        description: '**{userName}** a perdu un collectible !\n\n🎯 **Piège:** {trapName}\n🎁 **Objet perdu:** {collectibleLost}\n\n⚠️ Un piège vicieux lui a volé un objet de sa collection !',
        color: '#e74c3c',
        footer_text: 'Système de Pièges'
      },
      {
        type: 'trap_public_shame',
        title: '😱 Piège de la Honte !',
        description: '**{userName}** est tombé dans le piège de la honte !\n\n🎯 **Piège:** {trapName}\n\n🤡 {shameMessage}',
        color: '#9b59b6',
        footer_text: 'Système de Pièges'
      },
      {
        type: 'trap_malus_points',
        title: '⚠️ Piège Maudit Déclenché !',
        description: '**{userName}** est victime d\'une malédiction !\n\n🎯 **Piège:** {trapName}\n👻 **Effet:** +{malusPoints} points de malédiction\n\n⚠️ Ces points pourraient avoir des conséquences négatives...',
        color: '#c0392b',
        footer_text: 'Système de Pièges'
      }
    ];

    for (const template of templates) {
      // Vérifier si le template existe déjà
      const exists = await db.queryOne(
        `SELECT type FROM announcement_templates WHERE guild_id = $1 AND type = $2`,
        [guildId, template.type]
      );

      if (exists) {
        console.log(`⏭️  Template déjà existant: ${template.type}`);
        continue;
      }

      // Créer le template
      await db.query(
        `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guildId, template.type, template.title, template.description, template.color, template.footer_text]
      );

      console.log(`✅ Template créé: ${template.type}`);
    }

    // Ajouter les colonnes dans announcement_settings si elles n'existent pas
    console.log('\n🔧 Vérification des colonnes dans announcement_settings...');

    const settings = await db.queryOne(
      `SELECT trap_cooldown, trap_lose_collectible, trap_public_shame, trap_malus_points
       FROM announcement_settings
       WHERE guild_id = $1`,
      [guildId]
    );

    if (!settings) {
      console.log('✅ Pas de settings existants, ils seront créés automatiquement');
    } else {
      console.log('✅ Settings d\'annonces trouvés');
    }

    // Afficher les templates créés
    const allTemplates = await db.queryAll(
      `SELECT type, title, color FROM announcement_templates
       WHERE guild_id = $1 AND type LIKE 'trap_%'
       ORDER BY type`,
      [guildId]
    );

    console.log('\n📋 Templates de pièges disponibles:');
    allTemplates.forEach(t => {
      console.log(`   - ${t.type}: ${t.title}`);
    });

    console.log('\n✅ Terminé !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createTrapTemplates();
