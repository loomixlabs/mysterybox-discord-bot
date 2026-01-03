/**
 * Ajouter le système d'annonce pour le MysteryBox Joker
 * - Colonne dans announcement_settings
 * - Template dans announcement_templates
 */
const db = require('../utils/database-pg');

async function addJokerAnnouncement() {
  console.log('🃏 AJOUT SYSTÈME D\'ANNONCE JOKER\n');
  console.log('='.repeat(60));

  try {
    // 1. Vérifier si la colonne existe déjà
    console.log('\n📋 1. Vérification colonne announcement_settings');
    const columnExists = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      AND column_name = 'super_bonus_joker_used'
    `);

    if (columnExists) {
      console.log('   ✅ Colonne super_bonus_joker_used existe déjà');
    } else {
      console.log('   📝 Ajout de la colonne...');
      await db.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN IF NOT EXISTS super_bonus_joker_used BOOLEAN DEFAULT TRUE
      `);
      console.log('   ✅ Colonne ajoutée');
    }

    // 2. Récupérer tous les guilds pour ajouter les templates
    console.log('\n📋 2. Récupération des guilds');
    const guilds = await db.queryAll(`SELECT DISTINCT guild_id FROM themes`);
    console.log(`   ${guilds.length} guild(s) trouvé(s)`);

    // 3. Ajouter le template pour chaque guild
    console.log('\n📋 3. Ajout des templates');

    for (const guild of guilds) {
      // Vérifier si le template existe déjà
      const templateExists = await db.queryOne(`
        SELECT id FROM announcement_templates
        WHERE guild_id = $1 AND type = 'super_bonus_joker_used'
      `, [guild.guild_id]);

      if (templateExists) {
        console.log(`   ⏭️  Guild ${guild.guild_id}: Template existe déjà`);
        continue;
      }

      // Créer le template
      await db.query(`
        INSERT INTO announcement_templates (
          guild_id, type, title, description, color, footer_text
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        guild.guild_id,
        'super_bonus_joker_used',
        '🃏✨ MYSTERYBOX JOKER UTILISÉ ✨🃏',
        `╔═══════════════════════════════════╗
║  🎰 **BONUS LÉGENDAIRE ACTIVÉ** 🎰  ║
╚═══════════════════════════════════╝

**{userName}** a utilisé son **MysteryBox Joker** !

🎁 Collectible choisi:
╭─────────────────────────╮
│  ✨ **{collectibleName}**
│  📊 Rareté: **{collectibleRarity}**
╰─────────────────────────╯

*Le pouvoir du Joker a été consommé !*`,
        '#FFD700',
        '🃏 MysteryBox Joker • Bonus Légendaire'
      ]);

      console.log(`   ✅ Guild ${guild.guild_id}: Template créé`);
    }

    // 4. Vérification finale
    console.log('\n📋 4. Vérification finale');
    const count = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM announcement_templates
      WHERE type = 'super_bonus_joker_used'
    `);
    console.log(`   ${count.count} template(s) joker créé(s)`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Système d\'annonce Joker configuré !');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

addJokerAnnouncement();
