/**
 * Migration: Ajouter legendary_super_bonus aux templates d'annonces
 *
 * Actions:
 * 1. Ajouter colonne legendary_super_bonus à announcement_settings
 * 2. Supprimer colonnes obsolètes trap_curse et trap_malus_points
 * 3. Ajouter template legendary_super_bonus aux guilds existantes
 */
const db = require('../utils/database-pg');

const LEGENDARY_SUPER_BONUS_TEMPLATE = {
  type: 'legendary_super_bonus',
  title: '🎰 SUPER BONUS OBTENU !',
  description: '**{userName}** a obtenu un **SUPER BONUS** exceptionnel !\n\n{bonusIcon} **{bonusName}**\n\n🎉 Félicitations pour cette chance incroyable !',
  color: '#ff00ff',
  footer_text: 'Système de Super Bonus'
};

async function migrate() {
  try {
    console.log('🔧 MIGRATION: Ajout legendary_super_bonus\n');
    console.log('='.repeat(80));

    // 1. Ajouter colonne legendary_super_bonus à announcement_settings
    console.log('\n📋 1. Ajout de la colonne legendary_super_bonus à announcement_settings...\n');

    // Vérifier si la colonne existe déjà
    const columnExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND column_name = 'legendary_super_bonus'
    `);

    if (columnExists) {
      console.log('   ⏭️  Colonne legendary_super_bonus déjà existante');
    } else {
      await db.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN legendary_super_bonus BOOLEAN DEFAULT TRUE
      `);
      console.log('   ✅ Colonne legendary_super_bonus ajoutée');
    }

    // 2. Supprimer colonnes obsolètes
    console.log('\n📋 2. Suppression des colonnes obsolètes...\n');

    // Vérifier et supprimer trap_curse
    const trapCurseExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND column_name = 'trap_curse'
    `);
    if (trapCurseExists) {
      await db.query(`ALTER TABLE announcement_settings DROP COLUMN trap_curse`);
      console.log('   ✅ Colonne trap_curse supprimée');
    } else {
      console.log('   ⏭️  Colonne trap_curse n\'existe pas');
    }

    // Vérifier et supprimer trap_malus_points
    const trapMalusExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND column_name = 'trap_malus_points'
    `);
    if (trapMalusExists) {
      await db.query(`ALTER TABLE announcement_settings DROP COLUMN trap_malus_points`);
      console.log('   ✅ Colonne trap_malus_points supprimée');
    } else {
      console.log('   ⏭️  Colonne trap_malus_points n\'existe pas');
    }

    // 3. Ajouter template aux guilds existantes
    console.log('\n📋 3. Ajout du template legendary_super_bonus aux guilds...\n');

    // Récupérer toutes les guilds avec des templates
    const guilds = await db.queryAll(`
      SELECT DISTINCT guild_id FROM announcement_templates
    `);

    console.log(`   📊 ${guilds.length} guild(s) trouvée(s)`);

    let created = 0;
    for (const guild of guilds) {
      // Vérifier si le template existe déjà
      const exists = await db.queryOne(`
        SELECT type FROM announcement_templates
        WHERE guild_id = $1 AND type = $2
      `, [guild.guild_id, LEGENDARY_SUPER_BONUS_TEMPLATE.type]);

      if (exists) {
        console.log(`   ⏭️  Guild ${guild.guild_id}: template déjà existant`);
      } else {
        await db.query(`
          INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          guild.guild_id,
          LEGENDARY_SUPER_BONUS_TEMPLATE.type,
          LEGENDARY_SUPER_BONUS_TEMPLATE.title,
          LEGENDARY_SUPER_BONUS_TEMPLATE.description,
          LEGENDARY_SUPER_BONUS_TEMPLATE.color,
          LEGENDARY_SUPER_BONUS_TEMPLATE.footer_text
        ]);
        created++;
        console.log(`   ✅ Guild ${guild.guild_id}: template créé`);
      }
    }

    // 4. Vérification finale
    console.log('\n📋 4. Vérification finale...\n');

    const columns = await db.queryAll(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND data_type = 'boolean'
      ORDER BY column_name
    `);
    console.log(`   Colonnes toggles: ${columns.length}`);
    console.log(`   ${columns.map(c => c.column_name).join(', ')}`);

    const templateCount = await db.queryAll(`
      SELECT guild_id, COUNT(*) as count FROM announcement_templates
      GROUP BY guild_id ORDER BY guild_id
    `);
    console.log('\n   Templates par guild:');
    templateCount.forEach(t => console.log(`   - Guild ${t.guild_id}: ${t.count} templates`));

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ MIGRATION TERMINÉE`);
    console.log(`   - ${created} template(s) créé(s)`);
    console.log(`   - Colonne legendary_super_bonus ajoutée`);
    console.log(`   - Colonnes obsolètes supprimées`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

migrate();
