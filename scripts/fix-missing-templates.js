/**
 * Ajoute les templates manquants avec contenu Monopoly
 * et corrige les templates existants
 */

const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

// Templates manquants avec contenu Monopoly
const MISSING_TEMPLATES = [
  {
    type: 'trap_empty_box',
    title: '📦 COFFRE VIDE !',
    description: '⚠️ **{userName}** a ouvert un coffre vide sur le plateau !\n\n🤷 Pas de chance cette fois... Le banquier n\'a rien à donner !',
    color: '#95a5a6',
    footer_text: 'Parfois la case est vide...'
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '💀 FAILLITE TOTALE !',
    description: '⚠️ **{userName}** subit une faillite catastrophique !\n\n😱 **TOUTES les propriétés perdues !**\n\nLe banquier reprend tout...',
    color: '#c0392b',
    footer_text: 'Faillite déclarée'
  }
];

async function fix() {
  try {
    console.log('🔧 CORRECTION DES TEMPLATES MANQUANTS\n');
    console.log('='.repeat(60));
    console.log(`📍 Serveur: ${GUILD_ID}\n`);

    // Ajouter les templates manquants
    for (const template of MISSING_TEMPLATES) {
      const existing = await db.queryOne(
        'SELECT id FROM announcement_templates WHERE guild_id = $1 AND type = $2',
        [GUILD_ID, template.type]
      );

      if (existing) {
        console.log(`⏭️  ${template.type} existe déjà`);
        continue;
      }

      await db.query(`
        INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [GUILD_ID, template.type, template.title, template.description, template.color, template.footer_text]);

      console.log(`✅ ${template.type} créé`);
    }

    // Vérifier le résultat
    console.log('\n📋 TEMPLATES APRÈS CORRECTION:\n');
    const all = await db.queryAll(
      'SELECT type FROM announcement_templates WHERE guild_id = $1 ORDER BY type',
      [GUILD_ID]
    );
    console.log('Total:', all.length, 'templates');
    console.log('Types:', all.map(t => t.type).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fix();
