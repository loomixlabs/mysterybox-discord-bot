/**
 * Script pour appliquer les templates d'annonces du thème Monopoly
 * à un serveur existant qui a déjà le thème importé
 */

const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

// Mapping des types JSON vers les types système
const TEMPLATE_TYPE_MAPPING = {
  // Types directs (1:1)
  'legendary_collectible': ['legendary_collectible'],
  'collection_completed': ['collection_completed'],
  'collection_traded': ['collection_traded'],
  'collection_lost': ['collection_lost'],
  'trap_cooldown': ['trap_cooldown'],
  'trap_lose_collectible': ['trap_lose_collectible'],
  'trap_public_shame': ['trap_public_shame'],
  'trap_empty_box': ['trap_empty_box'],
  'trap_lose_all_collectibles': ['trap_lose_all_collectibles'],
  'mission_word_guessed': ['mission_word_guessed'],
  'mission_started': ['mission_started'],
  'mission_completed': ['mission_completed'],
  'mission_failed': ['mission_failed'],
  'mission_approved': ['mission_approved'],
  'mission_rejected': ['mission_rejected'],
  'theme_expired': ['theme_expired'],
  'theme_expiring_soon': ['theme_expiring_soon'],

  // Types génériques du JSON qui mappent vers des types spécifiques
  'collectible_found': ['legendary_collectible'],
  'trap_triggered': ['trap_cooldown', 'trap_lose_collectible', 'trap_public_shame', 'trap_empty_box', 'trap_lose_all_collectibles'],
  'role_unlocked': ['collection_completed']
};

// Titres par défaut
const DEFAULT_TITLES = {
  'legendary_collectible': '🏠 Nouvelle Propriété LÉGENDAIRE !',
  'collection_completed': '🎊 EMPIRE COMPLET !',
  'collection_traded': '🔄 ÉCHANGE DE PROPRIÉTÉS !',
  'collection_lost': '💀 PROPRIÉTÉ PERDUE !',
  'trap_cooldown': '⚠️ MAUVAISE CASE !',
  'trap_lose_collectible': '⚠️ MAUVAISE CASE !',
  'trap_public_shame': '⚠️ MAUVAISE CASE !',
  'trap_empty_box': '⚠️ MAUVAISE CASE !',
  'trap_lose_all_collectibles': '⚠️ MAUVAISE CASE !',
  'mission_word_guessed': '🎯 DÉFI RÉUSSI !',
  'mission_started': '🎯 DÉFI DU BANQUIER !',
  'mission_completed': '✅ DÉFI RÉUSSI !',
  'mission_failed': '❌ DÉFI ÉCHOUÉ !',
  'mission_approved': '👍 DÉFI VALIDÉ !',
  'mission_rejected': '⛔ DÉFI REFUSÉ !',
  'theme_expired': '🔴 PARTIE TERMINÉE !',
  'theme_expiring_soon': '⏰ FIN DE PARTIE APPROCHE !'
};

// Couleurs par défaut (thème Monopoly)
const DEFAULT_COLORS = {
  'legendary_collectible': '#f1c40f',
  'collection_completed': '#2ecc71',
  'collection_traded': '#3498db',
  'collection_lost': '#e74c3c',
  'trap_cooldown': '#e74c3c',
  'trap_lose_collectible': '#e74c3c',
  'trap_public_shame': '#9b59b6',
  'trap_empty_box': '#95a5a6',
  'trap_lose_all_collectibles': '#c0392b',
  'mission_word_guessed': '#2ecc71',
  'mission_started': '#3498db',
  'mission_completed': '#2ecc71',
  'mission_failed': '#e74c3c',
  'mission_approved': '#2ecc71',
  'mission_rejected': '#e74c3c',
  'theme_expired': '#e74c3c',
  'theme_expiring_soon': '#f39c12'
};

async function applyMonopolyTemplates() {
  // ID du serveur de test
  const guildId = '1377376612034695270';

  try {
    console.log('📦 Application des templates Monopoly...\n');

    // Lire le fichier JSON du thème Monopoly
    const monopolyPath = path.join(__dirname, '..', 'themes', 'presets', 'monopoly.theme.json');
    const monopolyData = JSON.parse(fs.readFileSync(monopolyPath, 'utf8'));
    const templates = monopolyData.announcement_templates;

    if (!templates) {
      console.error('❌ Aucun announcement_templates trouvé dans monopoly.theme.json');
      process.exit(1);
    }

    console.log(`📋 Templates trouvés dans le JSON: ${Object.keys(templates).join(', ')}\n`);

    // D'abord, s'assurer que guild_config existe (prérequis pour announcement_templates)
    const existingGuildConfig = await db.queryOne(
      'SELECT guild_id FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (!existingGuildConfig) {
      console.log('🔧 Création de la configuration serveur...');
      await db.query(`
        INSERT INTO guild_config (guild_id, created_at)
        VALUES ($1, NOW())
        ON CONFLICT (guild_id) DO NOTHING
      `, [guildId]);
      console.log('   ✅ Configuration serveur créée\n');
    }

    // Ensuite, créer les templates par défaut s'ils n'existent pas
    const { createDefaultTemplatesForGuild } = require('../utils/announcementDefaults');
    await createDefaultTemplatesForGuild(guildId);

    // Récupérer le thème actif pour avoir le themeId
    const activeTheme = await db.queryOne(`
      SELECT id FROM themes WHERE guild_id = $1 AND is_active = TRUE
    `, [guildId]);

    if (!activeTheme) {
      console.error('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    let templatesUpdated = 0;

    // Traiter chaque template du JSON
    for (const [jsonType, content] of Object.entries(templates)) {
      const systemTypes = TEMPLATE_TYPE_MAPPING[jsonType];

      if (!systemTypes) {
        console.log(`   ⏭️  Type "${jsonType}" non reconnu, stocké dans theme_messages`);
        // Stocker dans theme_messages comme fallback
        await db.query(`
          INSERT INTO theme_messages (guild_id, theme_id, key, content)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (guild_id, theme_id, key) DO UPDATE SET
            content = EXCLUDED.content
        `, [guildId, activeTheme.id, `announcement_${jsonType}`, content]);
        continue;
      }

      // Appliquer le template à tous les types système correspondants
      for (const systemType of systemTypes) {
        let title = DEFAULT_TITLES[systemType] || '📢 ANNONCE';
        let description = typeof content === 'string' ? content : (content.description || content.message || '');
        let color = DEFAULT_COLORS[systemType] || '#3498db';

        if (typeof content === 'object') {
          title = content.title || title;
          color = content.color || color;
        }

        // Mettre à jour le template
        const result = await db.query(`
          UPDATE announcement_templates
          SET description = $1, title = $2, color = $3, updated_at = NOW()
          WHERE guild_id = $4 AND type = $5
          RETURNING id
        `, [description, title, color, guildId, systemType]);

        if (result && result.length > 0) {
          console.log(`   ✅ ${systemType} mis à jour`);
          templatesUpdated++;
        } else {
          console.log(`   ⚠️ ${systemType} non trouvé dans la base`);
        }
      }
    }

    console.log(`\n✅ ${templatesUpdated} template(s) d'annonces mis à jour`);

    // Afficher les templates mis à jour
    console.log('\n📋 Templates actuels:\n');
    const updatedTemplates = await db.queryAll(`
      SELECT type, title, LEFT(description, 60) as description_preview, color
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [guildId]);
    console.table(updatedTemplates);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

applyMonopolyTemplates();
