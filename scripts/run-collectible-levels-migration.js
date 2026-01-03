/**
 * Script de migration: Système de Niveaux et Mint des Collectibles
 *
 * Exécute la migration pour:
 * - Ajouter level (1-4), xp, mint_number aux collections
 * - Créer collectible_mint_counter (numéros de mint)
 * - Créer player_favorite_collectibles (3 favoris)
 * - Créer theme_collectible_frames (frames par rareté/thème)
 * - Créer theme_profile_frames (2 frames profil par thème)
 * - Créer player_unlocked_frames (frames débloquées multi-serveur)
 * - Créer player_equipped_frame (frame équipée)
 * - Créer guild_collectible_config (config XP/Loomix)
 * - Créer default_collectible_frames (fallback)
 * - Initialiser les données existantes
 *
 * Usage: node scripts/run-collectible-levels-migration.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Migration: Système de Niveaux Collectibles v2.0\n');
  console.log('='.repeat(60));
  console.log('📋 Tables à créer/modifier:');
  console.log('   - collections (ajout level, xp, mint_number)');
  console.log('   - collectible_mint_counter');
  console.log('   - player_favorite_collectibles');
  console.log('   - theme_collectible_frames');
  console.log('   - theme_profile_frames');
  console.log('   - player_unlocked_frames');
  console.log('   - player_equipped_frame');
  console.log('   - guild_collectible_config');
  console.log('   - default_collectible_frames');
  console.log('='.repeat(60) + '\n');

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-collectible-levels-mint.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Fichier migration non trouvé: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Séparer les commandes SQL intelligemment
    // On split par les ; suivis de newline mais pas dans les blocs DO $$
    const commands = [];
    let currentCommand = '';
    let inDoBlock = false;

    const lines = sqlContent.split('\n');
    for (const line of lines) {
      // Ignorer les commentaires purs
      if (line.trim().startsWith('--') && !currentCommand.trim()) {
        continue;
      }

      currentCommand += line + '\n';

      // Détecter début de bloc DO
      if (line.includes('DO $$')) {
        inDoBlock = true;
      }

      // Détecter fin de bloc DO
      if (line.includes('END $$;')) {
        inDoBlock = false;
        commands.push(currentCommand.trim());
        currentCommand = '';
        continue;
      }

      // Si pas dans un bloc DO et ligne finit par ;
      if (!inDoBlock && line.trim().endsWith(';')) {
        const cmd = currentCommand.trim();
        if (cmd && !cmd.startsWith('--')) {
          commands.push(cmd);
        }
        currentCommand = '';
      }
    }

    console.log(`📋 ${commands.length} commandes SQL à exécuter\n`);

    let success = 0;
    let skipped = 0;
    let errors = 0;

    // Exécuter chaque commande
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      // Extraire description pour le log
      const firstMeaningfulLine = cmd.split('\n')
        .find(l => l.trim() && !l.trim().startsWith('--'));
      const shortDesc = (firstMeaningfulLine || cmd).substring(0, 50).replace(/\n/g, ' ');

      process.stdout.write(`[${i + 1}/${commands.length}] ${shortDesc}...`);

      try {
        await db.query(cmd);
        console.log(' ✅');
        success++;
      } catch (error) {
        // Ignorer certaines erreurs attendues
        if (error.message.includes('already exists') ||
            error.message.includes('does not exist') ||
            error.message.includes('duplicate key') ||
            error.message.includes('constraint') && error.message.includes('already exists')) {
          console.log(' ⚠️  (déjà fait)');
          skipped++;
        } else {
          console.log(` ❌ ${error.message.substring(0, 60)}`);
          errors++;
          // Ne pas throw pour continuer avec les autres commandes
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Résultat: ${success} succès, ${skipped} ignorés, ${errors} erreurs`);
    console.log('='.repeat(60) + '\n');

    if (errors > 0) {
      console.log('⚠️  Des erreurs se sont produites. Vérifiez les messages ci-dessus.\n');
    }

    // Vérification post-migration
    console.log('🔍 Vérification post-migration:\n');

    // 1. Vérifier les nouvelles colonnes dans collections
    console.log('📊 Colonnes de collections:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'collections'
      AND column_name IN ('level', 'xp', 'mint_number')
      ORDER BY column_name
    `);
    console.table(columns);

    // 2. Vérifier les nouvelles tables
    console.log('📋 Nouvelles tables:');
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'collectible_mint_counter',
        'player_favorite_collectibles',
        'theme_collectible_frames',
        'theme_profile_frames',
        'player_unlocked_frames',
        'player_equipped_frame',
        'guild_collectible_config',
        'default_collectible_frames'
      )
      ORDER BY table_name
    `);
    console.table(tables);

    // 3. Vérifier les frames par défaut
    console.log('🖼️  Frames par défaut:');
    const defaultFrames = await db.queryAll(`
      SELECT rarity, frame_url FROM default_collectible_frames ORDER BY rarity
    `);
    console.table(defaultFrames);

    // 4. Stats sur les collections mises à jour
    console.log('📈 Stats collections:');
    const stats = await db.queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN level IS NOT NULL THEN 1 END) as with_level,
        COUNT(CASE WHEN mint_number IS NOT NULL THEN 1 END) as with_mint,
        AVG(level)::numeric(3,2) as avg_level
      FROM collections
      WHERE lost_at IS NULL
    `);
    console.table([stats]);

    // 5. Stats mint counters
    console.log('🔢 Mint counters créés:');
    const mintStats = await db.queryOne(`
      SELECT COUNT(*) as total_counters, SUM(next_mint_number - 1) as total_minted
      FROM collectible_mint_counter
    `);
    console.table([mintStats]);

    console.log('\n✅ Migration terminée !');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Modifier addCollectible() dans database-pg.js');
    console.log('   2. Créer utils/imageGenerator.js');
    console.log('   3. Modifier mysteryBoxHandler.js');
    console.log('   4. Modifier profileHandler.js et profileView.js');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  }
}

runMigration();
