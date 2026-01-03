/**
 * Script pour réinitialiser les templates d'annonces aux valeurs par défaut
 * Usage: node scripts/reset-announcement-templates.js [guild_id]
 */
const db = require('../utils/database-pg');
const { DEFAULT_ANNOUNCEMENT_TEMPLATES } = require('../utils/announcementDefaults');

async function resetTemplates(guildId) {
  console.log('\n🔄 RÉINITIALISATION DES TEMPLATES D\'ANNONCES\n');
  console.log('='.repeat(60));
  console.log(`📍 Serveur: ${guildId}`);
  console.log('='.repeat(60));

  try {
    // 1. Supprimer les anciens templates
    console.log('\n📋 1. Suppression des anciens templates...');
    const deleted = await db.query(
      'DELETE FROM announcement_templates WHERE guild_id = $1 RETURNING type',
      [guildId]
    );
    console.log(`   ✅ ${deleted.rowCount} template(s) supprimé(s)`);

    // 2. Créer les nouveaux templates par défaut
    console.log('\n📋 2. Création des templates par défaut...');
    let created = 0;

    for (const template of DEFAULT_ANNOUNCEMENT_TEMPLATES) {
      await db.query(
        `INSERT INTO announcement_templates (
          guild_id, type, title, description, color, footer_text, image_url, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          guildId,
          template.type,
          template.title,
          template.description,
          template.color,
          template.footer_text,
          template.image_url,
          template.thumbnail_url
        ]
      );
      console.log(`   ✅ ${template.type}`);
      created++;
    }

    console.log(`\n   Total: ${created} templates créés`);

    // 3. Vérification
    console.log('\n📋 3. Vérification...');
    const verification = await db.queryAll(
      'SELECT type, title FROM announcement_templates WHERE guild_id = $1 ORDER BY type',
      [guildId]
    );

    console.log('\n   Templates actuels:');
    verification.forEach(t => {
      console.log(`   • ${t.type}: ${t.title}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ RÉINITIALISATION TERMINÉE !');
    console.log('='.repeat(60));
    console.log('\n💡 Les templates sont maintenant génériques.');
    console.log('   Le propriétaire peut les personnaliser pour son thème.');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

// Récupérer le guild_id depuis les arguments
const guildId = process.argv[2] || '1248028543389143070';
resetTemplates(guildId);
