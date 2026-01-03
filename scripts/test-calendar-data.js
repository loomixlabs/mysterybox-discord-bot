require('dotenv').config();
const db = require('../utils/database-pg');

async function test() {
  const guildId = '297309737135898624';

  // 1. Récupérer le thème actif
  const theme = await db.getActiveTheme(guildId);
  console.log('Theme actif:', theme?.name, '(ID:', theme?.id, ')');

  // 2. Récupérer un joueur (xmicordix)
  const player = await db.getPlayerByDiscordId(guildId, '297307186307006464');
  console.log('Player:', player?.id, player?.username);

  if (!player || !theme) {
    console.log('❌ Player ou theme manquant');
    process.exit(1);
  }

  // 3. Tester getClaimedDays
  console.log('\n=== getClaimedDays ===');
  const claimed = await db.getClaimedDays(guildId, player.id, theme.id);
  console.log('Claimed days:', claimed);

  // 4. Tester getMissedDays
  console.log('\n=== getMissedDays ===');
  const missed = await db.getMissedDays(guildId, player.id, theme.id);
  console.log('Missed days:', missed);

  // 5. Tester getCaughtUpDays
  console.log('\n=== getCaughtUpDays ===');
  const caughtUp = await db.getCaughtUpDays(guildId, player.id, theme.id);
  console.log('CaughtUp days:', caughtUp);

  // 6. Vérifier daily_claim_logs
  console.log('\n=== daily_claim_logs (raw) ===');
  const logs = await db.queryAll(`
    SELECT * FROM daily_claim_logs
    WHERE guild_id = $1 AND player_id = $2
    ORDER BY claimed_at DESC LIMIT 5
  `, [guildId, player.id]);
  console.table(logs);

  // 7. Vérifier getDailyClaimInfoByTheme
  console.log('\n=== getDailyClaimInfoByTheme ===');
  const claimInfo = await db.getDailyClaimInfoByTheme(guildId, player.id, theme.id);
  console.log('ClaimInfo:', claimInfo);

  // 8. Vérifier themeDaysPassed
  console.log('\n=== Theme activation ===');
  console.log('Theme activated_at:', theme.activated_at);
  const now = new Date();
  const activatedAt = new Date(theme.activated_at);
  const daysPassed = Math.floor((now - activatedAt) / (1000 * 60 * 60 * 24)) + 1;
  console.log('Days passed since activation:', daysPassed);

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
