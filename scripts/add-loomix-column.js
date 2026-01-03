/**
 * Script pour ajouter la colonne loomix à la table players
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function addLoomixColumn() {
    console.log('='.repeat(70));
    console.log('MIGRATION: Ajout colonne loomix à players');
    console.log('='.repeat(70));
    console.log('');

    try {
        // Vérifier si la colonne existe déjà
        const checkCol = await db.queryOne(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'players' AND column_name = 'loomix'
        `);

        if (checkCol) {
            console.log('✅ La colonne loomix existe déjà dans players');
        } else {
            console.log('⚠️  La colonne loomix n\'existe pas. Ajout en cours...');

            await db.query(`
                ALTER TABLE players
                ADD COLUMN IF NOT EXISTS loomix INTEGER DEFAULT 0
            `);

            console.log('✅ Colonne loomix ajoutée avec succès !');
        }

        // Vérifier la structure
        console.log('\n📋 Vérification de la structure players:');
        const cols = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'players'
            ORDER BY ordinal_position
        `);

        cols.forEach(c => {
            const highlight = c.column_name === 'loomix' ? ' ← LOOMIX' : '';
            console.log(`   - ${c.column_name}: ${c.data_type}${highlight}`);
        });

        console.log('\n' + '='.repeat(70));
        console.log('MIGRATION TERMINÉE');
        console.log('='.repeat(70));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

addLoomixColumn();
