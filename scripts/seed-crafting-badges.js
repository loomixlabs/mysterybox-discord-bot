/**
 * Script de seeding des badges Crafting
 * Crée les badges liés au système de craft de clés
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const CRAFTING_BADGES = [
    // ==========================================================================
    // BADGES UPGRADES (crafting)
    // ==========================================================================
    {
        code: 'CRAFT_NOVICE',
        name: 'Artisan Débutant',
        description: 'Effectue ton premier craft de clé',
        emoji: '🔨',
        rarity: 'common',
        category: 'crafting',
        condition_type: 'crafting_upgrades',
        condition_value: 1,
        color: '#95A5A6'
    },
    {
        code: 'CRAFT_APPRENTICE',
        name: 'Apprenti Forgeron',
        description: 'Effectue 10 crafts de clés',
        emoji: '🔨✨',
        rarity: 'rare',
        category: 'crafting',
        condition_type: 'crafting_upgrades',
        condition_value: 10,
        color: '#3498DB'
    },
    {
        code: 'CRAFT_EXPERT',
        name: 'Forgeron Expert',
        description: 'Effectue 50 crafts de clés',
        emoji: '⚒️',
        rarity: 'epic',
        category: 'crafting',
        condition_type: 'crafting_upgrades',
        condition_value: 50,
        color: '#9B59B6'
    },
    {
        code: 'CRAFT_MASTER',
        name: 'Maître Forgeron',
        description: 'Effectue 100 crafts de clés',
        emoji: '⚒️👑',
        rarity: 'legendary',
        category: 'crafting',
        condition_type: 'crafting_upgrades',
        condition_value: 100,
        color: '#FFD700'
    },
    {
        code: 'CRAFT_LEGEND',
        name: 'Légende de la Forge',
        description: 'Effectue 500 crafts de clés',
        emoji: '🏆⚒️',
        rarity: 'mythic',
        category: 'crafting',
        condition_type: 'crafting_upgrades',
        condition_value: 500,
        color: '#E74C3C'
    },

    // ==========================================================================
    // BADGES CRITIQUES
    // ==========================================================================
    {
        code: 'CRAFT_LUCKY',
        name: 'Coup de Chance',
        description: 'Obtiens ton premier craft critique',
        emoji: '🎲',
        rarity: 'rare',
        category: 'crafting',
        condition_type: 'crafting_criticals',
        condition_value: 1,
        color: '#3498DB'
    },
    {
        code: 'CRAFT_FORTUNE',
        name: 'Fortune du Forgeron',
        description: 'Obtiens 10 crafts critiques',
        emoji: '🎲✨',
        rarity: 'epic',
        category: 'crafting',
        condition_type: 'crafting_criticals',
        condition_value: 10,
        color: '#9B59B6'
    },
    {
        code: 'CRAFT_BLESSED',
        name: 'Béni des Dieux',
        description: 'Obtiens 50 crafts critiques',
        emoji: '🎲👑',
        rarity: 'legendary',
        category: 'crafting',
        condition_type: 'crafting_criticals',
        condition_value: 50,
        color: '#FFD700'
    },

    // ==========================================================================
    // BADGES RECYCLAGE
    // ==========================================================================
    {
        code: 'RECYCLER_NOVICE',
        name: 'Recycleur Novice',
        description: 'Effectue ton premier recyclage de clé',
        emoji: '♻️',
        rarity: 'common',
        category: 'crafting',
        condition_type: 'crafting_recycles',
        condition_value: 1,
        color: '#95A5A6'
    },
    {
        code: 'RECYCLER_EXPERT',
        name: 'Recycleur Expert',
        description: 'Effectue 25 recyclages de clés',
        emoji: '♻️✨',
        rarity: 'rare',
        category: 'crafting',
        condition_type: 'crafting_recycles',
        condition_value: 25,
        color: '#3498DB'
    },
    {
        code: 'RECYCLER_MASTER',
        name: 'Maître Recycleur',
        description: 'Effectue 100 recyclages de clés',
        emoji: '♻️👑',
        rarity: 'epic',
        category: 'crafting',
        condition_type: 'crafting_recycles',
        condition_value: 100,
        color: '#9B59B6'
    }
];

async function seedCraftingBadges() {
    console.log('='.repeat(70));
    console.log('SEEDING: Badges Crafting');
    console.log('='.repeat(70));
    console.log('');

    try {
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const badge of CRAFTING_BADGES) {
            // Vérifier si le badge existe déjà
            const existing = await db.queryOne(
                'SELECT * FROM badges WHERE code = $1',
                [badge.code]
            );

            if (existing) {
                // Mettre à jour si nécessaire
                await db.query(`
                    UPDATE badges
                    SET name = $1, description = $2, emoji = $3, rarity = $4,
                        category = $5, condition_type = $6, condition_value = $7, color = $8
                    WHERE code = $9
                `, [
                    badge.name, badge.description, badge.emoji, badge.rarity,
                    badge.category, badge.condition_type, badge.condition_value, badge.color,
                    badge.code
                ]);
                updated++;
                console.log(`🔄 MàJ: ${badge.emoji} ${badge.name} (${badge.code})`);
            } else {
                // Créer le badge
                await db.query(`
                    INSERT INTO badges (code, name, description, emoji, rarity, category, condition_type, condition_value, color)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    badge.code, badge.name, badge.description, badge.emoji, badge.rarity,
                    badge.category, badge.condition_type, badge.condition_value, badge.color
                ]);
                created++;
                console.log(`✅ Créé: ${badge.emoji} ${badge.name} (${badge.code})`);
            }
        }

        console.log('');
        console.log('='.repeat(70));
        console.log(`📊 Résumé: ${created} créés, ${updated} mis à jour, ${skipped} ignorés`);
        console.log('='.repeat(70));

        // Vérifier le total
        const total = await db.queryOne(
            `SELECT COUNT(*) as cnt FROM badges WHERE category = 'crafting'`
        );
        console.log(`\n🏆 Total badges Crafting en DB: ${total.cnt}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du seeding:', error);
        process.exit(1);
    }
}

seedCraftingBadges();
