/**
 * Script pour vérifier le contenu réel des templates d'annonces
 * après import du thème Monopoly
 */

const db = require('../utils/database-pg');

const TEST_GUILD_ID = '1377376612034695270';

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION DES TEMPLATES D\'ANNONCES\n');
    console.log('='.repeat(80));
    console.log(`📍 Serveur: ${TEST_GUILD_ID}\n`);

    // 1. Vérifier tous les templates
    console.log('📋 1. TOUS LES TEMPLATES:\n');
    const templates = await db.queryAll(`
      SELECT type, title, description, color, updated_at
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [TEST_GUILD_ID]);

    if (templates.length === 0) {
      console.log('❌ AUCUN template trouvé!');
    } else {
      for (const t of templates) {
        console.log(`\n📌 ${t.type}`);
        console.log(`   Titre: ${t.title}`);
        console.log(`   Couleur: ${t.color}`);
        console.log(`   Description: ${t.description ? t.description.substring(0, 100) + '...' : 'VIDE'}`);
        console.log(`   Dernière MAJ: ${t.updated_at}`);
      }
    }

    // 2. Vérifier si les templates contiennent du texte Monopoly
    console.log('\n\n' + '='.repeat(80));
    console.log('🎰 2. RECHERCHE DE CONTENU MONOPOLY:\n');

    const monopolyKeywords = ['Monopoly', 'propriété', 'banquier', 'Magnat', 'plateau', 'prison', 'case'];

    for (const keyword of monopolyKeywords) {
      const found = await db.queryAll(`
        SELECT type, description
        FROM announcement_templates
        WHERE guild_id = $1
        AND (description ILIKE $2 OR title ILIKE $2)
      `, [TEST_GUILD_ID, `%${keyword}%`]);

      console.log(`   "${keyword}": ${found.length > 0 ? '✅ ' + found.map(f => f.type).join(', ') : '❌ Non trouvé'}`);
    }

    // 3. Vérifier theme_messages (contenu de fallback)
    console.log('\n\n' + '='.repeat(80));
    console.log('📝 3. THEME_MESSAGES (fallback pour types non reconnus):\n');

    const themeMessages = await db.queryAll(`
      SELECT key, content
      FROM theme_messages
      WHERE guild_id = $1
      AND key LIKE 'announcement_%'
      ORDER BY key
    `, [TEST_GUILD_ID]);

    if (themeMessages.length === 0) {
      console.log('   Aucun message d\'annonce stocké dans theme_messages');
    } else {
      for (const msg of themeMessages) {
        console.log(`   📌 ${msg.key}`);
        console.log(`      ${msg.content.substring(0, 80)}...`);
      }
    }

    // 4. Comparer avec les templates par défaut
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 4. COMPARAISON AVEC DEFAULTS:\n');

    const { DEFAULT_ANNOUNCEMENT_TEMPLATES } = require('../utils/announcementDefaults');

    for (const defaultTpl of DEFAULT_ANNOUNCEMENT_TEMPLATES.slice(0, 5)) {
      const current = templates.find(t => t.type === defaultTpl.type);
      if (current) {
        const isDefault = current.description === defaultTpl.description;
        console.log(`   ${defaultTpl.type}: ${isDefault ? '⚠️ ENCORE PAR DÉFAUT' : '✅ Personnalisé'}`);
      }
    }

    // 5. Résumé
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ:\n');
    console.log(`   Total templates: ${templates.length}`);
    console.log(`   Theme messages (fallback): ${themeMessages.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
