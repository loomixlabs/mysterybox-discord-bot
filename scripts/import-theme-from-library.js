/**
 * Import Theme from Library to Bot
 *
 * Ce script permet d'importer un thème depuis themes_library (Theme Builder)
 * vers les tables utilisées par le bot Discord (themes, collectibles, traps, missions, etc.)
 *
 * Usage: node scripts/import-theme-from-library.js <theme_id> <guild_id> [--activate]
 *
 * Options:
 *   --activate    Active le thème après import
 *   --dry-run     Affiche ce qui serait fait sans modifier la DB
 */

const db = require('../utils/database-pg');

const VALID_RARITIES = ['legendary', 'epic', 'rare', 'common'];
const VALID_MISSION_TYPES = ['quiz', 'keyword'];

async function importThemeFromLibrary(themeId, guildId, options = {}) {
  const { activate = false, dryRun = false } = options;

  console.log('═'.repeat(70));
  console.log('📦 IMPORT THEME FROM LIBRARY');
  console.log('═'.repeat(70));
  console.log(`📋 Theme ID: ${themeId}`);
  console.log(`🏠 Guild ID: ${guildId}`);
  console.log(`🔄 Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE'}`);
  console.log(`⚡ Activer après import: ${activate ? 'Oui' : 'Non'}`);
  console.log('');

  try {
    // 1. Récupérer le thème depuis themes_library
    console.log('📖 Chargement du thème depuis themes_library...');
    const libraryTheme = await db.queryOne(
      'SELECT * FROM themes_library WHERE theme_id = $1',
      [themeId]
    );

    if (!libraryTheme) {
      console.error(`❌ Thème "${themeId}" non trouvé dans themes_library`);
      console.log('\n💡 Thèmes disponibles:');
      const available = await db.queryAll('SELECT theme_id, name, creator_username FROM themes_library');
      console.table(available);
      return { success: false, error: 'Theme not found' };
    }

    const themeData = libraryTheme.theme_data;
    console.log(`✅ Thème trouvé: "${libraryTheme.name}" par ${libraryTheme.creator_username}`);
    console.log(`   Version: ${libraryTheme.version}`);
    console.log('');

    // 2. Valider la structure du thème
    console.log('🔍 Validation de la structure...');
    const validation = validateThemeStructure(themeData);
    if (!validation.valid) {
      console.error('❌ Structure invalide:', validation.errors);
      return { success: false, error: 'Invalid structure', details: validation.errors };
    }
    console.log('✅ Structure valide');
    console.log('');

    // 3. Résumé de ce qui va être importé
    console.log('📊 RÉSUMÉ DE L\'IMPORT:');
    console.log('─'.repeat(50));
    console.log(`   Thème: ${themeData.theme?.name || themeData.metadata?.name}`);
    console.log(`   Durée: ${themeData.theme?.duration_days || 30} jours`);
    console.log(`   Items requis: ${themeData.theme?.required_items || 15}`);
    console.log(`   Rôle final: ${themeData.theme?.final_role_name || 'Champion'}`);
    console.log(`   Collectibles: ${themeData.collectibles?.length || 0}`);
    console.log(`   Pièges: ${themeData.traps?.length || 0}`);
    console.log(`   Missions Quiz: ${themeData.missions?.quiz?.length || 0}`);
    console.log(`   Missions Keyword: ${themeData.missions?.keyword?.length || 0}`);
    console.log('─'.repeat(50));
    console.log('');

    if (dryRun) {
      console.log('🔄 DRY RUN - Aucune modification effectuée');
      return { success: true, dryRun: true };
    }

    // 4. Vérifier si le thème existe déjà pour cette guild
    const existingTheme = await db.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );

    if (existingTheme) {
      console.log('⚠️  Le thème existe déjà pour ce serveur. Mise à jour...');
    }

    // 5. Importer dans la table themes
    console.log('📝 Import dans table themes...');
    await db.query(`
      INSERT INTO themes (guild_id, theme_id, name, duration_days, required_items, final_role_name, final_role_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (guild_id, theme_id) DO UPDATE SET
        name = EXCLUDED.name,
        duration_days = EXCLUDED.duration_days,
        required_items = EXCLUDED.required_items,
        final_role_name = EXCLUDED.final_role_name,
        final_role_color = EXCLUDED.final_role_color,
        updated_at = NOW()
    `, [
      guildId,
      themeId,
      themeData.theme?.name || themeData.metadata?.name,
      themeData.theme?.duration_days || 30,
      themeData.theme?.required_items || 15,
      themeData.theme?.final_role_name || 'Champion',
      themeData.theme?.final_role_color || '#FFD700'
    ]);
    console.log('✅ Table themes mise à jour');

    // 6. Importer les collectibles
    if (themeData.collectibles?.length > 0) {
      console.log(`📝 Import de ${themeData.collectibles.length} collectibles...`);

      // Supprimer les anciens collectibles pour ce thème/guild
      await db.query(
        'DELETE FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
        [guildId, themeId]
      );

      for (const col of themeData.collectibles) {
        await db.query(`
          INSERT INTO collectibles (guild_id, theme_id, collectible_id, name, image_url, rarity, reveal_message)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          guildId,
          themeId,
          col.collectible_id || col.id || generateId(col.name),
          col.name,
          col.image_url || col.image || '',
          normalizeRarity(col.rarity),
          col.reveal_message || col.description || `Vous avez trouvé ${col.name} !`
        ]);
      }
      console.log(`✅ ${themeData.collectibles.length} collectibles importés`);
    }

    // 7. Importer les pièges
    if (themeData.traps?.length > 0) {
      console.log(`📝 Import de ${themeData.traps.length} pièges...`);

      await db.query(
        'DELETE FROM traps WHERE guild_id = $1 AND theme_id = $2',
        [guildId, themeId]
      );

      for (const trap of themeData.traps) {
        await db.query(`
          INSERT INTO traps (guild_id, theme_id, trap_id, name, description, effect_type, effect_value, image_url, cooldown_hours)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          guildId,
          themeId,
          trap.trap_id || trap.id || generateId(trap.name),
          trap.name,
          trap.description || '',
          trap.effect_type || 'lose_item',
          trap.effect_value || 1,
          trap.image_url || trap.image || '',
          trap.cooldown_hours || 24
        ]);
      }
      console.log(`✅ ${themeData.traps.length} pièges importés`);
    }

    // 8. Importer les missions
    const allMissions = [
      ...(themeData.missions?.quiz || []).map(m => ({ ...m, type: 'quiz' })),
      ...(themeData.missions?.keyword || []).map(m => ({ ...m, type: 'keyword' }))
    ];

    if (allMissions.length > 0) {
      console.log(`📝 Import de ${allMissions.length} missions...`);

      await db.query(
        'DELETE FROM missions WHERE guild_id = $1 AND theme_id = $2',
        [guildId, themeId]
      );

      for (const mission of allMissions) {
        const missionId = await db.queryOne(`
          INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, reward_type, reward_value)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          guildId,
          themeId,
          mission.mission_id || mission.id || generateId(mission.name),
          mission.name,
          mission.type,
          mission.description || '',
          mission.reward_type || 'collectible',
          mission.reward_value || 1
        ]);

        // Importer les keywords pour les missions keyword
        if (mission.type === 'keyword' && mission.keywords?.length > 0) {
          for (const kw of mission.keywords) {
            await db.query(`
              INSERT INTO mission_keywords (mission_id, keyword)
              VALUES ($1, $2)
            `, [missionId.id, kw]);
          }
        }

        // Importer les questions pour les missions quiz
        if (mission.type === 'quiz' && mission.questions?.length > 0) {
          for (const q of mission.questions) {
            await db.query(`
              INSERT INTO quiz_questions (mission_id, guild_id, question, correct_answer, wrong_answers)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              missionId.id,
              guildId,
              q.question,
              q.correct_answer || q.correct,
              JSON.stringify(q.wrong_answers || q.wrong || [])
            ]);
          }
        }
      }
      console.log(`✅ ${allMissions.length} missions importées`);
    }

    // 9. Importer la config du thème
    if (themeData.theme_config) {
      console.log('📝 Import de la configuration...');

      await db.query(`
        INSERT INTO theme_config (guild_id, theme_id, probability_collectible, probability_mission, probability_trap, probability_super_bonus)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (guild_id, theme_id) DO UPDATE SET
          probability_collectible = EXCLUDED.probability_collectible,
          probability_mission = EXCLUDED.probability_mission,
          probability_trap = EXCLUDED.probability_trap,
          probability_super_bonus = EXCLUDED.probability_super_bonus
      `, [
        guildId,
        themeId,
        themeData.theme_config.probability_collectible || 40,
        themeData.theme_config.probability_mission || 30,
        themeData.theme_config.probability_trap || 20,
        themeData.theme_config.probability_super_bonus || 10
      ]);
      console.log('✅ Configuration importée');
    }

    // 10. Activer le thème si demandé
    if (activate) {
      console.log('⚡ Activation du thème...');

      // Désactiver tous les autres thèmes pour cette guild
      await db.query(
        'UPDATE themes SET is_active = FALSE WHERE guild_id = $1',
        [guildId]
      );

      // Activer ce thème
      await db.query(
        'UPDATE themes SET is_active = TRUE, activated_at = NOW() WHERE guild_id = $1 AND theme_id = $2',
        [guildId, themeId]
      );
      console.log('✅ Thème activé');
    }

    console.log('');
    console.log('═'.repeat(70));
    console.log('✅ IMPORT TERMINÉ AVEC SUCCÈS');
    console.log('═'.repeat(70));

    return { success: true };

  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
    return { success: false, error: error.message };
  }
}

function validateThemeStructure(themeData) {
  const errors = [];

  if (!themeData) {
    errors.push('theme_data est null ou undefined');
    return { valid: false, errors };
  }

  // Vérifier qu'on a au moins un nom
  if (!themeData.theme?.name && !themeData.metadata?.name) {
    errors.push('Nom du thème manquant (theme.name ou metadata.name)');
  }

  // Vérifier les collectibles
  if (themeData.collectibles) {
    if (!Array.isArray(themeData.collectibles)) {
      errors.push('collectibles doit être un tableau');
    } else {
      themeData.collectibles.forEach((col, i) => {
        if (!col.name) errors.push(`Collectible ${i}: nom manquant`);
        if (!col.rarity) errors.push(`Collectible ${i} (${col.name}): rareté manquante`);
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function normalizeRarity(rarity) {
  if (!rarity) return 'common';
  const r = rarity.toLowerCase();
  if (VALID_RARITIES.includes(r)) return r;
  if (r === 'légendaire' || r === 'legendaire') return 'legendary';
  if (r === 'épique' || r === 'epique') return 'epic';
  return 'common';
}

function generateId(name) {
  if (!name) return `item_${Date.now()}`;
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Exécution en CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node scripts/import-theme-from-library.js <theme_id> <guild_id> [--activate] [--dry-run]');
    console.log('');
    console.log('Exemples:');
    console.log('  node scripts/import-theme-from-library.js monopoly 1248028543389143070');
    console.log('  node scripts/import-theme-from-library.js pokemon 1248028543389143070 --activate');
    console.log('  node scripts/import-theme-from-library.js harry_potter 1248028543389143070 --dry-run');
    console.log('');

    // Lister les thèmes disponibles
    console.log('📚 Thèmes disponibles dans la library:');
    const themes = await db.queryAll('SELECT theme_id, name, creator_username, version FROM themes_library ORDER BY name');
    console.table(themes);

    process.exit(1);
  }

  const themeId = args[0];
  const guildId = args[1];
  const activate = args.includes('--activate');
  const dryRun = args.includes('--dry-run');

  const result = await importThemeFromLibrary(themeId, guildId, { activate, dryRun });

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});

module.exports = { importThemeFromLibrary };
