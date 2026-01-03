/**
 * Script de vérification du système de frames de profil
 * Vérifie les tables, données, et configuration
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function checkProfileFramesSystem() {
  console.log('='.repeat(80));
  console.log('🖼️  AUDIT DU SYSTÈME DE FRAMES DE PROFIL');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier les tables existantes
    console.log('\n📊 1. TABLES LIÉES AUX FRAMES\n');

    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%frame%'
      ORDER BY table_name
    `);

    if (tables.length === 0) {
      console.log('❌ AUCUNE TABLE DE FRAMES TROUVÉE !');
      console.log('   → La migration doit être exécutée');
    } else {
      console.log('Tables trouvées:');
      tables.forEach(t => console.log(`  ✅ ${t.table_name}`));
    }

    // 2. Structure de theme_profile_frames
    console.log('\n📋 2. STRUCTURE DE theme_profile_frames\n');

    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_profile_frames'
      ORDER BY ordinal_position
    `);

    if (columns.length === 0) {
      console.log('❌ Table theme_profile_frames N\'EXISTE PAS !');
    } else {
      console.log('Colonnes:');
      columns.forEach(c => {
        console.log(`  - ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    }

    // 3. Données actuelles dans theme_profile_frames
    console.log('\n📦 3. FRAMES DE PROFIL CONFIGURÉES\n');

    const profileFrames = await db.queryAll(`
      SELECT tpf.*, t.name as theme_name
      FROM theme_profile_frames tpf
      LEFT JOIN themes t ON tpf.theme_id = t.id
      ORDER BY tpf.theme_id, tpf.frame_number
    `);

    if (profileFrames.length === 0) {
      console.log('⚠️  Aucune frame de profil configurée');
    } else {
      console.log(`${profileFrames.length} frame(s) configurée(s):`);
      profileFrames.forEach(f => {
        console.log(`\n  🖼️  Frame #${f.frame_number} - Thème: ${f.theme_name || f.theme_id}`);
        console.log(`     Nom: ${f.name || '(non défini)'}`);
        console.log(`     Description: ${f.description || '(non définie)'}`);
        console.log(`     URL: ${f.frame_url || '❌ MANQUANTE'}`);
        console.log(`     Condition: ${JSON.stringify(f.unlock_condition) || '(non définie)'}`);
        console.log(`     Bonus: ${f.bonus_type || 'Aucun'} (${f.bonus_value || 0}%)`);
      });
    }

    // 4. Frames de collectibles par défaut
    console.log('\n🎨 4. FRAMES DE COLLECTIBLES PAR DÉFAUT (FALLBACK)\n');

    const defaultFrames = await db.queryAll(`
      SELECT * FROM default_collectible_frames
      ORDER BY rarity
    `);

    if (defaultFrames.length === 0) {
      console.log('⚠️  Aucune frame par défaut configurée');
    } else {
      console.log('Frames par défaut:');
      defaultFrames.forEach(f => {
        console.log(`  - ${f.rarity}: ${f.frame_url}`);
      });
    }

    // 5. Frames débloquées par les joueurs
    console.log('\n🔓 5. FRAMES DÉBLOQUÉES PAR LES JOUEURS\n');

    const unlockedFrames = await db.queryAll(`
      SELECT puf.*, tpf.name as frame_name, tpf.frame_number
      FROM player_unlocked_frames puf
      JOIN theme_profile_frames tpf ON puf.frame_id = tpf.id
      ORDER BY puf.unlocked_at DESC
      LIMIT 10
    `);

    if (unlockedFrames.length === 0) {
      console.log('📭 Aucun joueur n\'a encore débloqué de frame');
    } else {
      console.log(`${unlockedFrames.length} frame(s) débloquée(s) récemment:`);
      unlockedFrames.forEach(f => {
        console.log(`  - Discord ${f.discord_id}: ${f.frame_name} (le ${new Date(f.unlocked_at).toLocaleDateString()})`);
      });
    }

    // 6. Frames équipées
    console.log('\n👤 6. FRAMES ACTUELLEMENT ÉQUIPÉES\n');

    const equippedFrames = await db.queryAll(`
      SELECT pef.*, tpf.name as frame_name
      FROM player_equipped_frame pef
      JOIN theme_profile_frames tpf ON pef.frame_id = tpf.id
      ORDER BY pef.equipped_at DESC
      LIMIT 10
    `);

    if (equippedFrames.length === 0) {
      console.log('📭 Aucun joueur n\'a équipé de frame');
    } else {
      console.log(`${equippedFrames.length} frame(s) équipée(s):`);
      equippedFrames.forEach(f => {
        const scope = f.guild_id === '__global__' ? 'Global' : `Serveur ${f.guild_id}`;
        console.log(`  - Discord ${f.discord_id}: ${f.frame_name} (${scope})`);
      });
    }

    // 7. Vérifier les fonctions DB liées aux frames
    console.log('\n🔧 7. FONCTIONS DE BASE DE DONNÉES\n');

    const dbFunctions = [
      'getThemeProfileFrames',
      'setThemeProfileFrame',
      'checkAndUnlockFrames',
      'getUnlockedFrames',
      'equipFrame',
      'unequipFrame',
      'getEquippedFrame',
      'getCollectibleFrameUrl'
    ];

    console.log('Fonctions attendues dans database-pg.js:');
    dbFunctions.forEach(fn => {
      const exists = typeof db[fn] === 'function';
      console.log(`  ${exists ? '✅' : '❌'} ${fn}()`);
    });

    // 8. Résumé des problèmes
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ ET ACTIONS REQUISES');
    console.log('='.repeat(80));

    const issues = [];

    if (tables.length === 0) {
      issues.push('Migration des tables de frames non exécutée');
    }

    if (profileFrames.length === 0) {
      issues.push('Aucune frame de profil configurée pour les thèmes');
    }

    if (defaultFrames.length === 0) {
      issues.push('Aucune frame par défaut (fallback) configurée');
    }

    const missingFrameUrls = profileFrames.filter(f => !f.frame_url);
    if (missingFrameUrls.length > 0) {
      issues.push(`${missingFrameUrls.length} frame(s) sans URL d'image`);
    }

    const missingConditions = profileFrames.filter(f => !f.unlock_condition);
    if (missingConditions.length > 0) {
      issues.push(`${missingConditions.length} frame(s) sans condition de déblocage`);
    }

    if (issues.length === 0) {
      console.log('\n✅ Le système de frames de profil semble correctement configuré !');
    } else {
      console.log('\n⚠️  Problèmes détectés:');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'audit:', error);
  }

  process.exit(0);
}

checkProfileFramesSystem();
