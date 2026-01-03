require('dotenv').config();
const db = require('../utils/database-pg');

async function test() {
    const guildId = '297309737135898624';

    console.log('='.repeat(60));
    console.log('TEST REQUÊTE SUPER BONUS CORRIGÉE');
    console.log('='.repeat(60));

    const theme = await db.getActiveTheme(guildId);
    console.log('\n📋 Thème actif:', theme?.name, '| ID:', theme?.id);

    // Nouvelle requête (corrigée)
    const bonuses = await db.queryAll(`
        SELECT id, name, effect_type, icon, description
        FROM super_bonuses
        WHERE guild_id = $1 AND is_enabled = true
        AND (theme_id IS NULL OR theme_id = $2)
        ORDER BY name
    `, [guildId, theme?.id]);

    console.log('\n✅ Super bonuses trouvés avec la nouvelle requête (' + bonuses.length + '):');
    bonuses.forEach(b => {
        console.log(`  - ID ${b.id}: ${b.name} | icon=${b.icon} | effect=${b.effect_type}`);
    });

    process.exit(0);
}

test().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
