/**
 * Audit complet du système de frames (collectibles + profil)
 * Vérifie toutes les tables, contraintes et données
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function auditFramesSystem() {
  console.log('='.repeat(80));
  console.log('🔍 AUDIT COMPLET DU SYSTÈME DE FRAMES');
  console.log('='.repeat(80));

  const issues = [];
  const successes = [];

  try {
    // 1. Lister toutes les tables liées aux frames
    console.log('\n📋 1. TABLES LIÉES AUX FRAMES\n');

    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%frame%' OR table_name LIKE '%collectible%')
      ORDER BY table_name
    `);

    console.log('Tables trouvées:');
    tables.forEach(t => console.log('  ✅ ' + t.table_name));

    const expectedTables = [
      'default_collectible_frames',
      'theme_collectible_frames',
      'default_profile_frames',
      'theme_profile_frames',
      'player_unlocked_frames',
      'player_equipped_frame'
    ];

    const foundTableNames = tables.map(t => t.table_name);
    expectedTables.forEach(expected => {
      if (!foundTableNames.includes(expected)) {
        issues.push(`Table manquante: ${expected}`);
        console.log('  ❌ MANQUANTE: ' + expected);
      }
    });

    // ============================================================
    // 2. DEFAULT_COLLECTIBLE_FRAMES (Fallback pour frames de collectibles)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 2. DEFAULT_COLLECTIBLE_FRAMES (Fallback collectibles par niveau)');
    console.log('='.repeat(80));

    const dcfCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'default_collectible_frames'
      ORDER BY ordinal_position
    `);

    if (dcfCols.length === 0) {
      issues.push('Table default_collectible_frames N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      dcfCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? '(NOT NULL)' : ''}`));

      const dcfData = await db.queryAll('SELECT * FROM default_collectible_frames ORDER BY rarity');
      console.log(`\n📦 Données (${dcfData.length} entrées):`);

      if (dcfData.length === 0) {
        issues.push('default_collectible_frames est VIDE - pas de fallback');
        console.log('  ⚠️ AUCUNE DONNÉE - Le fallback ne fonctionnera pas!');
      } else {
        dcfData.forEach(d => console.log(`  - ${d.rarity}: ${d.frame_url}`));
        successes.push(`default_collectible_frames: ${dcfData.length} frames configurées`);
      }
    }

    // ============================================================
    // 3. THEME_COLLECTIBLE_FRAMES (Frames de collectibles par thème)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 3. THEME_COLLECTIBLE_FRAMES (Par thème - basé sur NIVEAU)');
    console.log('='.repeat(80));

    const tcfCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'theme_collectible_frames'
      ORDER BY ordinal_position
    `);

    if (tcfCols.length === 0) {
      issues.push('Table theme_collectible_frames N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      tcfCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

      // Vérifier si la colonne 'level' existe (pas 'rarity')
      const hasLevel = tcfCols.some(c => c.column_name === 'level');
      const hasRarity = tcfCols.some(c => c.column_name === 'rarity');

      if (hasLevel) {
        console.log('\n✅ Colonne "level" présente - système basé sur NIVEAU (correct)');
        successes.push('theme_collectible_frames utilise "level" (pas rarity)');
      } else if (hasRarity) {
        console.log('\n⚠️ Colonne "rarity" présente mais devrait être "level"');
        issues.push('theme_collectible_frames utilise "rarity" au lieu de "level"');
      }

      // Utiliser rarity car c'est la colonne actuelle (à migrer vers level plus tard)
      const tcfData = await db.queryAll(`
        SELECT tcf.*, t.name as theme_name
        FROM theme_collectible_frames tcf
        LEFT JOIN themes t ON tcf.theme_id = t.id
        ORDER BY tcf.theme_id, tcf.rarity
      `);

      console.log(`\n📦 Configurations (${tcfData.length} entrées):`);
      if (tcfData.length === 0) {
        console.log('  ℹ️ Aucune configuration - Le fallback sera utilisé');
      } else {
        // Grouper par thème
        const byTheme = {};
        tcfData.forEach(d => {
          const key = d.theme_name || `Theme ${d.theme_id}`;
          if (!byTheme[key]) byTheme[key] = [];
          byTheme[key].push(d);
        });

        Object.entries(byTheme).forEach(([theme, frames]) => {
          console.log(`\n  🎨 ${theme}:`);
          frames.forEach(f => console.log(`    - ${f.rarity || f.level}: ${f.frame_url}`));
        });
      }
    }

    // ============================================================
    // 4. DEFAULT_PROFILE_FRAMES (Fallback pour frames de profil)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 4. DEFAULT_PROFILE_FRAMES (Fallback profil - 2 frames)');
    console.log('='.repeat(80));

    const dpfCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'default_profile_frames'
      ORDER BY ordinal_position
    `);

    if (dpfCols.length === 0) {
      issues.push('Table default_profile_frames N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      dpfCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

      const dpfData = await db.queryAll('SELECT * FROM default_profile_frames ORDER BY frame_number');
      console.log(`\n📦 Frames par défaut (${dpfData.length}):`);

      if (dpfData.length === 0) {
        issues.push('default_profile_frames est VIDE - pas de fallback profil');
        console.log('  ⚠️ AUCUNE DONNÉE');
      } else {
        dpfData.forEach(d => {
          console.log(`\n  🖼️ Frame ${d.frame_number}: ${d.name}`);
          console.log(`     ID: ${d.id}`);
          console.log(`     URL: ${d.frame_url}`);
          console.log(`     Condition: ${JSON.stringify(d.unlock_condition)}`);
        });
        successes.push(`default_profile_frames: ${dpfData.length} frames configurées`);

        // Vérifier les conditions attendues
        const frame1 = dpfData.find(f => f.frame_number === 1);
        const frame2 = dpfData.find(f => f.frame_number === 2);

        if (frame1) {
          const cond1 = frame1.unlock_condition;
          if (cond1.type === 'collectibles_level' && cond1.count === 5 && cond1.min_level === 3) {
            console.log('\n  ✅ Frame 1 condition correcte: 5 collectibles niveau 3+');
            successes.push('Frame 1 condition: 5 collectibles niveau 3+ ✓');
          } else {
            console.log(`\n  ⚠️ Frame 1 condition inattendue: ${JSON.stringify(cond1)}`);
            issues.push(`Frame 1 condition incorrecte: ${JSON.stringify(cond1)}`);
          }
        }

        if (frame2) {
          const cond2 = frame2.unlock_condition;
          if (cond2.type === 'legendary_level' && cond2.count === 1 && cond2.min_level === 4) {
            console.log('  ✅ Frame 2 condition correcte: 1 légendaire niveau 4');
            successes.push('Frame 2 condition: 1 légendaire niveau 4 ✓');
          } else {
            console.log(`  ⚠️ Frame 2 condition inattendue: ${JSON.stringify(cond2)}`);
            issues.push(`Frame 2 condition incorrecte: ${JSON.stringify(cond2)}`);
          }
        }
      }
    }

    // ============================================================
    // 5. THEME_PROFILE_FRAMES (Frames de profil par thème)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 5. THEME_PROFILE_FRAMES (Par thème)');
    console.log('='.repeat(80));

    const tpfCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'theme_profile_frames'
      ORDER BY ordinal_position
    `);

    if (tpfCols.length === 0) {
      issues.push('Table theme_profile_frames N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      tpfCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

      // Vérifier les colonnes essentielles
      const requiredCols = ['id', 'guild_id', 'theme_id', 'frame_number', 'name', 'frame_url', 'unlock_condition'];
      const missingCols = requiredCols.filter(col => !tpfCols.some(c => c.column_name === col));

      if (missingCols.length > 0) {
        issues.push(`theme_profile_frames: colonnes manquantes: ${missingCols.join(', ')}`);
        console.log('\n⚠️ Colonnes manquantes: ' + missingCols.join(', '));
      } else {
        console.log('\n✅ Toutes les colonnes essentielles présentes');
      }

      const tpfData = await db.queryAll(`
        SELECT tpf.*, t.name as theme_name
        FROM theme_profile_frames tpf
        LEFT JOIN themes t ON tpf.theme_id = t.id
        ORDER BY tpf.theme_id, tpf.frame_number
      `);

      console.log(`\n📦 Frames configurées (${tpfData.length}):`);
      if (tpfData.length === 0) {
        console.log('  ℹ️ Aucune - Le fallback sera utilisé automatiquement');
      } else {
        // Grouper par thème
        const byTheme = {};
        tpfData.forEach(d => {
          const key = d.theme_name || `Theme ${d.theme_id}`;
          if (!byTheme[key]) byTheme[key] = [];
          byTheme[key].push(d);
        });

        Object.entries(byTheme).forEach(([theme, frames]) => {
          console.log(`\n  🎨 ${theme}:`);
          frames.forEach(f => {
            console.log(`    Frame ${f.frame_number} (ID: ${f.id}): ${f.name}`);
            console.log(`      URL: ${f.frame_url}`);
            console.log(`      Condition: ${JSON.stringify(f.unlock_condition)}`);
          });
        });
        successes.push(`theme_profile_frames: ${tpfData.length} frames configurées`);
      }
    }

    // ============================================================
    // 6. PLAYER_UNLOCKED_FRAMES (Frames débloquées par les joueurs)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 6. PLAYER_UNLOCKED_FRAMES (Frames débloquées)');
    console.log('='.repeat(80));

    const pufCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_unlocked_frames'
      ORDER BY ordinal_position
    `);

    if (pufCols.length === 0) {
      issues.push('Table player_unlocked_frames N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      pufCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

      // CRITIQUE: Vérifier la contrainte unique sur (discord_id, frame_id)
      console.log('\n🔒 Contraintes UNIQUE (CRITIQUE pour éviter doublons):');

      const constraints = await db.queryAll(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'player_unlocked_frames'::regclass
      `);

      const uniqueConstraints = constraints.filter(c => c.definition.includes('UNIQUE'));

      if (uniqueConstraints.length === 0) {
        issues.push('CRITIQUE: player_unlocked_frames n\'a PAS de contrainte UNIQUE');
        console.log('  ❌ AUCUNE CONTRAINTE UNIQUE - Risque de doublons!');
      } else {
        uniqueConstraints.forEach(c => console.log(`  ✅ ${c.conname}: ${c.definition}`));

        // Vérifier si la contrainte inclut discord_id et frame_id
        const hasDiscordFrame = uniqueConstraints.some(c =>
          c.definition.includes('discord_id') && c.definition.includes('frame_id')
        );

        if (hasDiscordFrame) {
          console.log('\n  ✅ Contrainte (discord_id, frame_id) présente - pas de doublons possibles');
          successes.push('Contrainte unique (discord_id, frame_id) présente');
        } else {
          issues.push('Contrainte UNIQUE existe mais ne couvre pas (discord_id, frame_id)');
          console.log('\n  ⚠️ Contrainte existe mais vérifier qu\'elle couvre (discord_id, frame_id)');
        }
      }

      const pufCount = await db.queryOne('SELECT COUNT(*) as count FROM player_unlocked_frames');
      console.log(`\n📦 Nombre de frames débloquées: ${pufCount.count}`);

      // Vérifier s'il y a des doublons
      const duplicates = await db.queryAll(`
        SELECT discord_id, frame_id, COUNT(*) as count
        FROM player_unlocked_frames
        GROUP BY discord_id, frame_id
        HAVING COUNT(*) > 1
      `);

      if (duplicates.length > 0) {
        issues.push(`DOUBLONS DÉTECTÉS: ${duplicates.length} paires discord_id/frame_id en double`);
        console.log(`\n  ❌ DOUBLONS DÉTECTÉS: ${duplicates.length}`);
        duplicates.forEach(d => console.log(`    - discord_id: ${d.discord_id}, frame_id: ${d.frame_id}, count: ${d.count}`));
      } else if (parseInt(pufCount.count) > 0) {
        console.log('  ✅ Aucun doublon détecté');
        successes.push('Aucun doublon dans player_unlocked_frames');
      }
    }

    // ============================================================
    // 7. PLAYER_EQUIPPED_FRAME (Frame actuellement équipée)
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 7. PLAYER_EQUIPPED_FRAME (Frame équipée - cross-serveur)');
    console.log('='.repeat(80));

    const pefCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_equipped_frame'
      ORDER BY ordinal_position
    `);

    if (pefCols.length === 0) {
      issues.push('Table player_equipped_frame N\'EXISTE PAS');
      console.log('\n❌ Table N\'EXISTE PAS');
    } else {
      console.log('\nColonnes:');
      pefCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

      // Vérifier si guild_id peut être '__global__' pour cross-serveur
      const hasGuildId = pefCols.some(c => c.column_name === 'guild_id');
      if (hasGuildId) {
        console.log('\n✅ Colonne guild_id présente');
        console.log('   → Peut être "__global__" pour frame cross-serveur');
        successes.push('player_equipped_frame supporte guild_id (cross-serveur via __global__)');
      }

      const pefCount = await db.queryOne('SELECT COUNT(*) as count FROM player_equipped_frame');
      console.log(`\n📦 Nombre de frames équipées: ${pefCount.count}`);

      // Vérifier les contraintes
      const pefConstraints = await db.queryAll(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'player_equipped_frame'::regclass
      `);

      console.log('\n🔒 Contraintes:');
      pefConstraints.forEach(c => console.log(`  - ${c.conname}: ${c.definition}`));
    }

    // ============================================================
    // 8. VÉRIFICATION DES FONCTIONS DATABASE
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 8. FONCTIONS DATABASE-PG.JS');
    console.log('='.repeat(80));

    const requiredFunctions = [
      // Collectible frames
      'getCollectibleFrameUrl',
      'getThemeCollectibleFrames',
      // Profile frames
      'getDefaultProfileFrames',
      'getThemeProfileFrames',
      'setThemeProfileFrame',
      // Unlock/Equip
      'checkAndUnlockFrames',
      'checkFrameUnlockCondition',
      'getUnlockedFrames',
      'equipFrame',
      'unequipFrame',
      'getEquippedFrame'
    ];

    console.log('\nFonctions requises:');
    requiredFunctions.forEach(fn => {
      const exists = typeof db[fn] === 'function';
      console.log(`  ${exists ? '✅' : '❌'} ${fn}()`);
      if (!exists) {
        issues.push(`Fonction manquante: db.${fn}()`);
      } else {
        successes.push(`Fonction ${fn}() présente`);
      }
    });

    // ============================================================
    // RÉSUMÉ FINAL
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ DE L\'AUDIT');
    console.log('='.repeat(80));

    if (successes.length > 0) {
      console.log('\n✅ ÉLÉMENTS CONFORMES (' + successes.length + '):');
      successes.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    }

    if (issues.length > 0) {
      console.log('\n❌ PROBLÈMES DÉTECTÉS (' + issues.length + '):');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));

      console.log('\n🔧 ACTIONS CORRECTIVES SUGGÉRÉES:');
      issues.forEach((issue, i) => {
        if (issue.includes('Table manquante') || issue.includes('N\'EXISTE PAS')) {
          console.log(`  ${i + 1}. Créer la table: ${issue.split(':')[1] || issue}`);
        } else if (issue.includes('contrainte UNIQUE')) {
          console.log(`  ${i + 1}. Ajouter: ALTER TABLE player_unlocked_frames ADD CONSTRAINT unique_discord_frame UNIQUE (discord_id, frame_id);`);
        } else if (issue.includes('VIDE')) {
          console.log(`  ${i + 1}. Exécuter le script de seed correspondant`);
        } else if (issue.includes('Fonction manquante')) {
          console.log(`  ${i + 1}. Implémenter la fonction dans utils/database-pg.js`);
        }
      });
    } else {
      console.log('\n🎉 SYSTÈME DE FRAMES ENTIÈREMENT CONFORME !');
    }

  } catch (error) {
    console.error('\n❌ ERREUR LORS DE L\'AUDIT:', error);
  }

  process.exit(0);
}

auditFramesSystem();
