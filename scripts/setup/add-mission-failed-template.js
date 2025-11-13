const db = require('./utils/database-pg');

async function addMissionFailedTemplate() {
  try {
    const guildId = '297309737135898624';

    console.log('📝 Ajout du template mission_failed...\n');

    // Vérifier si le template existe déjà
    const existing = await db.queryOne(`
      SELECT * FROM announcement_templates
      WHERE guild_id = $1 AND type = 'mission_failed'
    `, [guildId]);

    if (existing) {
      console.log('✅ Le template mission_failed existe déjà!');
      process.exit(0);
    }

    // Créer le template mission_failed
    await db.query(`
      INSERT INTO announcement_templates (
        guild_id, type, title, description, color, image_url, thumbnail_url, footer_text
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      guildId,
      'mission_failed',
      '❌ MISSION ÉCHOUÉE !',
      '**{userName}** n\'a pas réussi la mission **{missionName}**.\n\n**Raison:** {failReason}',
      '#e74c3c',
      null,
      null,
      'Meilleure chance la prochaine fois !'
    ]);

    console.log('✅ Template mission_failed créé avec succès!\n');

    // Vérifier
    const templates = await db.queryAll(`
      SELECT type, title FROM announcement_templates
      WHERE guild_id = $1 AND type LIKE 'mission%'
      ORDER BY type
    `, [guildId]);

    console.log(`📋 Templates de missions (${templates.length}):`);
    templates.forEach(t => console.log(`   - ${t.type}: ${t.title}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addMissionFailedTemplate();
