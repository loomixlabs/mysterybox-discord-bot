require('dotenv').config();
const db = require('../../utils/database-pg');

const GUILD_ID = '1248028543389143070';

/**
 * MIGRATION: Ajouter le nouveau piège "Perdre TOUS les collectibles"
 *
 * Ce script va:
 * 1. Ajouter le piège générique à tous les thèmes existants
 * 2. Personnaliser le piège pour le thème Blanche-Neige
 * 3. Créer le template d'annonce par défaut
 */

// Piège générique (pour tous les thèmes)
const GENERIC_TRAP = {
  trap_id: 'trap-lose-all-collectibles',
  name: 'Piège Dévastateur',
  type: 'lose-all-collectibles',
  description: 'Un piège catastrophique qui fait perdre TOUS vos collectibles d\'un seul coup.',
  image_url: 'https://i.imgur.com/placeholder-trap-devastator.png',
  cooldown_duration: 0,
  malus_points: 0,
  shame_message: '💥 {user} a déclenché le piège dévastateur ! Tous ses collectibles ont disparu... ({count} objets perdus)',
  removes_collectible: true,
  notif_title: '💥 PIÈGE DÉVASTATEUR !',
  notif_description: '**CATASTROPHE TOTALE !** Ce piège apocalyptique a effacé **TOUS TES COLLECTIBLES** !\n\n💔 **{count} objet(s) perdu(s)** d\'un seul coup...\n\n⚠️ Ta collection a été complètement anéantie. Il va falloir tout recommencer !',
  notif_color: '#8b0000',
  notif_footer: 'Tout a disparu... 💔'
};

// Piège personnalisé pour Blanche-Neige
const BLANCHE_NEIGE_TRAP = {
  trap_id: 'trap-lose-all-collectibles',
  name: 'Le Sortilège Ultime de la Reine',
  type: 'lose-all-collectibles',
  description: 'La Reine, folle de jalousie, lance son sortilège le plus puissant. Un éclair noir frappe ta collection et tout disparaît dans l\'obscurité...',
  image_url: 'https://i.imgur.com/placeholder-trap-queen-ultimate.png',
  cooldown_duration: 0,
  malus_points: 0,
  shame_message: '👑⚡ {user} a subi le Sortilège Ultime de la Reine ! Par jalousie, elle a effacé TOUTE sa collection... ({count} objets anéantis)',
  removes_collectible: true,
  notif_title: '👑⚡ SORTILÈGE ULTIME !',
  notif_description: '**LA REINE A TOUT DÉTRUIT !**\n\nFurieuse de voir ta magnifique collection, la méchante Reine a lancé son sortilège le plus sombre.\n\n⚡ **Un éclair noir frappe tes trésors...**\n\n💔 **TOUS tes collectibles ont disparu !** ({count} objet(s) anéanti(s))\n\n👑 *"Miroir, miroir, qui est la plus belle maintenant ?"* ricane la Reine.\n\n⚠️ Il va falloir tout recommencer depuis le début...',
  notif_color: '#4b0082',
  notif_footer: 'La jalousie de la Reine ne connaît pas de limites... 👑⚡'
};

// Template d'annonce par défaut
const ANNOUNCEMENT_TEMPLATE = {
  type: 'trap_lose_all_collectibles',
  title: '💥 Piège Dévastateur Activé !',
  description: '**{userName}** a déclenché le piège le plus catastrophique !\n\n💔 **Tous ses collectibles ont disparu** ({count} objets perdus)\n\n⚠️ Un véritable désastre...',
  color: '#8b0000',
  image_url: null,
  footer_text: 'Système de Pièges'
};

async function addLoseAllTrap() {
  console.log('🔧 MIGRATION: Ajout du nouveau piège "Perdre TOUS les collectibles"\n');
  console.log('━'.repeat(80));

  try {
    // 1. Récupérer tous les thèmes existants
    console.log('\n📊 ÉTAPE 1: Récupération des thèmes existants\n');

    const themes = await db.query(`
      SELECT id, name FROM themes WHERE guild_id = $1
    `, [GUILD_ID]);

    console.log(`   ✅ ${themes.length} thème(s) trouvé(s)`);
    themes.forEach(theme => {
      console.log(`      - [${theme.id}] ${theme.name}`);
    });

    // 2. Vérifier quel thème est "Blanche-Neige"
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 2: Identification du thème Blanche-Neige\n');

    const blancheNeigeTheme = themes.find(t =>
      t.name.toLowerCase().includes('blanche') ||
      t.name.toLowerCase().includes('neige')
    );

    if (blancheNeigeTheme) {
      console.log(`   ✅ Thème Blanche-Neige trouvé: [${blancheNeigeTheme.id}] ${blancheNeigeTheme.name}`);
    } else {
      console.log('   ⚠️  Thème Blanche-Neige non trouvé (tous les thèmes auront le piège générique)');
    }

    // 3. Ajouter le piège à chaque thème
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 3: Ajout du piège à chaque thème\n');

    for (const theme of themes) {
      // Vérifier si le piège existe déjà
      const existing = await db.queryOne(`
        SELECT id FROM traps
        WHERE guild_id = $1 AND theme_id = $2 AND trap_id = $3
      `, [GUILD_ID, theme.id, 'trap-lose-all-collectibles']);

      if (existing) {
        console.log(`   ⏭️  [${theme.id}] ${theme.name}: Piège déjà existant (skip)`);
        continue;
      }

      // Choisir le bon piège (personnalisé pour Blanche-Neige, générique pour les autres)
      const trap = (blancheNeigeTheme && theme.id === blancheNeigeTheme.id)
        ? BLANCHE_NEIGE_TRAP
        : GENERIC_TRAP;

      // Insérer le piège
      await db.query(`
        INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, description, image_url,
          cooldown_duration, malus_points, shame_message, removes_collectible,
          is_default, is_active, notif_title, notif_description, notif_color, notif_footer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        GUILD_ID,
        theme.id,
        trap.trap_id,
        trap.name,
        trap.type,
        trap.description,
        trap.image_url,
        trap.cooldown_duration,
        trap.malus_points,
        trap.shame_message,
        trap.removes_collectible,
        true, // is_default
        true, // is_active
        trap.notif_title,
        trap.notif_description,
        trap.notif_color,
        trap.notif_footer
      ]);

      const trapType = (blancheNeigeTheme && theme.id === blancheNeigeTheme.id)
        ? '🎭 PERSONNALISÉ'
        : '📦 GÉNÉRIQUE';

      console.log(`   ✅ [${theme.id}] ${theme.name}: ${trapType} - "${trap.name}"`);
    }

    // 4. Créer le template d'annonce
    console.log('\n━'.repeat(80));
    console.log('\n📊 ÉTAPE 4: Création du template d\'annonce\n');

    const existingTemplate = await db.queryOne(`
      SELECT id FROM announcement_templates
      WHERE guild_id = $1 AND type = $2
    `, [GUILD_ID, ANNOUNCEMENT_TEMPLATE.type]);

    if (existingTemplate) {
      console.log('   ⏭️  Template d\'annonce déjà existant (skip)');
    } else {
      await db.query(`
        INSERT INTO announcement_templates (
          guild_id, type, title, description, color, image_url, footer_text
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        GUILD_ID,
        ANNOUNCEMENT_TEMPLATE.type,
        ANNOUNCEMENT_TEMPLATE.title,
        ANNOUNCEMENT_TEMPLATE.description,
        ANNOUNCEMENT_TEMPLATE.color,
        ANNOUNCEMENT_TEMPLATE.image_url,
        ANNOUNCEMENT_TEMPLATE.footer_text
      ]);

      console.log('   ✅ Template d\'annonce créé');
    }

    // 5. Résumé final
    console.log('\n━'.repeat(80));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS !\n');
    console.log('Résumé:');
    console.log(`   - ${themes.length} thème(s) traité(s)`);
    console.log(`   - Piège générique ajouté aux thèmes standards`);
    if (blancheNeigeTheme) {
      console.log(`   - Piège personnalisé "${BLANCHE_NEIGE_TRAP.name}" pour Blanche-Neige`);
    }
    console.log(`   - Template d'annonce créé`);
    console.log('\n━'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERREUR lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

addLoseAllTrap();
