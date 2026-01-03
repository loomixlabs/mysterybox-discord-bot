/**
 * Script de configuration des frames de profil par défaut
 *
 * Ce script:
 * 1. Crée la table default_profile_frames si elle n'existe pas
 * 2. Insert les frames par défaut (silver et gold)
 * 3. Ajoute une fonction getDefaultProfileFrames dans database-pg.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function setupDefaultProfileFrames() {
  console.log('='.repeat(80));
  console.log('🖼️  CONFIGURATION DES FRAMES DE PROFIL PAR DÉFAUT');
  console.log('='.repeat(80));

  try {
    // 1. Créer la table default_profile_frames
    console.log('\n📊 1. Création de la table default_profile_frames\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS default_profile_frames (
        id SERIAL PRIMARY KEY,
        frame_number INTEGER NOT NULL CHECK (frame_number IN (1, 2)),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        frame_url VARCHAR(500) NOT NULL,
        unlock_condition JSONB NOT NULL DEFAULT '{"type": "collectibles_level", "count": 5, "min_level": 2}',
        bonus_type VARCHAR(50) DEFAULT NULL,
        bonus_value INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(frame_number)
      )
    `);
    console.log('✅ Table default_profile_frames créée/vérifiée');

    // 2. Vérifier si les données existent déjà
    const existingFrames = await db.queryAll(`SELECT * FROM default_profile_frames ORDER BY frame_number`);

    if (existingFrames.length > 0) {
      console.log('\n⚠️  Des frames par défaut existent déjà:');
      existingFrames.forEach(f => {
        console.log(`   Frame ${f.frame_number}: ${f.name} - ${f.frame_url}`);
      });
      console.log('\n   Suppression et recréation...');
      await db.query(`DELETE FROM default_profile_frames`);
    }

    // 3. Insérer les frames par défaut
    console.log('\n📦 2. Insertion des frames par défaut\n');

    // Frame 1: Silver (première à débloquer)
    const silverFrame = await db.queryOne(`
      INSERT INTO default_profile_frames
      (frame_number, name, description, frame_url, unlock_condition, bonus_type, bonus_value)
      VALUES (
        1,
        'Cadre Argent',
        'Cadre de profil argenté. Déblocable en collectant des items.',
        'http://72.60.185.62:8080/assets/frames/framesilver.png',
        '{"type": "collectibles_level", "count": 5, "min_level": 2}',
        NULL,
        NULL
      )
      RETURNING *
    `);
    console.log(`✅ Frame 1 (Silver) créée: ${silverFrame.name}`);

    // Frame 2: Gold (deuxième à débloquer)
    const goldFrame = await db.queryOne(`
      INSERT INTO default_profile_frames
      (frame_number, name, description, frame_url, unlock_condition, bonus_type, bonus_value)
      VALUES (
        2,
        'Cadre Or',
        'Cadre de profil doré. Déblocable en collectant des items légendaires.',
        'http://72.60.185.62:8080/assets/frames/framegold.png',
        '{"type": "legendary_level", "count": 3, "min_level": 3}',
        NULL,
        NULL
      )
      RETURNING *
    `);
    console.log(`✅ Frame 2 (Gold) créée: ${goldFrame.name}`);

    // 4. Afficher le résumé
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ DES FRAMES PAR DÉFAUT');
    console.log('='.repeat(80));

    const allFrames = await db.queryAll(`SELECT * FROM default_profile_frames ORDER BY frame_number`);

    allFrames.forEach(f => {
      console.log(`\n🖼️  Frame ${f.frame_number}: ${f.name}`);
      console.log(`   Description: ${f.description}`);
      console.log(`   URL: ${f.frame_url}`);
      console.log(`   Condition: ${JSON.stringify(f.unlock_condition)}`);
      console.log(`   Bonus: ${f.bonus_type || 'Aucun'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ CONFIGURATION TERMINÉE');
    console.log('='.repeat(80));

    console.log('\n⚠️  ACTIONS RESTANTES:');
    console.log('   1. Uploader les images sur le VPS:');
    console.log('      scp -i ~/.ssh/id_rsa_vps_hostinger "c:\\ia mogo\\bot discord\\framesilver.png" root@72.60.185.62:/root/bot-mysterybox/assets/frames/');
    console.log('      scp -i ~/.ssh/id_rsa_vps_hostinger "c:\\ia mogo\\bot discord\\framegold.png" root@72.60.185.62:/root/bot-mysterybox/assets/frames/');
    console.log('   2. Modifier database-pg.js pour utiliser ces fallbacks');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

setupDefaultProfileFrames();
