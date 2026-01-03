const db = require('../utils/database-pg');
(async () => {
  const traps = await db.queryAll(
    `SELECT id, name, type, severity, notif_title, image_url
     FROM traps WHERE guild_id = $1 AND theme_id = 65
     ORDER BY type, name`,
    ['1182395170273099806']
  );
  console.log('\n🪤 PIÈGES HARRY POTTER (Theme ID: 65)\n');
  console.table(traps.map(t => ({
    ID: t.id,
    Nom: t.name,
    Type: t.type,
    Sévérité: t.severity,
    Notification: t.notif_title,
    Image: t.image_url ? '✅' : '⚠️ MANQUANTE'
  })));
  process.exit(0);
})();
