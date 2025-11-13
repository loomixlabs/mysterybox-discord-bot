const db = require('./utils/database-pg');

const GUILD_ID = '297309737135898624'; // Ton guild ID

const missionTemplates = [
  {
    type: 'mission_started',
    title: '🎯 MISSION LANCÉE !',
    description: '**{userName}** s\'est lancé dans une nouvelle mission !\n\n📋 Mission: **{missionName}**\n⏱️ Temps accordé: {timeLimit} minutes\n\nBonne chance !',
    color: '#3498db',
    footer_text: 'Système de missions'
  },
  {
    type: 'mission_completed',
    title: '✅ MISSION RÉUSSIE !',
    description: 'Félicitations à **{userName}** !\n\n📋 Mission: **{missionName}**\n🎁 Récompense: **{rewardName}**\n\nBien joué !',
    color: '#2ecc71',
    footer_text: 'Système de missions'
  },
  {
    type: 'mission_failed',
    title: '❌ MISSION ÉCHOUÉE',
    description: '**{userName}** n\'a pas réussi sa mission...\n\n📋 Mission: **{missionName}**\n⚠️ Raison: {failReason}\n\nRéessaye une prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Système de missions'
  },
  {
    type: 'mission_approved',
    title: '👍 MISSION APPROUVÉE !',
    description: 'La mission de **{userName}** a été validée !\n\n📋 Mission: **{missionName}**\n✅ Validé par: {adminName}\n🎁 Récompense: **{rewardName}**\n\nFélicitations !',
    color: '#9b59b6',
    footer_text: 'Système de missions'
  },
  {
    type: 'mission_rejected',
    title: '⛔ MISSION REFUSÉE',
    description: 'La mission de **{userName}** a été refusée.\n\n📋 Mission: **{missionName}**\n❌ Refusé par: {adminName}\n\nVérifie les consignes et réessaye !',
    color: '#c0392b',
    footer_text: 'Système de missions'
  }
];

async function createTemplates() {
  try {
    console.log('🔄 Création des templates d\'annonces missions\n');

    for (const template of missionTemplates) {
      // Vérifier si existe déjà
      const existing = await db.queryOne(
        'SELECT id FROM announcement_templates WHERE guild_id = $1 AND type = $2',
        [GUILD_ID, template.type]
      );

      if (existing) {
        console.log(`⚠️  Template ${template.type} existe déjà (ID: ${existing.id})`);
        continue;
      }

      // Insérer le template
      const result = await db.queryOne(
        `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [GUILD_ID, template.type, template.title, template.description, template.color, template.footer_text]
      );

      console.log(`✅ Template ${template.type} créé (ID: ${result.id})`);
    }

    // Afficher tous les templates missions
    console.log('\n📋 TOUS LES TEMPLATES MISSIONS:');
    const allTemplates = await db.queryAll(`
      SELECT id, type, title, LEFT(description, 50) as description_preview, color
      FROM announcement_templates
      WHERE guild_id = $1 AND type LIKE '%mission%'
      ORDER BY type;
    `, [GUILD_ID]);

    console.table(allTemplates);
    console.log(`\n✅ ${allTemplates.length} template(s) mission(s) au total`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createTemplates();
