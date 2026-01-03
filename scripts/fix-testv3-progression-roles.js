/**
 * Fix: Ajouter required_items aux progression_roles de testv3
 * Le Theme Builder n'a pas calculé required_items depuis percentage
 */

const db = require('../utils/database-pg');

async function fix() {
  console.log('🔧 FIX: Ajouter required_items aux progression_roles de testv3');
  console.log('='.repeat(80));

  try {
    // 1. Récupérer le thème testv3
    const theme = await db.queryOne(`
      SELECT id, theme_id, name, guild_id FROM themes WHERE theme_id = 'testv3'
    `);

    if (!theme) {
      console.log('❌ Thème testv3 non trouvé');
      process.exit(1);
    }

    console.log(`\n📋 Thème: ${theme.name} (ID: ${theme.id})`);

    // 2. Compter les collectibles du thème
    const collectibleCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM collectibles WHERE theme_id = $1
    `, [theme.id]);

    const totalCollectibles = parseInt(collectibleCount.count);
    console.log(`📦 Total collectibles: ${totalCollectibles}`);

    // 3. Récupérer progression_roles actuel
    const config = await db.queryOne(`
      SELECT progression_roles FROM theme_config WHERE theme_id = $1
    `, [theme.id]);

    if (!config || !config.progression_roles) {
      console.log('❌ Aucune configuration progression_roles');
      process.exit(1);
    }

    console.log('\n📋 Progression roles actuels:');
    console.log(JSON.stringify(config.progression_roles, null, 2));

    // 4. Calculer required_items pour chaque rôle
    const updatedRoles = config.progression_roles.map(role => {
      const requiredItems = Math.ceil((role.percentage / 100) * totalCollectibles);
      console.log(`   - ${role.name}: ${role.percentage}% → ${requiredItems} items requis`);
      return {
        ...role,
        required_items: requiredItems
      };
    });

    // 5. Mettre à jour la base de données
    await db.query(`
      UPDATE theme_config
      SET progression_roles = $2::jsonb
      WHERE theme_id = $1
    `, [theme.id, JSON.stringify(updatedRoles)]);

    console.log('\n✅ Progression roles mis à jour avec required_items');

    // 6. Vérification
    const verif = await db.queryOne(`
      SELECT progression_roles FROM theme_config WHERE theme_id = $1
    `, [theme.id]);

    console.log('\n📋 Progression roles après fix:');
    console.log(JSON.stringify(verif.progression_roles, null, 2));

    console.log('\n✅ FIX TERMINÉ - Redémarrez le bot pour tester!');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

fix();
