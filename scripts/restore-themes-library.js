/**
 * Script pour restaurer themes_library depuis le backup local
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');

async function main() {
  try {
    console.log('🔍 Extraction des données themes_library du backup local...\n');

    const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');

    // Trouver la section COPY pour themes_library
    const copyMatch = backupContent.match(/COPY public\.themes_library \(([^)]+)\) FROM stdin;([\s\S]*?)\\\./);

    if (!copyMatch) {
      console.log('❌ Aucune donnée themes_library trouvée dans le backup');
      process.exit(0);
    }

    const columns = copyMatch[1].split(', ').map(c => c.trim());
    const dataLines = copyMatch[2].trim().split('\n').filter(l => l.length > 0);

    console.log(`📋 Colonnes: ${columns.join(', ')}`);
    console.log(`📦 ${dataLines.length} thèmes trouvés dans le backup\n`);

    if (dataLines.length === 0) {
      console.log('❌ Aucune donnée à restaurer');
      process.exit(0);
    }

    // Parser les données
    const themes = dataLines.map(line => {
      const values = line.split('\t');
      const theme = {};
      columns.forEach((col, i) => {
        let val = values[i];
        if (val === '\\N') val = null;
        theme[col] = val;
      });
      return theme;
    });

    console.log('📥 Insertion des thèmes...');

    for (const theme of themes) {
      try {
        // Vérifier si le thème existe déjà
        const existing = await db.queryOne(
          'SELECT id FROM themes_library WHERE id = $1',
          [theme.id]
        );

        if (existing) {
          console.log(`  ⏭️  Thème ${theme.id} existe déjà, skip`);
          continue;
        }

        // Insérer avec les colonnes dynamiques
        const cols = Object.keys(theme).filter(k => theme[k] !== null);
        const vals = cols.map(k => theme[k]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(
          `INSERT INTO themes_library (${cols.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        console.log(`  ✅ Thème "${theme.name || theme.id}" restauré`);
      } catch (err) {
        console.log(`  ❌ Erreur thème ${theme.id}: ${err.message}`);
      }
    }

    // Vérification finale
    const count = await db.queryOne('SELECT COUNT(*) as total FROM themes_library');
    console.log(`\n✅ Total thèmes dans library: ${count.total}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
