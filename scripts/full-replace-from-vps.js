/**
 * REMPLACEMENT COMPLET: Toutes les données VPS → Local
 *
 * Ce script:
 * 1. Supprime TOUTES les données des tables communes VPS/Local
 * 2. Importe TOUTES les données du backup VPS avec leurs IDs originaux
 * 3. Préserve les tables Theme Builder locales (n'existent pas sur VPS)
 * 4. Met à jour toutes les séquences
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Tables Theme Builder à NE PAS TOUCHER (n'existent pas sur VPS)
const THEME_BUILDER_ONLY_TABLES = [
  'theme_builder_sessions',
  'theme_builder_logs',
  'theme_uploads',
  'themes_library',
  'banned_builder_users'
];

// Ordre de suppression (enfants d'abord - respecter FK)
const DELETE_ORDER = [
  // Données joueurs
  'player_login_history',
  'player_cooldowns',
  'player_malus_points',
  'player_active_bonuses',
  'player_badges',
  'badge_progress',
  'bonus_usage_history',
  'collections',
  'trap_triggered',
  'mission_progress',
  'player_progress',
  'players',

  // Campagnes
  'give_logs',
  'give_channels',
  'give_campaigns',

  // Super bonuses (avant themes car FK)
  'super_bonuses',

  // Thème contenu
  'quiz_questions',
  'mission_keywords',
  'missions',
  'traps',
  'collectibles',
  'theme_messages',
  'theme_config',
  'announcement_templates',
  'themes',

  // Config serveur
  'announcement_settings',
  'guild_admin_roles',
  'progression_roles',
  'rarity_probabilities',
  'guild_config',

  // Super admin
  'super_admin_logs',
  'super_admins',

  // Autres
  'audit_logs',
  'apple_game_winners',
  'badges',
  'colors'
];

// Ordre d'insertion (parents d'abord - respecter FK)
const INSERT_ORDER = [
  // Base
  'colors',
  'badges',

  // Config serveur (parent de beaucoup de FK)
  'guild_config',
  'guild_admin_roles',
  'announcement_settings',
  'progression_roles',
  'rarity_probabilities',

  // Thèmes (parent de super_bonuses et autres)
  'themes',
  'theme_config',
  'theme_messages',
  'collectibles',
  'traps',
  'missions',
  'mission_keywords',
  'quiz_questions',
  'announcement_templates',

  // Super (après themes car FK)
  'super_admins',
  'super_admin_logs',
  'super_bonuses',

  // Joueurs
  'players',
  'player_progress',
  'collections',
  'player_active_bonuses',
  'player_badges',
  'player_cooldowns',
  'player_login_history',
  'player_malus_points',
  'badge_progress',
  'bonus_usage_history',
  'trap_triggered',
  'mission_progress',

  // Campagnes
  'give_campaigns',
  'give_channels',
  'give_logs',

  // Autres
  'audit_logs',
  'apple_game_winners'
];

async function fullReplace() {
  try {
    console.log('🔄 REMPLACEMENT COMPLET: VPS → LOCAL\n');
    console.log('='.repeat(80));
    console.log('⚠️  Cette opération va REMPLACER toutes les données locales');
    console.log('📋 Tables Theme Builder préservées:', THEME_BUILDER_ONLY_TABLES.join(', '));
    console.log('='.repeat(80));

    // Lire le backup VPS
    const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    console.log('\n✅ Backup VPS chargé');

    // Parser toutes les sections COPY du backup
    function parseCopySection(tableName) {
      const regex = new RegExp(
        `COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;([\\s\\S]*?)\\\\\\.`,
        'i'
      );
      const match = backupContent.match(regex);
      if (!match) return { columns: [], rows: [] };

      const columns = match[1].split(',').map(c => c.trim());
      const rows = match[2].trim().split('\n').filter(l => l.trim()).map(line => {
        const values = line.split('\t');
        const obj = {};
        columns.forEach((col, i) => {
          obj[col] = values[i] === '\\N' ? null : values[i];
        });
        return obj;
      });

      return { columns, rows };
    }

    // ===============================
    // PHASE 1: SUPPRESSION (chaque table séparément)
    // ===============================
    console.log('\n' + '─'.repeat(80));
    console.log('🗑️  PHASE 1: SUPPRESSION DES DONNÉES LOCALES');
    console.log('─'.repeat(80));

    for (const tableName of DELETE_ORDER) {
      if (THEME_BUILDER_ONLY_TABLES.includes(tableName)) continue;

      try {
        // Vérifier si la table existe
        const exists = await pool.query(`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);

        if (exists.rows.length === 0) continue;

        // Compter et supprimer
        const countBefore = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const count = parseInt(countBefore.rows[0].count);

        if (count > 0) {
          await pool.query(`DELETE FROM ${tableName}`);
          console.log(`   🗑️  ${tableName}: ${count} lignes supprimées`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${tableName}: ${err.message.substring(0, 50)}`);
      }
    }

    // ===============================
    // PHASE 2: INSERTION (chaque table séparément)
    // ===============================
    console.log('\n' + '─'.repeat(80));
    console.log('📥 PHASE 2: IMPORT DES DONNÉES VPS');
    console.log('─'.repeat(80));

    let totalInserted = 0;

    for (const tableName of INSERT_ORDER) {
      if (THEME_BUILDER_ONLY_TABLES.includes(tableName)) continue;

      try {
        // Vérifier si la table existe
        const exists = await pool.query(`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);

        if (exists.rows.length === 0) continue;

        // Parser les données VPS
        const { columns, rows } = parseCopySection(tableName);
        if (rows.length === 0) continue;

        // Récupérer les colonnes locales
        const localColsResult = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);
        const localColumns = new Set(localColsResult.rows.map(r => r.column_name));

        // Filtrer les colonnes valides
        const validColumns = columns.filter(c => localColumns.has(c));
        if (validColumns.length === 0) continue;

        let inserted = 0;
        let errors = 0;

        for (const row of rows) {
          const insertCols = validColumns.filter(c => row[c] !== undefined);
          const insertVals = insertCols.map(c => row[c]);
          const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');

          try {
            await pool.query(
              `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders})`,
              insertVals
            );
            inserted++;
          } catch (err) {
            errors++;
            if (errors <= 2) {
              console.log(`   ❌ ${tableName}: ${err.message.substring(0, 70)}...`);
            }
          }
        }

        if (inserted > 0) {
          const status = errors > 0 ? `✅ ${inserted} / ❌ ${errors}` : `✅ ${inserted}`;
          console.log(`   📦 ${tableName}: ${status} lignes`);
          totalInserted += inserted;
        }

      } catch (err) {
        console.log(`   ⚠️  ${tableName}: ${err.message.substring(0, 50)}`);
      }
    }

    // ===============================
    // PHASE 3: MISE À JOUR SÉQUENCES
    // ===============================
    console.log('\n' + '─'.repeat(80));
    console.log('🔧 PHASE 3: MISE À JOUR DES SÉQUENCES');
    console.log('─'.repeat(80));

    const seqResult = await pool.query(`
      SELECT sequence_name FROM information_schema.sequences
      WHERE sequence_schema = 'public'
    `);

    for (const row of seqResult.rows) {
      const seqName = row.sequence_name;
      const tableName = seqName.replace('_id_seq', '');

      try {
        const tableExists = await pool.query(`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);

        if (tableExists.rows.length > 0) {
          await pool.query(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${tableName}), 1))`);
          console.log(`   ✅ ${seqName}`);
        }
      } catch (e) {
        // Ignorer
      }
    }

    // ===============================
    // PHASE 4: VÉRIFICATION
    // ===============================
    console.log('\n' + '─'.repeat(80));
    console.log('📊 PHASE 4: VÉRIFICATION FINALE');
    console.log('─'.repeat(80));

    const tablesToCheck = ['themes', 'collectibles', 'traps', 'missions', 'quiz_questions', 'players', 'collections', 'super_bonuses'];

    for (const table of tablesToCheck) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${count.rows[0].count} entrées`);
      } catch (e) {}
    }

    // Vérifier les thèmes
    const themes = await pool.query(`SELECT id, name, guild_id FROM themes ORDER BY id`);
    console.log('\n📚 Thèmes importés:');
    themes.rows.forEach(t => {
      console.log(`   - ID ${t.id}: ${t.name} (Guild: ${t.guild_id})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`✅ REMPLACEMENT TERMINÉ! ${totalInserted} lignes importées au total`);
    console.log('='.repeat(80));

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    await pool.end();
    process.exit(1);
  }
}

fullReplace();
