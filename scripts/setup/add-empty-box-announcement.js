const db = require('./utils/database-pg');
require('dotenv').config();

async function addEmptyBoxAnnouncement() {
  try {
    const guildId = '1248028543389143070';

    console.log('📦 Ajout du template et toggle pour la Boîte Vide...\n');

    // 1. Ajouter le template d'annonce
    console.log('1️⃣ Ajout du template d\'annonce...');

    // Vérifier si le template existe déjà
    const existingTemplate = await db.queryOne(`
      SELECT * FROM announcement_templates
      WHERE guild_id = $1 AND type = 'trap_empty_box'
    `, [guildId]);

    if (existingTemplate) {
      console.log('   ⏭️  Template déjà existant');
    } else {
      await db.query(`
        INSERT INTO announcement_templates (
          guild_id,
          type,
          title,
          description,
          color,
          footer_text,
          image_url,
          thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        guildId,
        'trap_empty_box',
        '📦 BOÎTE VIDE !',
        '**{userName}** a ouvert **{trapName}**... et il n\'y avait RIEN dedans ! 😂\n\nAbsolument rien. Pas de collectible, pas de mission, juste le néant cosmique.\n\n*Au moins, rien n\'a été perdu !* 🤷',
        '#95a5a6', // Gris
        'Mieux vaut en rire ! 🤷',
        null,
        null
      ]);
      console.log('   ✅ Template ajouté');
    }

    // 2. Ajouter le toggle dans les settings
    console.log('\n2️⃣ Ajout du toggle dans announcement_settings...');

    // Récupérer les settings actuels
    const settings = await db.queryOne(`
      SELECT * FROM announcement_settings WHERE guild_id = $1
    `, [guildId]);

    if (!settings) {
      console.log('   ⚠️ Aucun settings trouvé, création...');
      await db.query(`
        INSERT INTO announcement_settings (guild_id, trap_empty_box)
        VALUES ($1, true)
      `, [guildId]);
      console.log('   ✅ Settings créés avec trap_empty_box activé');
    } else {
      // Vérifier si la colonne existe déjà
      const columns = await db.queryAll(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'announcement_settings'
      `);

      const hasColumn = columns.some(c => c.column_name === 'trap_empty_box');

      if (!hasColumn) {
        console.log('   🔧 Ajout de la colonne trap_empty_box...');
        await db.query(`
          ALTER TABLE announcement_settings
          ADD COLUMN trap_empty_box BOOLEAN DEFAULT true
        `);
        console.log('   ✅ Colonne ajoutée');
      } else {
        console.log('   ✅ Colonne déjà existante');
      }

      // Mettre à jour pour ce guild
      await db.query(`
        UPDATE announcement_settings
        SET trap_empty_box = true
        WHERE guild_id = $1
      `, [guildId]);
      console.log('   ✅ Toggle activé pour le serveur');
    }

    console.log('\n✅ Configuration terminée !');
    console.log('\nVous pouvez maintenant:');
    console.log('  - Utiliser /give unique avec mode=trap et le piège Boîte Vide');
    console.log('  - Gérer le toggle dans /admin-panel → Annonces');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addEmptyBoxAnnouncement();
