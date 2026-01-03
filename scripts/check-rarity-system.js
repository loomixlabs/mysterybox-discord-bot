const db = require('../utils/database-pg');

async function checkRaritySystem() {
    console.log('='.repeat(60));
    console.log('🎲 ANALYSE DU SYSTÈME DE RARETÉ');
    console.log('='.repeat(60));

    try {
        // 1. Rarités des collectibles
        console.log('\n📦 RARITIES COLLECTIBLES:');
        const collectibles = await db.queryAll(`
            SELECT rarity, COUNT(*) as count
            FROM collectibles
            GROUP BY rarity
            ORDER BY rarity
        `);
        console.table(collectibles);

        // 2. Rarités des super bonus
        console.log('\n⭐ RARITIES SUPER BONUS:');
        const bonuses = await db.queryAll(`
            SELECT rarity, COUNT(*) as count
            FROM super_bonuses
            GROUP BY rarity
            ORDER BY rarity
        `);
        console.table(bonuses);

        // 3. Probabilités par rareté
        console.log('\n📊 PROBABILITIES PAR RARETÉ:');
        const probs = await db.queryAll(`
            SELECT rarity, probability
            FROM rarity_probabilities
            ORDER BY rarity
        `);
        console.table(probs);

        // 4. Structure table players (colonnes existantes)
        console.log('\n👤 COLONNES TABLE PLAYERS (pour voir ce qui existe):');
        const playerCols = await db.queryAll(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'players'
            ORDER BY column_name
        `);
        console.table(playerCols);

        console.log('\n✅ Analyse terminée');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

checkRaritySystem();
