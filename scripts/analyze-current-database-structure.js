require('dotenv').config();
const db = require('../utils/database-pg');

async function analyzeCurrentDatabase() {
  console.log('🔍 ANALYSE COMPLÈTE DE LA BASE DE DONNÉES POSTGRESQL\n');
  console.log('━'.repeat(100));

  try {
    // 1. Lister toutes les tables
    console.log('\n📊 ÉTAPE 1: LISTE DE TOUTES LES TABLES\n');

    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`   ${tables.length} table(s) trouvée(s):\n`);
    tables.forEach((table, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(2)}. ${table.table_name}`);
    });

    // 2. Vérifier si guild_config existe
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 2: VÉRIFICATION DE guild_config\n');

    const guildConfigExists = tables.some(t => t.table_name === 'guild_config');

    if (guildConfigExists) {
      console.log('   ⚠️  La table guild_config EXISTE DÉJÀ\n');

      // Récupérer la structure actuelle
      const columns = await db.query(`
        SELECT
          column_name,
          data_type,
          column_default,
          is_nullable,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'guild_config'
        ORDER BY ordinal_position
      `);

      console.log('   Structure actuelle de guild_config:\n');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
        const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`      - ${col.column_name.padEnd(30)} ${col.data_type}${maxLength} ${nullable} ${defaultVal}`);
      });

      // Vérifier les données existantes
      const existingData = await db.query(`SELECT * FROM guild_config`);
      console.log(`\n   Données existantes: ${existingData.length} ligne(s)\n`);

      if (existingData.length > 0) {
        existingData.forEach(row => {
          console.log(`      Guild ID: ${row.guild_id}`);
          Object.keys(row).forEach(key => {
            if (key !== 'guild_id') {
              console.log(`         ${key}: ${row[key]}`);
            }
          });
          console.log('');
        });
      }

      // Vérifier les contraintes
      const constraints = await db.query(`
        SELECT
          conname as constraint_name,
          contype as constraint_type,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'guild_config'::regclass
      `);

      if (constraints.length > 0) {
        console.log('   Contraintes existantes:\n');
        constraints.forEach(c => {
          const type = {
            'p': 'PRIMARY KEY',
            'f': 'FOREIGN KEY',
            'u': 'UNIQUE',
            'c': 'CHECK'
          }[c.constraint_type] || c.constraint_type;
          console.log(`      ${type}: ${c.constraint_name}`);
          console.log(`         ${c.definition}\n`);
        });
      }

    } else {
      console.log('   ✅ La table guild_config N\'EXISTE PAS\n');
      console.log('   → Création possible sans conflit\n');
    }

    // 3. Vérifier la table guilds (pour la foreign key)
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 3: VÉRIFICATION DE LA TABLE guilds\n');

    const guildsTableExists = tables.some(t => t.table_name === 'guilds');

    if (guildsTableExists) {
      const guildsColumns = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'guilds'
        ORDER BY ordinal_position
      `);

      console.log('   ✅ Table guilds trouvée\n');
      console.log('   Structure de guilds:\n');
      guildsColumns.forEach(col => {
        console.log(`      - ${col.column_name.padEnd(20)} ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Vérifier les guilds existants
      const guilds = await db.query(`SELECT guild_id, guild_name FROM guilds`);
      console.log(`\n   Guilds existants: ${guilds.length}\n`);
      guilds.forEach(g => {
        console.log(`      - ${g.guild_id} (${g.guild_name})`);
      });
    } else {
      console.log('   ❌ Table guilds N\'EXISTE PAS\n');
      console.log('   ⚠️  IMPORTANT: guild_config semble être la table principale pour les guilds\n');
    }

    // 4. Vérifier les tables liées à la configuration
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 4: TABLES DE CONFIGURATION EXISTANTES\n');

    const configTables = [
      'announcement_settings',
      'announcement_templates',
      'guild_settings'
    ];

    for (const tableName of configTables) {
      const exists = tables.some(t => t.table_name === tableName);

      if (exists) {
        const columns = await db.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        console.log(`   ✅ ${tableName} (${columns.length} colonnes)`);

        // Afficher les colonnes liées à guild_id
        const guildIdCol = columns.find(c => c.column_name === 'guild_id');
        if (guildIdCol) {
          console.log(`      → Contient guild_id (${guildIdCol.data_type})`);
        }
      } else {
        console.log(`   ❌ ${tableName} n'existe pas`);
      }
    }

    // 5. Analyse des index existants
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 5: INDEX EXISTANTS\n');

    const indexes = await db.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('guilds', 'guild_config', 'announcement_settings')
      ORDER BY tablename, indexname
    `);

    if (indexes.length > 0) {
      console.log('   Index trouvés:\n');
      indexes.forEach(idx => {
        console.log(`      ${idx.tablename}.${idx.indexname}`);
        console.log(`         ${idx.indexdef}\n`);
      });
    }

    // 6. Recommandations
    console.log('━'.repeat(100));
    console.log('\n📋 RECOMMANDATIONS\n');

    if (guildConfigExists) {
      console.log('   ⚠️  CONFLIT MAJEUR: guild_config existe avec une structure différente\n');
      console.log('   Usage actuel: Gestion administrative des guilds (trial, activation, etc.)\n');
      console.log('   Usage souhaité: Configuration personnalisée (branding, couleurs, etc.)\n\n');
      console.log('   ✅ RECOMMANDATION: Utiliser un nom différent\n');
      console.log('   Suggestions:\n');
      console.log('      1. guild_branding     (focus sur l\'apparence)\n');
      console.log('      2. guild_customization (focus sur la personnalisation)\n');
      console.log('      3. server_settings    (focus sur les paramètres)\n');
      console.log('      4. guild_appearance   (focus sur le visuel)\n\n');

      if (!guildsTableExists) {
        console.log('   ⚠️  ATTENTION: Pas de table guilds\n');
        console.log('   → La foreign key doit référencer guild_config(guild_id)\n');
        console.log('   → OU ne pas utiliser de foreign key\n');
      }
    } else {
      console.log('   ✅ Aucun conflit détecté\n');
      console.log('   → guild_config peut être créé sans problème\n');
      console.log('   → Foreign key vers guilds(guild_id) est possible\n');
    }

    console.log('━'.repeat(100));
    console.log('\n✅ ANALYSE TERMINÉE\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeCurrentDatabase();
