/**
 * Script de correction automatique pour campaignHandler.js
 * CRITICAL: Ajoute guild_id partout pour isoler les campagnes par serveur
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/campaignHandler.js');
let content = fs.readFileSync(filePath, 'utf8');
let modificationsCount = 0;

console.log('🔧 Correction de campaignHandler.js...\n');
console.log('⚠️  BUG CRITIQUE: getActiveCampaigns() charge TOUS les serveurs!\n');

// Liste des corrections à effectuer
const corrections = [
  // initActiveCampaigns() - CRITIQUE: Ajouter guild_id
  {
    find: /async initActiveCampaigns\(client\) \{/,
    replace: 'async initActiveCampaigns(client, guildId) {',
    description: 'Ajout paramètre guildId à initActiveCampaigns()'
  },

  // initActiveCampaigns() - ligne 23 (CRITIQUE)
  {
    find: /const campaigns = await db\.getActiveCampaigns\(\);/,
    replace: 'const campaigns = await db.getActiveCampaigns(guildId);',
    description: 'getActiveCampaigns avec guild_id (CRITIQUE)'
  },

  // initActiveCampaigns() - ligne 29
  {
    find: /await db\.completeCampaign\(campaign\.id\);/g,
    replace: 'await db.completeCampaign(campaign.guild_id, campaign.id);',
    description: 'completeCampaign avec guild_id'
  },

  // startBurstCampaign() - ligne 50
  {
    find: /await db\.markCampaignStarted\(campaign\.id\);/g,
    replace: 'await db.markCampaignStarted(campaign.guild_id, campaign.id);',
    description: 'markCampaignStarted avec guild_id'
  },

  // startBurstCampaign() - ligne 56, 111
  {
    find: /const updatedCampaign = await db\.getCampaignById\(campaign\.id\);/g,
    replace: 'const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);',
    description: 'getCampaignById avec guild_id'
  },

  // launchBox() - ligne 87 (mysteryBoxHandler)
  {
    find: /const message = await mysteryBoxHandler\.createMysteryBox\(channel, updatedCampaign\.theme_id\);/g,
    replace: 'const message = await mysteryBoxHandler.createMysteryBox(updatedCampaign.guild_id, channel, updatedCampaign.theme_id);',
    description: 'createMysteryBox avec guild_id'
  },

  // launchBox() - ligne 90
  {
    find: /await db\.logCampaignLaunch\(campaign\.id, message\.id, channel\.id\);/g,
    replace: 'await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);',
    description: 'logCampaignLaunch avec guild_id'
  },

  // launchBox() - ligne 91
  {
    find: /await db\.incrementCampaignLaunched\(campaign\.id\);/g,
    replace: 'await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);',
    description: 'incrementCampaignLaunched avec guild_id'
  },

  // pauseCampaign() - ligne 271
  {
    find: /async pauseCampaign\(campaignId\) \{[\s\S]*?await db\.updateCampaignStatus\(campaignId, 'paused'\);/,
    replace: `async pauseCampaign(guildId, campaignId) {
    await db.updateCampaignStatus(guildId, campaignId, 'paused');`,
    description: 'pauseCampaign avec guild_id'
  },

  // resumeCampaign() - ligne 278-279
  {
    find: /async resumeCampaign\(campaignId\) \{[\s\S]*?await db\.updateCampaignStatus\(campaignId, 'active'\);/,
    replace: `async resumeCampaign(guildId, campaignId) {
    await db.updateCampaignStatus(guildId, campaignId, 'active');`,
    description: 'resumeCampaign avec guild_id'
  },

  // stopCampaign() - ligne 286-305
  {
    find: /async stopCampaign\(campaignId\) \{[\s\S]*?const campaign = await db\.getCampaignById\(campaignId\);/,
    replace: `async stopCampaign(guildId, campaignId) {
    const campaign = await db.getCampaignById(guildId, campaignId);`,
    description: 'stopCampaign avec guild_id (signature + getCampaignById)'
  },

  // stopCampaign() - ligne 305
  {
    find: /await db\.updateCampaignStatus\(campaignId, 'stopped'\);/,
    replace: 'await db.updateCampaignStatus(guildId, campaignId, \'stopped\');',
    description: 'updateCampaignStatus(stopped) avec guild_id'
  }
];

// Appliquer toutes les corrections
corrections.forEach(({ find, replace, description }) => {
  const matches = content.match(find);
  if (matches) {
    content = content.replace(find, replace);
    modificationsCount += matches.length;
    console.log(`✅ ${description} (${matches.length} occurrence(s))`);
  } else {
    console.log(`ℹ️  ${description} - Déjà corrigé ou non trouvé`);
  }
});

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf8');

console.log(`\n📊 Total: ${modificationsCount} modification(s) effectuée(s)`);
console.log('✅ campaignHandler.js corrigé !');
console.log('\n⚠️  IMPORTANT: Vérifier les appels à initActiveCampaigns() dans index.js');
