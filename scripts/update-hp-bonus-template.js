/**
 * Script: Créer un template trap_shame_nickname humoristique Harry Potter
 * pour le serveur 1182395170273099806
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65; // Harry Potter - Les Reliques Magiques

const HP_SHAME_TEMPLATE = {
  type: 'trap_shame_nickname',
  title: '🪄 SORTILÈGE DE HONTE ACTIVÉ !',
  description: `**{userName}** a déclenché le piège **{trapName}** !

🎭 Son pseudo a été transformé en **"{shameNickname}"** !

⏰ **Durée du sortilège:** {duration}

*"Riddikulus !" aurait pu aider... mais ce n'est pas un Épouvantard, c'est ta réputation !*

🧙‍♂️ *Même Voldemort aurait eu pitié... enfin, peut-être pas.*
👃 *Rogue ricane silencieusement dans les cachots.*`,
  color: '#E91E63', // Rose honteux
  footer_text: '⚡ Le pseudo sera restauré quand la malédiction expirera... si tu survis à la honte !',
  image_url: null,
  thumbnail_url: null
};

async function updateHPShameTemplate() {
  console.log('🪄 Création du template trap_shame_nickname Harry Potter humoristique\n');
  console.log('='.repeat(60));

  try {
    // Vérifier si le template existe déjà
    const existing = await db.queryOne(`
      SELECT id FROM announcement_templates
      WHERE guild_id = $1 AND theme_id = $2 AND type = $3
    `, [GUILD_ID, THEME_ID, HP_SHAME_TEMPLATE.type]);

    if (existing) {
      // Mettre à jour le template existant
      await db.query(`
        UPDATE announcement_templates
        SET title = $1, description = $2, color = $3, footer_text = $4,
            image_url = $5, thumbnail_url = $6
        WHERE guild_id = $7 AND theme_id = $8 AND type = $9
      `, [
        HP_SHAME_TEMPLATE.title,
        HP_SHAME_TEMPLATE.description,
        HP_SHAME_TEMPLATE.color,
        HP_SHAME_TEMPLATE.footer_text,
        HP_SHAME_TEMPLATE.image_url,
        HP_SHAME_TEMPLATE.thumbnail_url,
        GUILD_ID,
        THEME_ID,
        HP_SHAME_TEMPLATE.type
      ]);
      console.log('✅ Template trap_shame_nickname Harry Potter MIS À JOUR');
    } else {
      // Créer le nouveau template
      await db.query(`
        INSERT INTO announcement_templates (
          guild_id, theme_id, type, title, description, color,
          footer_text, image_url, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        GUILD_ID,
        THEME_ID,
        HP_SHAME_TEMPLATE.type,
        HP_SHAME_TEMPLATE.title,
        HP_SHAME_TEMPLATE.description,
        HP_SHAME_TEMPLATE.color,
        HP_SHAME_TEMPLATE.footer_text,
        HP_SHAME_TEMPLATE.image_url,
        HP_SHAME_TEMPLATE.thumbnail_url
      ]);
      console.log('✅ Template trap_shame_nickname Harry Potter CRÉÉ');
    }

    console.log('\n📝 Aperçu du template:');
    console.log('   Titre:', HP_SHAME_TEMPLATE.title);
    console.log('   Couleur:', HP_SHAME_TEMPLATE.color);
    console.log('   Footer:', HP_SHAME_TEMPLATE.footer_text);
    console.log('\n   Description:');
    HP_SHAME_TEMPLATE.description.split('\n').forEach(line => {
      console.log('   ' + line);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ TERMINÉ - Template trap_shame_nickname Harry Potter configuré !');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    process.exit(1);
  }
}

updateHPShameTemplate();
