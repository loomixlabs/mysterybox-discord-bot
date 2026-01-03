const db = require('../utils/database-pg');

async function checkVisionDivineMapping() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🔍 VÉRIFICATION DU MAPPING VISION DIVINE\n');
    console.log('='.repeat(80));

    // 1. Récupérer Vision Divine dans super_bonuses
    const visionDivineInSuperBonuses = await db.queryOne(
      `SELECT id, bonus_id, name, icon, duration_type, duration_value, activation_mode
       FROM super_bonuses
       WHERE name = 'Vision Divine' AND guild_id = $1`,
      [guildId]
    );

    if (!visionDivineInSuperBonuses) {
      console.log('❌ Vision Divine introuvable dans super_bonuses\n');
      process.exit(1);
    }

    console.log('📋 Vision Divine dans super_bonuses:');
    console.log(`  - id (clé primaire super_bonuses): ${visionDivineInSuperBonuses.id}`);
    console.log(`  - bonus_id (identifiant métier): ${visionDivineInSuperBonuses.bonus_id || 'NULL'}`);
    console.log(`  - name: ${visionDivineInSuperBonuses.name}`);
    console.log(`  - icon: ${visionDivineInSuperBonuses.icon}`);
    console.log(`  - duration_type: ${visionDivineInSuperBonuses.duration_type}`);
    console.log(`  - duration_value: ${visionDivineInSuperBonuses.duration_value}`);
    console.log(`  - activation_mode: ${visionDivineInSuperBonuses.activation_mode}\n`);

    // 2. Récupérer toutes les entrées dans player_active_bonuses qui pointent vers Vision Divine
    const visionDivineInPlayerActiveBonuses = await db.query(
      `SELECT pab.*, sb.name
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.bonus_id = $1
       AND pab.guild_id = $2
       ORDER BY pab.id`,
      [visionDivineInSuperBonuses.id, guildId]
    );

    console.log(`📋 Entrées dans player_active_bonuses (bonus_id = ${visionDivineInSuperBonuses.id}):`);
    console.log(`   Nombre d'entrées: ${visionDivineInPlayerActiveBonuses.length}\n`);

    if (visionDivineInPlayerActiveBonuses.length === 0) {
      console.log('   ❌ Aucune entrée trouvée\n');
    } else {
      visionDivineInPlayerActiveBonuses.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID: ${entry.id} | User: ${entry.user_id} | Charges: ${entry.remaining_charges} | Actif: ${entry.is_active ? '✅' : '❌'}`);
      });
      console.log('');
    }

    // 3. Récupérer TOUTES les entrées du joueur (pour voir s'il y a d'autres bonus)
    const allPlayerBonuses = await db.query(
      `SELECT pab.id, pab.bonus_id, pab.remaining_charges, pab.is_active, sb.name, sb.icon
       FROM player_active_bonuses pab
       LEFT JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.user_id = $1 AND pab.guild_id = $2
       ORDER BY pab.id`,
      [userId, guildId]
    );

    console.log(`📋 Tous les bonus de CharlotteGND:`);
    console.log(`   Nombre total: ${allPlayerBonuses.length}\n`);

    allPlayerBonuses.forEach((entry) => {
      console.log(`   ID: ${entry.id} | bonus_id: ${entry.bonus_id} | ${entry.icon || '?'} ${entry.name || 'Inconnu'} | Charges: ${entry.remaining_charges || 'N/A'} | Actif: ${entry.is_active ? '✅' : '❌'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 ANALYSE:');
    console.log(`   Vision Divine dans super_bonuses a l'ID: ${visionDivineInSuperBonuses.id}`);
    console.log(`   Le cumul devrait chercher: bonus_id = ${visionDivineInSuperBonuses.id}`);
    console.log(`   Entrées trouvées avec ce bonus_id: ${visionDivineInPlayerActiveBonuses.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkVisionDivineMapping();
