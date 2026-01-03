const fs = require('fs');
const content = fs.readFileSync('./utils/database-pg.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('createMissionProgress') || line.includes('MissionProgress')) {
    console.log(`${i + 1}: ${line.trim().substring(0, 100)}`);
  }
});
