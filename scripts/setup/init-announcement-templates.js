require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'botdb',
  user: process.env.PGUSER || 'botuser',
  password: process.env.PGPASSWORD || 'Discord2025IA@Bot',
});

const templates = [
  {
    type: 'legendary_collectible',
    title: '⭐ COLLECTIBLE LÉGENDAIRE !',
    description: '**{userName}** vient de trouver un collectible **LÉGENDAIRE** !\n\n🎁 **{collectibleName}**\n\nBravo pour cette découverte exceptionnelle !',
    color: '#ffd700',
    image_url: null
  },
  {
    type: 'collection_completed',
    title: '🎉 COLLECTION COMPLÉTÉE !',
    description: '**{userName}** a complété la collection **{themeName}** !\n\n🏆 Rôle obtenu: {roleName}\n\nFélicitations pour cet exploit !',
    color: '#00ff00',
    image_url: null
  },
  {
    type: 'collection_traded',
    title: '🔄 ÉCHANGE RÉUSSI !',
    description: '**{user1Name}** et **{user2Name}** ont échangé des collectibles !\n\n📋 Mission: {missionName}',
    color: '#3498db',
    image_url: null
  },
  {
    type: 'collection_lost',
    title: '💔 COLLECTIBLE PERDU !',
    description: '**{userName}** a perdu un collectible à cause d\'un piège !\n\n⚠️ Piège: {trapName}\n\nCourage, tu vas te refaire !',
    color: '#e74c3c',
    image_url: null
  },
  {
    type: 'trap_curse',
    title: '😈 MALÉDICTION !',
    description: '**{userName}** est victime d\'une malédiction !\n\n⚠️ **{trapName}**\n💀 Effet: {trapEffect}\n\nBonne chance pour t\'en sortir !',
    color: '#9b59b6',
    image_url: null
  },
  {
    type: 'mission_word_guessed',
    title: '🎯 MOT TROUVÉ !',
    description: '**{userName}** a deviné le mot secret !\n\n💡 Mot: **{word}**\n📋 Mission: {missionName}\n\nBravo pour ta perspicacité !',
    color: '#f39c12',
    image_url: null
  },
  {
    type: 'theme_expired',
    title: '⏰ THÈME EXPIRÉ',
    description: 'Le thème **{themeName}** a expiré après {durationDays} jours !\n\n📅 Date d\'expiration: {expirationDate}\n\nLes collectibles de ce thème ne sont plus disponibles.',
    color: '#e74c3c',
    image_url: null
  },
  {
    type: 'theme_expiring_soon',
    title: '⚠️ THÈME BIENTÔT EXPIRÉ',
    description: 'Le thème **{themeName}** expire bientôt !\n\n⏱️ Temps restant: **{daysRemaining} jour(s)**\n📅 Expiration: {expirationDate}\n\nDépêchez-vous de compléter vos collections !',
    color: '#f39c12',
    image_url: null
  }
];

async function initTemplates() {
  const client = await pool.connect();
  try {
    console.log('\n=== INITIALISATION DES TEMPLATES D\'ANNONCES ===\n');

    const guildId = process.env.GUILD_ID;

    if (!guildId) {
      console.error('❌ GUILD_ID non défini dans .env');
      return;
    }

    console.log(`📋 Guild ID: ${guildId}`);
    console.log(`📊 Templates à créer: ${templates.length}\n`);

    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      // Vérifier si le template existe déjà
      const existing = await client.query(
        `SELECT id FROM announcement_templates
         WHERE guild_id = $1 AND type = $2`,
        [guildId, template.type]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Template existe déjà: ${template.type}`);
        skipped++;
        continue;
      }

      // Créer le template
      await client.query(
        `INSERT INTO announcement_templates
         (guild_id, type, title, description, color, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          guildId,
          template.type,
          template.title,
          template.description,
          template.color,
          template.image_url
        ]
      );

      console.log(`✅ Template créé: ${template.type}`);
      created++;
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ Créés: ${created}`);
    console.log(`   ⏭️  Ignorés (déjà existants): ${skipped}`);
    console.log(`   📋 Total: ${templates.length}`);

    // Vérifier les templates créés
    const allTemplates = await client.query(
      `SELECT type, title FROM announcement_templates WHERE guild_id = $1`,
      [guildId]
    );

    console.log(`\n📋 Templates dans la base de données (${allTemplates.rows.length}):`);
    allTemplates.rows.forEach(t => {
      console.log(`   - ${t.type}: ${t.title}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initTemplates()
  .then(() => {
    console.log('\n✅ Initialisation terminée');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
