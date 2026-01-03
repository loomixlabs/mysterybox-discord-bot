/**
 * Vérifie la configuration du piège cooldown sur le VPS
 * pour le serveur 1248028543389143070 (Calendrier de Noël)
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_CONFIG = {
  host: '72.60.185.62',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(path.join(process.env.USERPROFILE, '.ssh', 'id_rsa_vps_hostinger'))
};

const GUILD_ID = '1248028543389143070';

async function checkTrapCooldownOnVPS() {
  console.log('🔍 Vérification du piège cooldown sur le VPS\n');
  console.log('='.repeat(80));
  console.log(`Serveur Discord: ${GUILD_ID}`);
  console.log('='.repeat(80));

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      console.log('\n✅ Connecté au VPS\n');

      // Script Node.js à exécuter sur le VPS
      const remoteScript = `
        const { Pool } = require('pg');
        const pool = new Pool({
          host: 'localhost',
          port: 5432,
          database: 'botdb',
          user: 'botuser',
          password: 'Discord2025IA@Bot'
        });

        async function check() {
          try {
            // 1. Vérifier le thème actif
            const themeResult = await pool.query(\`
              SELECT id, theme_id, name, is_active, duration_days
              FROM themes
              WHERE guild_id = '${GUILD_ID}' AND is_active = true
            \`);

            console.log('\\n📋 THÈME ACTIF:');
            console.log(JSON.stringify(themeResult.rows, null, 2));

            if (themeResult.rows.length === 0) {
              console.log('❌ Aucun thème actif trouvé');
              await pool.end();
              return;
            }

            const themeId = themeResult.rows[0].id;

            // 2. Vérifier les pièges de type cooldown
            const trapsResult = await pool.query(\`
              SELECT id, name, type, effect_type, effect_value, duration, description, rarity
              FROM traps
              WHERE guild_id = '${GUILD_ID}' AND theme_id = $1
              ORDER BY type, name
            \`, [themeId]);

            console.log('\\n⚠️ TOUS LES PIÈGES DU THÈME:');
            trapsResult.rows.forEach((trap, i) => {
              console.log(\`\\n--- Piège \${i + 1} ---\`);
              console.log(\`  ID: \${trap.id}\`);
              console.log(\`  Nom: \${trap.name}\`);
              console.log(\`  Type: \${trap.type}\`);
              console.log(\`  Effect Type: \${trap.effect_type}\`);
              console.log(\`  Effect Value: \${trap.effect_value}\`);
              console.log(\`  Duration: \${trap.duration}\`);
              console.log(\`  Rareté: \${trap.rarity}\`);
              console.log(\`  Description: \${trap.description}\`);
            });

            // 3. Focus sur les pièges cooldown
            const cooldownTraps = trapsResult.rows.filter(t =>
              t.type === 'cooldown' ||
              t.effect_type === 'cooldown' ||
              t.name.toLowerCase().includes('cooldown') ||
              t.name.toLowerCase().includes('gel') ||
              t.name.toLowerCase().includes('freeze')
            );

            console.log('\\n🧊 PIÈGES DE TYPE COOLDOWN:');
            if (cooldownTraps.length === 0) {
              console.log('Aucun piège cooldown trouvé');
            } else {
              cooldownTraps.forEach(trap => {
                console.log(\`\\n  🎯 \${trap.name}\`);
                console.log(\`     Type: \${trap.type}\`);
                console.log(\`     Effect Type: \${trap.effect_type}\`);
                console.log(\`     Duration (valeur stockée): \${trap.duration}\`);
                console.log(\`     Effect Value: \${trap.effect_value}\`);

                // Interprétation
                if (trap.duration) {
                  console.log(\`     ➡️ Si interprété en MINUTES: \${trap.duration} minutes\`);
                  console.log(\`     ➡️ Si interprété en HEURES: \${trap.duration} heures = \${trap.duration * 60} minutes\`);
                }
              });
            }

            // 4. Vérifier les cooldowns actifs des joueurs
            const activeCooldowns = await pool.query(\`
              SELECT pc.id, pc.player_id, pc.cooldown_type, pc.expires_at, pc.created_at,
                     p.username,
                     EXTRACT(EPOCH FROM (pc.expires_at - pc.created_at))/60 as duration_minutes,
                     EXTRACT(EPOCH FROM (pc.expires_at - NOW()))/60 as remaining_minutes
              FROM player_cooldowns pc
              JOIN players p ON pc.player_id = p.id
              WHERE pc.guild_id = '${GUILD_ID}'
                AND pc.expires_at > NOW()
              ORDER BY pc.expires_at DESC
              LIMIT 10
            \`);

            console.log('\\n⏰ COOLDOWNS ACTIFS DES JOUEURS:');
            if (activeCooldowns.rows.length === 0) {
              console.log('Aucun cooldown actif');
            } else {
              activeCooldowns.rows.forEach(cd => {
                console.log(\`\\n  👤 \${cd.username}\`);
                console.log(\`     Type: \${cd.cooldown_type}\`);
                console.log(\`     Créé: \${cd.created_at}\`);
                console.log(\`     Expire: \${cd.expires_at}\`);
                console.log(\`     Durée totale: \${Math.round(cd.duration_minutes)} minutes (\${Math.round(cd.duration_minutes/60 * 10)/10} heures)\`);
                console.log(\`     Temps restant: \${Math.round(cd.remaining_minutes)} minutes\`);
              });
            }

            // 5. Vérifier les pièges déclenchés récemment
            const triggeredTraps = await pool.query(\`
              SELECT tt.id, tt.trap_id, tt.triggered_at, tt.effect_applied,
                     t.name as trap_name, t.type, t.duration, t.effect_value,
                     p.username
              FROM trap_triggered tt
              JOIN traps t ON tt.trap_id = t.id
              JOIN players p ON tt.player_id = p.id
              WHERE tt.guild_id = '${GUILD_ID}'
              ORDER BY tt.triggered_at DESC
              LIMIT 10
            \`);

            console.log('\\n💥 PIÈGES DÉCLENCHÉS RÉCEMMENT:');
            if (triggeredTraps.rows.length === 0) {
              console.log('Aucun piège déclenché récemment');
            } else {
              triggeredTraps.rows.forEach(tt => {
                console.log(\`\\n  💥 \${tt.trap_name} → \${tt.username}\`);
                console.log(\`     Déclenché: \${tt.triggered_at}\`);
                console.log(\`     Type: \${tt.type}\`);
                console.log(\`     Duration config: \${tt.duration}\`);
                console.log(\`     Effect value: \${tt.effect_value}\`);
                console.log(\`     Effect applied: \${tt.effect_applied}\`);
              });
            }

            await pool.end();
            console.log('\\n✅ Vérification terminée');
          } catch (error) {
            console.error('❌ Erreur:', error.message);
            await pool.end();
          }
        }

        check();
      `;

      // Exécuter le script sur le VPS
      const command = `cd /root/bot-discord && node -e "${remoteScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('close', (code) => {
          console.log(output);
          if (errorOutput) {
            console.error('\n❌ Erreurs:', errorOutput);
          }
          conn.end();
          resolve();
        });

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      console.error('❌ Erreur de connexion SSH:', err.message);
      reject(err);
    });

    conn.connect(VPS_CONFIG);
  });
}

checkTrapCooldownOnVPS().catch(console.error);
