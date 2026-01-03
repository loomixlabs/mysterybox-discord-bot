const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

const TEST_GUILD_ID = '297309737135898624'; // Serveur de test
const PROD_GUILD_ID = '1248028543389143070'; // Serveur de production

async function analyzeSystemeCooldowns() {
  console.log('🔍 ANALYSE COMPLÈTE: SYSTÈME DE COOLDOWNS\n');
  console.log('═'.repeat(120));
  console.log('\n📋 OBJECTIF: Comprendre le système de cooldowns pour implémenter l\'Accélérateur Cooldown\n');

  try {
    // ============================================================================
    // PARTIE 1: PIÈGES AVEC COOLDOWNS (Système à Contrer)
    // ============================================================================
    console.log('\n' + '═'.repeat(120));
    console.log('🎯 PARTIE 1: PIÈGES AVEC COOLDOWN (Système à Contrer)');
    console.log('═'.repeat(120));

    console.log('\n📊 1.1 - Pièges par thème avec cooldown_duration:');
    console.log('─'.repeat(120));

    const trapsWithCooldown = await pool.query(`
      SELECT
        th.guild_id,
        th.name as theme_name,
        th.is_active as theme_actif,
        t.id as trap_id,
        t.name as trap_name,
        t.type as trap_type,
        t.cooldown_duration,
        t.description
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id IN ($1, $2)
        AND t.cooldown_duration > 0
      ORDER BY th.guild_id, th.is_active DESC, t.cooldown_duration DESC
    `, [TEST_GUILD_ID, PROD_GUILD_ID]);

    if (trapsWithCooldown.rows.length === 0) {
      console.log('⚠️  AUCUN PIÈGE avec cooldown_duration > 0 trouvé !');
      console.log('   → Le système de cooldown de pièges n\'est peut-être pas encore implémenté');
    } else {
      console.table(trapsWithCooldown.rows);
      console.log(`\n✅ ${trapsWithCooldown.rows.length} piège(s) avec cooldown trouvé(s)`);

      // Statistiques
      const maxCooldown = Math.max(...trapsWithCooldown.rows.map(t => t.cooldown_duration));
      const minCooldown = Math.min(...trapsWithCooldown.rows.map(t => t.cooldown_duration));
      const avgCooldown = trapsWithCooldown.rows.reduce((sum, t) => sum + t.cooldown_duration, 0) / trapsWithCooldown.rows.length;

      console.log('\n📊 Statistiques cooldowns pièges:');
      console.log(`   • Cooldown minimum: ${minCooldown} minutes`);
      console.log(`   • Cooldown maximum: ${maxCooldown} minutes`);
      console.log(`   • Cooldown moyen: ${Math.round(avgCooldown)} minutes`);
    }

    console.log('\n📊 1.2 - Cooldowns actifs de pièges (trap_triggered):');
    console.log('─'.repeat(120));

    const activeTrapCooldowns = await pool.query(`
      SELECT
        tt.guild_id,
        p.username,
        t.name as trap_name,
        t.cooldown_duration as cooldown_minutes,
        tt.triggered_at,
        tt.triggered_at + (t.cooldown_duration || ' minutes')::interval as cooldown_fin,
        EXTRACT(EPOCH FROM (
          tt.triggered_at + (t.cooldown_duration || ' minutes')::interval - NOW()
        )) / 60 as minutes_restantes
      FROM trap_triggered tt
      JOIN traps t ON tt.trap_id = t.id
      JOIN players p ON tt.player_id = p.id
      WHERE tt.guild_id IN ($1, $2)
        AND t.cooldown_duration > 0
        AND tt.triggered_at + (t.cooldown_duration || ' minutes')::interval > NOW()
      ORDER BY tt.triggered_at DESC
      LIMIT 20
    `, [TEST_GUILD_ID, PROD_GUILD_ID]);

    if (activeTrapCooldowns.rows.length === 0) {
      console.log('ℹ️  Aucun cooldown de piège actif actuellement');
    } else {
      console.table(activeTrapCooldowns.rows);
      console.log(`\n⏱️  ${activeTrapCooldowns.rows.length} cooldown(s) de piège actif(s)`);
    }

    // ============================================================================
    // PARTIE 2: TABLE player_cooldowns (Autre Système de Cooldowns)
    // ============================================================================
    console.log('\n' + '═'.repeat(120));
    console.log('🎯 PARTIE 2: TABLE player_cooldowns (Système Séparé)');
    console.log('═'.repeat(120));

    console.log('\n📋 2.1 - Structure player_cooldowns:');
    console.log('─'.repeat(120));

    const cooldownStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);

    console.table(cooldownStructure.rows);

    console.log('\n⚠️  OBSERVATION: La table player_cooldowns a une colonne "trap_id"');
    console.log('   → Besoin de comprendre la différence avec trap_triggered');

    console.log('\n📊 2.2 - Cooldowns actifs dans player_cooldowns:');
    console.log('─'.repeat(120));

    const playerCooldowns = await pool.query(`
      SELECT
        pc.guild_id,
        p.username,
        t.name as trap_name,
        pc.started_at,
        pc.expires_at,
        pc.is_active,
        EXTRACT(EPOCH FROM (pc.expires_at - NOW())) / 60 as minutes_restantes
      FROM player_cooldowns pc
      LEFT JOIN players p ON pc.player_id = p.id
      LEFT JOIN traps t ON pc.trap_id = t.id
      WHERE pc.guild_id IN ($1, $2)
        AND pc.expires_at > NOW()
      ORDER BY pc.expires_at ASC
      LIMIT 20
    `, [TEST_GUILD_ID, PROD_GUILD_ID]);

    if (playerCooldowns.rows.length === 0) {
      console.log('ℹ️  Aucun cooldown actif dans player_cooldowns');
    } else {
      console.table(playerCooldowns.rows);
      console.log(`\n⏱️  ${playerCooldowns.rows.length} cooldown(s) actif(s)`);
    }

    // Comparaison des deux systèmes
    console.log('\n💡 ANALYSE: Deux systèmes de cooldowns');
    console.log('─'.repeat(120));
    console.log(`
   1️⃣ TRAP_TRIGGERED (cooldowns de pièges):
      • Table: trap_triggered
      • Durée: calculée depuis triggered_at + cooldown_duration (minutes)
      • Actifs actuellement: ${activeTrapCooldowns.rows.length}
      • Usage: Empêcher ouverture mystery box après avoir déclenché un piège

   2️⃣ PLAYER_COOLDOWNS (cooldowns généraux):
      • Table: player_cooldowns
      • Durée: expires_at fixe
      • Actifs actuellement: ${playerCooldowns.rows.length}
      • Usage: À déterminer (trap_id présent mais peut servir à autre chose)

   ❓ QUESTION CRITIQUE:
      → L'Accélérateur Cooldown doit réduire QUEL système ?
      → Les deux ?
      → Uniquement trap_triggered ?
      → Uniquement player_cooldowns ?
`);

    // ============================================================================
    // PARTIE 3: ACCÉLÉRATEUR COOLDOWN - Configuration Actuelle
    // ============================================================================
    console.log('\n' + '═'.repeat(120));
    console.log('🎯 PARTIE 3: ACCÉLÉRATEUR COOLDOWN - Configuration');
    console.log('═'.repeat(120));

    const accelerateur = await pool.query(`
      SELECT
        id,
        guild_id,
        name,
        description,
        effect_type,
        effect_config,
        duration_type,
        duration_value,
        activation_mode,
        is_enabled,
        rarity
      FROM super_bonuses
      WHERE name LIKE '%Accélérateur%'
      ORDER BY guild_id, id
    `);

    console.log('\n📊 Configuration Accélérateur Cooldown:');
    console.log('─'.repeat(120));

    if (accelerateur.rows.length === 0) {
      console.log('❌ ERREUR: Aucun Accélérateur Cooldown trouvé dans super_bonuses');
    } else {
      console.table(accelerateur.rows);

      accelerateur.rows.forEach(bonus => {
        console.log(`\n📝 Détail bonus ID ${bonus.id} (${bonus.guild_id}):`);
        console.log(`   • Nom: ${bonus.name}`);
        console.log(`   • Type d'effet: ${bonus.effect_type}`);
        console.log(`   • Mode activation: ${bonus.activation_mode}`);
        console.log(`   • Activé: ${bonus.is_enabled ? '✅' : '❌'}`);
        console.log(`   • Rareté: ${bonus.rarity}`);
        console.log(`   • Durée: ${bonus.duration_type} (${bonus.duration_value})`);

        if (bonus.effect_config) {
          console.log(`   • Configuration:`);
          console.log(JSON.stringify(bonus.effect_config, null, 6));
        } else {
          console.log(`   ⚠️  effect_config: NULL (pas de configuration définie)`);
        }
      });
    }

    // ============================================================================
    // PARTIE 4: RECOMMANDATIONS D'IMPLÉMENTATION
    // ============================================================================
    console.log('\n' + '═'.repeat(120));
    console.log('💡 PARTIE 4: RECOMMANDATIONS D\'IMPLÉMENTATION');
    console.log('═'.repeat(120));

    console.log(`
📋 OPTION 1: Accélérateur pour TRAP_TRIGGERED uniquement
   ────────────────────────────────────────────────────
   ✅ Cas d'usage: Joueur déclenche piège → Cooldown 2h → Avec accélérateur: 1h

   Implémentation:
   • handlers/mysteryBoxHandler.js: Vérifier bonus avant d'interdire ouverture
   • Lors de vérification cooldown piège, appliquer -50% si bonus actif
   • Message: "⏱️ Cooldown restant: 1h (⚡ -50% grâce à l'Accélérateur)"

   Avantages:
   • Cas d'usage clair et utile
   • Encourage usage mystery boxes (moins de frustration)
   • Facile à implémenter (1 seul point de vérification)

   Inconvénients:
   • Limité aux pièges uniquement


📋 OPTION 2: Accélérateur pour PLAYER_COOLDOWNS
   ──────────────────────────────────────────────
   ⚠️  Usage actuel de player_cooldowns pas clair

   Si utilisé pour:
   • Cooldowns de missions → Réduire de 50%
   • Cooldowns divers → Réduire de 50%

   Implémentation:
   • utils/database-pg.js: Modifier addCooldown() pour détecter bonus actif
   • Réduire expires_at de 50% si bonus détecté

   Avantages:
   • Système centralisé
   • S'applique à tous les cooldowns du système

   Inconvénients:
   • Besoin de modifier méthode critique (risque de bugs)


📋 OPTION 3: Accélérateur UNIVERSEL (Les Deux Systèmes)
   ────────────────────────────────────────────────────────
   ✅ Application large: Pièges + Missions + Tous cooldowns

   Implémentation:
   1. Vérifier bonus dans trap_triggered (handler mystery box)
   2. Modifier addCooldown() pour player_cooldowns

   Avantages:
   • Bonus très puissant et désirable
   • Valeur perçue maximale
   • Cohérence: "accélérateur" = accélère TOUT

   Inconvénients:
   • Plus complexe (2 points d'implémentation)
   • Temps d'implémentation: 6-8h au lieu de 4h


🎯 RECOMMANDATION FINALE:
   ────────────────────────
   • Phase 1 MVP: OPTION 1 (Trap cooldowns uniquement) - 4h
   • Phase 2 Extension: Ajouter player_cooldowns - +2h

   Raison:
   • Option 1 a un cas d'usage immédiat et clair
   • Facile à tester et valider
   • Peut être étendu plus tard sans breaking changes
`);

    // ============================================================================
    // PARTIE 5: PLAN D'IMPLÉMENTATION DÉTAILLÉ
    // ============================================================================
    console.log('\n' + '═'.repeat(120));
    console.log('📝 PARTIE 5: PLAN D\'IMPLÉMENTATION DÉTAILLÉ (Option 1 MVP)');
    console.log('═'.repeat(120));

    console.log(`
🔧 PHASE 1: Fonction de Vérification (1h)
   ────────────────────────────────────────
   Fichier: handlers/superBonusHandler.js

   Fonction à créer:

   async function hasCooldownAccelerator(guildId, userId) {
     const bonuses = await getPlayerActiveBonuses(guildId, userId);
     return bonuses.some(b =>
       b.effect_type === 'cooldown' &&
       b.is_active === true &&
       (b.expires_at === null || new Date(b.expires_at) > new Date())
     );
   }

   Tests:
   • Joueur SANS bonus → retourne false
   • Joueur AVEC bonus actif → retourne true
   • Joueur AVEC bonus expiré → retourne false


🔧 PHASE 2: Intégration Mystery Box (2h)
   ─────────────────────────────────────────
   Fichier: handlers/mysteryBoxHandler.js

   Modifier: Fonction de vérification cooldown piège (ligne ~250-300)

   Avant:
   const cooldownRemaining = calculateRemainingCooldown(triggeredAt, cooldownDuration);
   if (cooldownRemaining > 0) {
     return interaction.reply({
       content: \`⏱️ Cooldown: \${formatDuration(cooldownRemaining)}\`,
       flags: 64
     });
   }

   Après:
   let cooldownRemaining = calculateRemainingCooldown(triggeredAt, cooldownDuration);

   // Vérifier Accélérateur Cooldown
   const hasAccelerator = await superBonusHandler.hasCooldownAccelerator(guildId, userId);
   if (hasAccelerator) {
     cooldownRemaining = Math.floor(cooldownRemaining * 0.5); // -50%
     console.log(\`⚡ Cooldown réduit de 50% grâce à l'Accélérateur\`);
   }

   if (cooldownRemaining > 0) {
     const message = hasAccelerator
       ? \`⏱️ Cooldown: \${formatDuration(cooldownRemaining)} ⚡ (-50%)\`
       : \`⏱️ Cooldown: \${formatDuration(cooldownRemaining)}\`;

     return interaction.reply({ content: message, flags: 64 });
   }

   Tests:
   • Sans bonus: Cooldown 2h affiché
   • Avec bonus: Cooldown 1h affiché avec ⚡
   • Avec bonus expiré: Cooldown 2h affiché


🔧 PHASE 3: Logging & Stats (1h)
   ───────────────────────────────
   Fichier: handlers/superBonusHandler.js

   Logger chaque réduction:
   await db.query(\`
     INSERT INTO bonus_usage_history (
       guild_id, user_id, bonus_id, used_at,
       effect_result, trigger_type
     )
     VALUES ($1, $2, $3, NOW(), $4, 'cooldown_reduction')
   \`, [
     guildId,
     userId,
     acceleratorBonusId,
     JSON.stringify({
       original_cooldown_minutes: originalCooldown,
       reduced_cooldown_minutes: reducedCooldown,
       time_saved_minutes: originalCooldown - reducedCooldown
     })
   ]);

   Affichage dans /profile:
   • Section "📊 Statistiques":
     → "Temps économisé grâce à l'Accélérateur: 120 minutes"


🔧 PHASE 4: Tests E2E (2h)
   ───────────────────────────
   Script: scripts/test-accelerateur-cooldown-e2e.js

   Scénarios:
   1. Joueur déclenche piège cooldown 2h
   2. Vérifier cooldown affiché = 2h
   3. Donner Accélérateur Cooldown au joueur
   4. Activer le bonus
   5. Vérifier cooldown affiché = 1h (⚡ -50%)
   6. Attendre expiration bonus
   7. Vérifier cooldown affiché redevient 2h
   8. Vérifier stats dans bonus_usage_history
   9. Vérifier affichage /profile


📊 TOTAL ESTIMATION: 6h
   ────────────────────────
   • Phase 1: 1h
   • Phase 2: 2h
   • Phase 3: 1h
   • Phase 4: 2h
`);

    console.log('\n' + '═'.repeat(120));
    console.log('✅ ANALYSE TERMINÉE - Prêt pour discussion et validation');
    console.log('═'.repeat(120) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

analyzeSystemeCooldowns();
