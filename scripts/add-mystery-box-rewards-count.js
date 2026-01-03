require('dotenv').config();
const db = require('../utils/database-pg');

async function addRewardsCount() {
    try {
        console.log('🔧 MIGRATION: Ajout colonne rewards_count\n');
        console.log('='.repeat(60));

        // 1. Ajouter la colonne rewards_count
        console.log('\n1️⃣ Ajout colonne rewards_count...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD COLUMN IF NOT EXISTS rewards_count INTEGER DEFAULT 1
            `);
            console.log('   ✅ rewards_count ajoutée (défaut: 1)');
        } catch (e) {
            if (e.code === '42701') {
                console.log('   ⏭️  rewards_count existe déjà');
            } else throw e;
        }

        // 2. Ajouter contrainte CHECK pour rewards_count (1-5)
        console.log('\n2️⃣ Ajout contrainte rewards_count (1-5)...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP CONSTRAINT IF EXISTS mystery_box_config_rewards_count_check
            `);
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD CONSTRAINT mystery_box_config_rewards_count_check
                CHECK (rewards_count >= 1 AND rewards_count <= 5)
            `);
            console.log('   ✅ Contrainte ajoutée: rewards_count entre 1 et 5');
        } catch (e) {
            console.log(`   ⚠️ Erreur contrainte: ${e.message}`);
        }

        // 3. Configurer les valeurs par défaut selon la rareté
        console.log('\n3️⃣ Configuration valeurs par défaut par rareté...');

        // Common = 1, Rare = 1, Epic = 2, Legendary = 3
        const defaults = [
            { rarity: 'common', count: 1 },
            { rarity: 'rare', count: 1 },
            { rarity: 'epic', count: 2 },
            { rarity: 'legendary', count: 3 }
        ];

        for (const { rarity, count } of defaults) {
            const result = await db.query(`
                UPDATE mystery_box_config
                SET rewards_count = $1
                WHERE rarity = $2 AND rewards_count = 1
            `, [count, rarity]);
            console.log(`   📦 ${rarity}: ${result.rowCount || 0} box(es) → ${count} récompense(s)`);
        }

        // 4. Vérification finale
        console.log('\n' + '='.repeat(60));
        console.log('📋 VÉRIFICATION FINALE\n');

        const stats = await db.queryAll(`
            SELECT rarity, rewards_count, COUNT(*) as boxes
            FROM mystery_box_config
            GROUP BY rarity, rewards_count
            ORDER BY
                CASE rarity
                    WHEN 'common' THEN 1
                    WHEN 'rare' THEN 2
                    WHEN 'epic' THEN 3
                    WHEN 'legendary' THEN 4
                END,
                rewards_count
        `);

        console.log('Configuration rewards_count:');
        stats.forEach(s => console.log(`  📦 ${s.rarity}: ${s.rewards_count} récompense(s) × ${s.boxes} box(es)`));

        console.log('\n✅ MIGRATION TERMINÉE!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

addRewardsCount();
