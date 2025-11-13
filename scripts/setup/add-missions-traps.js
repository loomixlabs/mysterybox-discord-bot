const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));

console.log('📦 Ajout de missions et pièges de test...\n');

try {
  const theme = db.prepare('SELECT * FROM themes WHERE theme_id = ?').get('blanche-neige');

  if (!theme) {
    console.error('❌ Thème introuvable');
    process.exit(1);
  }

  console.log(`✅ Thème: ${theme.name}\n`);

  // ============================================
  // MISSIONS
  // ============================================

  console.log('📋 Ajout des missions...\n');

  const missions = [
    {
      mission_id: 'message-pomme',
      name: 'Message Magique',
      type: 'keyword-message',
      description: 'Poste un message contenant le mot "pomme" dans le salon général',
      validation_type: 'auto',
      validation_data: JSON.stringify({
        channel_id: process.env.ANNOUNCE_CHANNEL_ID || 'ANY',
        keyword: 'pomme'
      }),
      timeout: 10,
      image_url: 'https://i.imgur.com/pomme.png'
    },
    {
      mission_id: 'quiz-nains',
      name: 'Quiz des Nains',
      type: 'quiz',
      description: 'Question: Combien y a-t-il de nains dans Blanche-Neige ?\n\nRéponds avec un chiffre !',
      validation_type: 'auto',
      validation_data: JSON.stringify({
        question: 'Combien y a-t-il de nains dans Blanche-Neige ?',
        answer: '7'
      }),
      timeout: 5,
      image_url: 'https://i.imgur.com/quiz.png'
    }
  ];

  const insertMission = db.prepare(`
    INSERT INTO missions (
      theme_id, mission_id, name, type, description,
      validation_type, validation_data, timeout, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const mission of missions) {
    try {
      insertMission.run(
        theme.id,
        mission.mission_id,
        mission.name,
        mission.type,
        mission.description,
        mission.validation_type,
        mission.validation_data,
        mission.timeout,
        mission.image_url
      );
      console.log(`✅ Mission ajoutée: ${mission.name} (${mission.type})`);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        console.log(`⚠️  Déjà présente: ${mission.name}`);
      } else {
        throw err;
      }
    }
  }

  // ============================================
  // PIÈGES
  // ============================================

  console.log('\n💀 Ajout des pièges...\n');

  const traps = [
    {
      trap_id: 'cooldown-poison',
      name: 'Pomme Empoisonnée',
      type: 'cooldown',
      description: 'Tu as mordu dans la pomme empoisonnée ! Tu ne peux plus ouvrir de boîtes pendant 30 minutes.',
      image_url: 'https://i.imgur.com/pomme-poison.png',
      cooldown_duration: 30
    },
    {
      trap_id: 'shame-nain',
      name: 'La Honte du Nain Grincheux',
      type: 'public-shame',
      description: 'Grincheux va annoncer ta maladresse à tout le monde !',
      image_url: 'https://i.imgur.com/grincheux-trap.png',
      shame_message: '😈 <@{player}> est tombé dans le piège de Grincheux ! Quelle maladresse !',
      shame_channel_id: process.env.ANNOUNCE_CHANNEL_ID
    }
  ];

  const insertTrap = db.prepare(`
    INSERT INTO traps (
      theme_id, trap_id, name, type, description, image_url,
      cooldown_duration, shame_message, shame_channel_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const trap of traps) {
    try {
      insertTrap.run(
        theme.id,
        trap.trap_id,
        trap.name,
        trap.type,
        trap.description,
        trap.image_url,
        trap.cooldown_duration || null,
        trap.shame_message || null,
        trap.shame_channel_id || null
      );
      console.log(`✅ Piège ajouté: ${trap.name} (${trap.type})`);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        console.log(`⚠️  Déjà présent: ${trap.name}`);
      } else {
        throw err;
      }
    }
  }

  // ============================================
  // VÉRIFICATION
  // ============================================

  const missionCount = db.prepare('SELECT COUNT(*) as count FROM missions WHERE theme_id = ?').get(theme.id);
  const trapCount = db.prepare('SELECT COUNT(*) as count FROM traps WHERE theme_id = ?').get(theme.id);

  console.log('\n📊 Résumé:');
  console.log(`   - Missions: ${missionCount.count}`);
  console.log(`   - Pièges: ${trapCount.count}`);
  console.log('\n🎉 Terminé !\n');

  db.close();

} catch (error) {
  console.error('🔴 Erreur:', error);
  process.exit(1);
}
