require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeTrapSystem() {
  console.log('🔍 ANALYSE DU SYSTÈME DE PIÈGES\n');
  console.log('━'.repeat(80));

  try {
    // 1. Structure de la table traps
    console.log('📊 ÉTAPE 1: Structure de la table traps\n');
    const trapsStructure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes de la table traps:\n');
    trapsStructure.forEach(col => {
      console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 2: Liste de TOUS les pièges existants\n');

    // 2. Lister tous les pièges d'un thème actif
    const allTraps = await db.query(`
      SELECT t.id, t.name, t.type, t.guild_id, t.theme_id,
             t.cooldown_duration, t.removes_collectible, t.malus_points,
             t.description, t.created_at, t.is_default, t.is_active,
             th.name as theme_name
      FROM traps t
      LEFT JOIN themes th ON t.theme_id = th.id
      WHERE t.guild_id = $1
      ORDER BY t.theme_id, t.type
    `, [GUILD_ID]);

    console.log(`Total: ${allTraps.length} pièges\n`);

    // Grouper par type
    const trapsByType = {};
    allTraps.forEach(trap => {
      if (!trapsByType[trap.type]) {
        trapsByType[trap.type] = [];
      }
      trapsByType[trap.type].push(trap);
    });

    Object.keys(trapsByType).forEach(type => {
      console.log(`\n🎯 Type: ${type} (${trapsByType[type].length} pièges)`);
      trapsByType[type].forEach(trap => {
        console.log(`   [${trap.id}] ${trap.name} - Thème: ${trap.theme_name || 'N/A'}`);
        console.log(`       Cooldown: ${trap.cooldown_duration || 'N/A'} | Malus: ${trap.malus_points || 'N/A'} | Retire objet: ${trap.removes_collectible || 'N/A'}`);
        console.log(`       Description: ${trap.description || 'N/A'}`);
        console.log(`       Par défaut: ${trap.is_default} | Actif: ${trap.is_active}`);
      });
    });

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 3: Structure de la table announcement_templates\n');

    const announcementStructure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes de announcement_templates:\n');
    announcementStructure.forEach(col => {
      console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 4: Templates d\'annonces pour les pièges\n');

    const announcementTemplates = await db.query(`
      SELECT id, guild_id, type, title, description, color, image_url
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`Total: ${announcementTemplates.length} templates\n`);

    announcementTemplates.forEach((template, i) => {
      console.log(`\n[${i + 1}] Template ID: ${template.id}`);
      console.log(`    Type: ${template.type}`);
      console.log(`    Title: ${template.title}`);
      console.log(`    Description: ${template.description.substring(0, 100)}...`);
      console.log(`    Color: ${template.color || 'N/A'}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 5: Contraintes CHECK sur la table traps\n');

    const trapConstraints = await db.query(`
      SELECT conname, consrc
      FROM pg_constraint
      WHERE conrelid = 'traps'::regclass
        AND contype = 'c'
    `);

    console.log('Contraintes CHECK:\n');
    trapConstraints.forEach(constraint => {
      console.log(`  - ${constraint.conname}`);
      console.log(`    ${constraint.consrc}\n`);
    });

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 6: Analyse d\'un piège existant (exemple: perte de collectible)\n');

    const loseItemTrap = await db.query(`
      SELECT * FROM traps
      WHERE guild_id = $1 AND type = 'lose_item'
      LIMIT 1
    `, [GUILD_ID]);

    if (loseItemTrap.length > 0) {
      const trap = loseItemTrap[0];
      console.log('Exemple de piège "perte de collectible":\n');
      Object.keys(trap).forEach(key => {
        console.log(`  ${key.padEnd(20)}: ${trap[key]}`);
      });
    }

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 7: Variables disponibles dans les templates\n');

    const variablesDoc = `
Variables disponibles pour les annonces de pièges:
  {player}        - Nom du joueur
  {trap_name}     - Nom du piège
  {trap_type}     - Type du piège
  {penalty}       - Valeur de la pénalité
  {item_name}     - Nom du collectible (pour lose_item)
  {duration}      - Durée (pour curse, cooldown)
  {points}        - Points perdus (pour points_loss)
`;

    console.log(variablesDoc);

    console.log('\n' + '━'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeTrapSystem();
