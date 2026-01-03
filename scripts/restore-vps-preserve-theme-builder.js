/**
 * Script pour restaurer le backup VPS tout en préservant les tables Theme Builder locales
 *
 * Étapes:
 * 1. Lire le backup VPS
 * 2. Filtrer les sections concernant les tables Theme Builder
 * 3. Exécuter le backup modifié
 * 4. Restaurer les tables Theme Builder depuis le JSON backup
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const THEME_BUILDER_TABLES = [
  'banned_builder_users',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_builder_sessions',
  'theme_builder_user_quotas',
  'themes_library'
];

const VPS_BACKUP_FILE = path.join(__dirname, '..', 'backups', 'vps_backup_fresh.sql');
const THEME_BUILDER_BACKUP = path.join(__dirname, '..', 'backups', 'theme_builder_backup.json');
const FILTERED_BACKUP_FILE = path.join(__dirname, '..', 'backups', 'vps_backup_filtered.sql');

function filterVPSBackup(inputFile, outputFile) {
  console.log('📝 Filtrage du backup VPS...');

  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');

  let insideThemeBuilderSection = false;
  let insideDataSection = false;
  let filteredLines = [];
  let removedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Détecter le début d'une section Theme Builder
    let isThemeBuilderLine = false;

    for (const tableName of THEME_BUILDER_TABLES) {
      // CREATE TABLE
      if (line.includes(`CREATE TABLE public.${tableName}`)) {
        isThemeBuilderLine = true;
        insideThemeBuilderSection = true;
      }
      // COPY ... FROM stdin
      if (line.includes(`COPY public.${tableName}`)) {
        isThemeBuilderLine = true;
        insideDataSection = true;
      }
      // ALTER TABLE
      if (line.includes(`ALTER TABLE ONLY public.${tableName}`)) {
        isThemeBuilderLine = true;
      }
      // DROP/CREATE INDEX
      if (line.includes(`public.${tableName}_`) && (line.includes('INDEX') || line.includes('SEQUENCE'))) {
        isThemeBuilderLine = true;
      }
      // GRANT/REVOKE
      if (line.includes(`ON TABLE public.${tableName}`)) {
        isThemeBuilderLine = true;
      }
    }

    // Fin de section CREATE TABLE
    if (insideThemeBuilderSection && line.trim() === ');') {
      filteredLines.push(line); // Garder le ); de la section précédente si ce n'est pas Theme Builder
      insideThemeBuilderSection = false;
      removedLines++;
      continue;
    }

    // Fin de section COPY
    if (insideDataSection && line === '\\.') {
      insideDataSection = false;
      removedLines++;
      continue;
    }

    // Si on est dans une section Theme Builder, skip
    if (insideThemeBuilderSection || insideDataSection || isThemeBuilderLine) {
      removedLines++;
      continue;
    }

    filteredLines.push(line);
  }

  fs.writeFileSync(outputFile, filteredLines.join('\n'));
  console.log(`   ✅ ${removedLines} lignes supprimées (Theme Builder)`);
  console.log(`   ✅ Backup filtré sauvegardé: ${outputFile}`);

  return filteredLines.length;
}

async function dropAllTables() {
  console.log('\n🗑️  Suppression de toutes les tables...');

  // Récupérer la liste des tables
  const tables = await db.queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  // Utiliser DROP CASCADE pour supprimer les dépendances automatiquement
  for (const t of tables) {
    try {
      await db.query(`DROP TABLE IF EXISTS public."${t.table_name}" CASCADE`);
      console.log(`   ✅ Dropped ${t.table_name}`);
    } catch (err) {
      console.log(`   ⚠️  Erreur drop ${t.table_name}: ${err.message}`);
    }
  }

  console.log(`   ✅ ${tables.length} tables supprimées`);
}

async function restoreFilteredBackup() {
  console.log('\n📥 Restauration du backup VPS filtré...');

  const psqlPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';

  try {
    const command = `cmd /c "set PGPASSWORD=Discord2025IA@Bot && ${psqlPath} -U botuser -d botdb -f "${FILTERED_BACKUP_FILE}" 2>&1"`;

    const { stdout, stderr } = await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

    // Compter les lignes de succès
    const setVar = (stdout.match(/SET/g) || []).length;
    const createTable = (stdout.match(/CREATE TABLE/g) || []).length;
    const alterTable = (stdout.match(/ALTER TABLE/g) || []).length;

    console.log(`   ✅ SET: ${setVar}, CREATE TABLE: ${createTable}, ALTER TABLE: ${alterTable}`);

    // Vérifier les erreurs importantes
    if (stderr && stderr.includes('ERROR')) {
      console.log('   ⚠️  Quelques erreurs:');
      stderr.split('\n').filter(l => l.includes('ERROR')).slice(0, 5).forEach(l => console.log(`      ${l}`));
    }

    return true;
  } catch (error) {
    console.error('   ❌ Erreur restauration:', error.message);
    return false;
  }
}

async function restoreThemeBuilderTables() {
  console.log('\n🎨 Restauration des tables Theme Builder...');

  const backup = JSON.parse(fs.readFileSync(THEME_BUILDER_BACKUP, 'utf-8'));

  for (const tableName of THEME_BUILDER_TABLES) {
    const tableData = backup.tables[tableName];

    if (!tableData || !tableData.exists) {
      console.log(`   ⚠️  ${tableName}: pas de données dans le backup`);
      continue;
    }

    if (tableData.rowCount === 0) {
      console.log(`   ℹ️  ${tableName}: table vide (0 lignes)`);
      continue;
    }

    // Créer la table si elle n'existe pas
    const tableExists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [tableName]);

    if (!tableExists || !tableExists.exists) {
      // Créer la table avec les colonnes du backup
      const columnDefs = tableData.columns.map(c => {
        let def = `${c.column_name} ${c.data_type}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        return def;
      }).join(', ');

      await db.query(`CREATE TABLE IF NOT EXISTS public.${tableName} (${columnDefs})`);
      console.log(`   ➕ Table ${tableName} créée`);
    }

    // Vider la table avant d'insérer (au cas où VPS avait des données)
    await db.query(`DELETE FROM ${tableName}`);

    // Insérer les données
    const columns = tableData.columns.map(c => c.column_name);
    let inserted = 0;

    for (const row of tableData.rows) {
      const values = columns.map(col => row[col]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      try {
        await db.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (err) {
        // Ignorer les erreurs de clé dupliquée
        if (!err.message.includes('duplicate key')) {
          console.log(`   ⚠️  Erreur insert dans ${tableName}: ${err.message}`);
        }
      }
    }

    console.log(`   ✅ ${tableName}: ${inserted}/${tableData.rowCount} lignes restaurées`);
  }
}

async function verifyRestoration() {
  console.log('\n📊 VÉRIFICATION FINALE\n');
  console.log('='.repeat(80));

  // Compter les tables
  const tables = await db.queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log(`\n📋 Tables restaurées: ${tables.length}`);

  // Vérifier quelques tables clés
  const checks = [
    { table: 'themes', label: 'Thèmes' },
    { table: 'missions', label: 'Missions' },
    { table: 'quiz_questions', label: 'Quiz Questions' },
    { table: 'collectibles', label: 'Collectibles' },
    { table: 'players', label: 'Joueurs' },
    { table: 'theme_builder_config', label: 'Theme Builder Config' },
    { table: 'theme_builder_logs', label: 'Theme Builder Logs' }
  ];

  console.log('\n📊 Vérification des données:');

  for (const check of checks) {
    try {
      const result = await db.queryOne(`SELECT COUNT(*) as count FROM ${check.table}`);
      console.log(`   ✅ ${check.label}: ${result.count} lignes`);
    } catch (err) {
      console.log(`   ❌ ${check.label}: ${err.message}`);
    }
  }

  // Vérifier le thème Harry Potter
  const harryPotter = await db.queryOne(`
    SELECT id, name, is_active FROM themes
    WHERE guild_id = '297309737135898624' AND name ILIKE '%harry%potter%'
  `);

  if (harryPotter) {
    const missions = await db.queryOne(`
      SELECT COUNT(*) as count FROM missions WHERE theme_id = $1
    `, [harryPotter.id]);

    const questions = await db.queryOne(`
      SELECT COUNT(*) as count FROM quiz_questions
      WHERE mission_id IN (SELECT id FROM missions WHERE theme_id = $1)
    `, [harryPotter.id]);

    console.log(`\n🧙 Thème Harry Potter (ID: ${harryPotter.id}):`);
    console.log(`   - Missions: ${missions.count}`);
    console.log(`   - Questions: ${questions.count}`);
  }
}

async function main() {
  try {
    console.log('🔄 RESTAURATION VPS → LOCAL (préserve Theme Builder)\n');
    console.log('='.repeat(80));

    // Vérifier que les fichiers existent
    if (!fs.existsSync(VPS_BACKUP_FILE)) {
      console.error('❌ Fichier VPS backup non trouvé:', VPS_BACKUP_FILE);
      process.exit(1);
    }

    if (!fs.existsSync(THEME_BUILDER_BACKUP)) {
      console.error('❌ Fichier Theme Builder backup non trouvé:', THEME_BUILDER_BACKUP);
      process.exit(1);
    }

    // 1. Filtrer le backup VPS (retirer les tables Theme Builder)
    filterVPSBackup(VPS_BACKUP_FILE, FILTERED_BACKUP_FILE);

    // 2. Supprimer toutes les tables existantes
    await dropAllTables();

    // 3. Restaurer le backup VPS filtré
    const restored = await restoreFilteredBackup();
    if (!restored) {
      console.error('❌ Échec de la restauration');
      process.exit(1);
    }

    // 4. Restaurer les tables Theme Builder
    await restoreThemeBuilderTables();

    // 5. Vérification finale
    await verifyRestoration();

    console.log('\n✅ RESTAURATION TERMINÉE AVEC SUCCÈS!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
