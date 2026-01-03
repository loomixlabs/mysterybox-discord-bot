const db = require('../utils/database-pg');

async function checkVisionDivineEntries() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🔍 VÉRIFICATION DES ENTRÉES VISION DIVINE\n');
    console.log('='.repeat(80));

    // Récupérer l'ID de Vision Divine
    const visionDivine = await db.queryOne(
      `SELECT id, name FROM super_bonuses WHERE name = 'Vision Divine' AND guild_id = $1`,
      [guildId]
    );

    if (!visionDivine) {
      console.log('❌ Vision Divine introuvable dans super_bonuses\n');
      process.exit(1);
    }

    console.log(`✅ Vision Divine trouvé (ID: ${visionDivine.id})\n`);

    // Récupérer TOUTES les entrées de Vision Divine (même inactives)
    const allEntries = await db.query(
      `SELECT
        pab.id,
        pab.user_id,
        pab.guild_id,
        pab.bonus_id,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active,
        pab.obtained_from
       FROM player_active_bonuses pab
       WHERE pab.user_id = $1
       AND pab.guild_id = $2
       AND pab.bonus_id = $3
       ORDER BY pab.id DESC`,
      [userId, guildId, visionDivine.id]
    );

    console.log(`📊 Nombre total d'entrées pour Vision Divine: ${allEntries.length}\n`);

    if (allEntries.length === 0) {
      console.log('❌ Aucune entrée trouvée\n');
      process.exit(0);
    }

    console.log('📋 DÉTAILS DES ENTRÉES:\n');
    console.log('-'.repeat(80));

    allEntries.forEach((entry, index) => {
      console.log(`\nEntrée ${index + 1}:`);
      console.log(`  ID: ${entry.id}`);
      console.log(`  Charges restantes: ${entry.remaining_charges}`);
      console.log(`  Activé le: ${entry.activated_at ? new Date(entry.activated_at).toLocaleString('fr-FR') : 'NON ACTIVÉ'}`);
      console.log(`  Expire le: ${entry.expires_at ? new Date(entry.expires_at).toLocaleString('fr-FR') : 'JAMAIS'}`);
      console.log(`  Actif: ${entry.is_active ? '✅ OUI' : '❌ NON'}`);
      console.log(`  Obtenu via: ${entry.obtained_from}`);
    });

    console.log('\n' + '='.repeat(80));

    // Vérifier s'il y a des doublons actifs
    const activeEntries = allEntries.filter(e => e.is_active);
    if (activeEntries.length > 1) {
      console.log(`\n⚠️  PROBLÈME DÉTECTÉ: ${activeEntries.length} entrées actives (devrait être 1 ou 0)`);
      console.log('   → Le système a créé plusieurs entrées au lieu de cumuler\n');
    } else if (activeEntries.length === 1) {
      console.log(`\n✅ Situation normale: 1 entrée active`);
      console.log(`   Charges: ${activeEntries[0].remaining_charges}`);
      console.log(`   Devrait être: 2 (si cumul a fonctionné)\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkVisionDivineEntries();
