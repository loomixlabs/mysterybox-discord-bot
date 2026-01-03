require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

/**
 * Script pour corriger les problèmes du nouveau piège :
 * 1. Mettre à jour l'image du piège en DB
 * 2. S'assurer que l'annonce a les bons champs
 */

async function fixNewTrapIssues() {
  console.log('🔧 CORRECTION DES PROBLÈMES DU NOUVEAU PIÈGE\n');
  console.log('━'.repeat(80));

  try {
    // 1. Mettre à jour l'image du piège (utilisons l'image de la Reine/Sorcière existante)
    console.log('\n📊 ÉTAPE 1: Mise à jour de l\'image du piège\n');

    const imageUrl = 'https://i.imgur.com/QfT2Y9M.png'; // URL d'une image thématique sombre/reine

    await db.query(`
      UPDATE traps
      SET image_url = $1
      WHERE guild_id = $2 AND type = $3
    `, [imageUrl, GUILD_ID, 'lose-all-collectibles']);

    console.log(`   ✅ Image mise à jour: ${imageUrl}`);

    // 2. Vérifier le setting d'annonce
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 2: Vérification du setting d\'annonce\n');

    const setting = await db.queryOne(`
      SELECT trap_lose_all_collectibles
      FROM announcement_settings
      WHERE guild_id = $1
    `, [GUILD_ID]);

    if (setting && setting.trap_lose_all_collectibles === undefined) {
      console.log('   ⚠️  Colonne trap_lose_all_collectibles manquante dans announcement_settings');
      console.log('   ℹ️  Il faudra ajouter cette colonne à la table');
    } else if (setting) {
      console.log(`   ✅ Setting existe: ${setting.trap_lose_all_collectibles}`);
    } else {
      console.log('   ⚠️  Aucun setting trouvé pour ce serveur');
    }

    // 3. Vérifier le template
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 3: Vérification du template d\'annonce\n');

    const template = await db.queryOne(`
      SELECT id, type, title, description
      FROM announcement_templates
      WHERE guild_id = $1 AND type = $2
    `, [GUILD_ID, 'trap_lose_all_collectibles']);

    if (template) {
      console.log('   ✅ Template existe:');
      console.log(`      ID: ${template.id}`);
      console.log(`      Title: ${template.title}`);
      console.log(`      Description: ${template.description}`);
    } else {
      console.log('   ❌ Template manquant !');
    }

    console.log('\n━'.repeat(80));
    console.log('\n✅ CORRECTION TERMINÉE\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

fixNewTrapIssues();
