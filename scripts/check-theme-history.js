/**
 * Vérifier l'historique des modifications des thèmes
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function check() {
  console.log('═'.repeat(80));
  console.log('🔍 HISTORIQUE DES THÈMES');
  console.log('═'.repeat(80));

  // 1. Tous les thèmes du serveur avec updated_at
  console.log('\n📋 TOUS LES THÈMES DU SERVEUR:\n');
  const themes = await db.queryAll(`
    SELECT id, theme_id, name, is_active,
           created_at, updated_at
    FROM themes
    WHERE guild_id = $1
    ORDER BY id
  `, [GUILD_ID]);

  console.table(themes.map(t => ({
    id: t.id,
    theme_id: t.theme_id,
    name: t.name,
    is_active: t.is_active ? '✅' : '❌',
    created: t.created_at?.toISOString?.() || t.created_at,
    updated: t.updated_at?.toISOString?.() || t.updated_at
  })));

  // 2. Vérifier les logs d'audit
  console.log('\n📋 AUDIT LOGS RÉCENTS (dernières 20 actions sur themes):\n');
  try {
    const logs = await db.queryAll(`
      SELECT action, table_name, record_id, details, created_at
      FROM audit_logs
      WHERE guild_id = $1 AND table_name = 'themes'
      ORDER BY created_at DESC
      LIMIT 20
    `, [GUILD_ID]);

    if (logs.length > 0) {
      console.table(logs.map(l => ({
        action: l.action,
        record_id: l.record_id,
        details: (l.details || '').substring(0, 50),
        date: l.created_at
      })));
    } else {
      console.log('  Aucun log trouvé');
    }
  } catch (e) {
    console.log('  Table audit_logs non disponible:', e.message);
  }

  process.exit(0);
}

check().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
