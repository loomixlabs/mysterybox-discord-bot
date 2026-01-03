/**
 * Script de téléchargement et vérification des images Monopoly
 * Télécharge toutes les images du thème pour vérification visuelle
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Créer le dossier de destination
const outputDir = path.join(__dirname, '..', 'themes', 'presets', 'monopoly-images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Charger le thème Monopoly
const theme = require('../themes/presets/monopoly.theme.json');

// Extraire toutes les URLs d'images
const imagesToDownload = [];

// Mystery box images
if (theme.theme_config?.mystery_box_image) {
  imagesToDownload.push({
    url: theme.theme_config.mystery_box_image,
    name: 'mystery_box',
    category: 'config'
  });
}
if (theme.theme_config?.mystery_box_celebration_gif) {
  imagesToDownload.push({
    url: theme.theme_config.mystery_box_celebration_gif,
    name: 'celebration_gif',
    category: 'config'
  });
}
if (theme.metadata?.preview_image) {
  imagesToDownload.push({
    url: theme.metadata.preview_image,
    name: 'preview',
    category: 'config'
  });
}

// Collectibles
theme.collectibles?.forEach(c => {
  if (c.image_url) {
    imagesToDownload.push({
      url: c.image_url,
      name: c.collectible_id,
      category: `collectible_${c.rarity}`
    });
  }
});

// Traps
theme.traps?.forEach(t => {
  if (t.image_url) {
    imagesToDownload.push({
      url: t.image_url,
      name: t.trap_id,
      category: 'trap'
    });
  }
});

console.log(`\n📥 TÉLÉCHARGEMENT DES IMAGES MONOPOLY`);
console.log('='.repeat(60));
console.log(`📁 Dossier de destination: ${outputDir}`);
console.log(`🖼️  Images à télécharger: ${imagesToDownload.length}\n`);

// Fonction de téléchargement
function downloadImage(imageInfo) {
  return new Promise((resolve, reject) => {
    const { url, name, category } = imageInfo;

    // Déterminer l'extension
    const ext = url.includes('.gif') ? '.gif' :
                url.includes('.png') ? '.png' :
                url.includes('.jpg') || url.includes('.jpeg') ? '.jpg' : '.png';

    const filename = `${category}_${name}${ext}`;
    const filepath = path.join(outputDir, filename);

    // Choisir http ou https
    const client = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://www.google.com/'
      }
    };

    console.log(`⏳ ${filename}...`);

    const request = client.get(url, options, (response) => {
      // Gérer les redirections
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`  ↪️ Redirection vers: ${redirectUrl.substring(0, 50)}...`);
        downloadImage({ url: redirectUrl, name, category })
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        console.log(`  ❌ Erreur HTTP ${response.statusCode}`);
        resolve({ success: false, filename, error: `HTTP ${response.statusCode}` });
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(filepath);
        console.log(`  ✅ ${filename} (${Math.round(stats.size / 1024)}KB)`);
        resolve({ success: true, filename, size: stats.size, filepath });
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        console.log(`  ❌ Erreur écriture: ${err.message}`);
        resolve({ success: false, filename, error: err.message });
      });
    });

    request.on('error', (err) => {
      console.log(`  ❌ Erreur réseau: ${err.message}`);
      resolve({ success: false, filename, error: err.message });
    });

    request.setTimeout(15000, () => {
      request.destroy();
      console.log(`  ⏱️ Timeout`);
      resolve({ success: false, filename, error: 'Timeout' });
    });
  });
}

// Télécharger toutes les images
async function downloadAll() {
  const results = { success: [], failed: [] };

  for (const img of imagesToDownload) {
    const result = await downloadImage(img);
    if (result.success) {
      results.success.push(result);
    } else {
      results.failed.push(result);
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DU TÉLÉCHARGEMENT\n');
  console.log(`✅ Réussis: ${results.success.length}`);
  console.log(`❌ Échecs: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Images échouées:');
    results.failed.forEach(f => {
      console.log(`  - ${f.filename}: ${f.error}`);
    });
  }

  console.log(`\n📁 Images téléchargées dans: ${outputDir}`);
  console.log('\n🔍 Vous pouvez maintenant vérifier visuellement les images.');
  console.log('   Ouvrez le dossier et vérifiez que chaque image correspond');
  console.log('   bien au style Monopoly officiel.\n');

  // Créer un fichier HTML pour faciliter la vérification
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Vérification Images Monopoly</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .card { background: white; border-radius: 10px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .card img { max-width: 100%; height: auto; border-radius: 5px; }
    .card h3 { margin: 10px 0 5px; font-size: 14px; }
    .card p { margin: 0; font-size: 12px; color: #666; }
    .legendary { border-left: 4px solid #FFD700; }
    .epic { border-left: 4px solid #9B59B6; }
    .rare { border-left: 4px solid #3498DB; }
    .common { border-left: 4px solid #95A5A6; }
    .trap { border-left: 4px solid #E74C3C; }
    .config { border-left: 4px solid #2ECC71; }
    .failed { border-left: 4px solid #E74C3C; background: #fee; }
  </style>
</head>
<body>
  <h1>🎩 Vérification Images Thème Monopoly</h1>
  <p>Vérifiez que chaque image correspond au style officiel Monopoly</p>

  <h2>⚙️ Configuration</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.startsWith('config_')).map(r => `
    <div class="card config">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  <h2>🌟 Légendaires</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.includes('legendary')).map(r => `
    <div class="card legendary">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename.replace('collectible_legendary_', '').replace('.png', '')}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  <h2>💜 Épiques</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.includes('epic')).map(r => `
    <div class="card epic">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename.replace('collectible_epic_', '').replace('.png', '')}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  <h2>💙 Rares</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.includes('rare')).map(r => `
    <div class="card rare">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename.replace('collectible_rare_', '').replace('.png', '')}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  <h2>⬜ Communs</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.includes('common')).map(r => `
    <div class="card common">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename.replace('collectible_common_', '').replace('.png', '')}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  <h2>🪤 Pièges</h2>
  <div class="grid">
    ${results.success.filter(r => r.filename.startsWith('trap_')).map(r => `
    <div class="card trap">
      <img src="${r.filename}" alt="${r.filename}">
      <h3>${r.filename.replace('trap_', '').replace('.png', '')}</h3>
      <p>${Math.round(r.size / 1024)}KB</p>
    </div>
    `).join('')}
  </div>

  ${results.failed.length > 0 ? `
  <h2>❌ Échecs de téléchargement</h2>
  <div class="grid">
    ${results.failed.map(r => `
    <div class="card failed">
      <h3>${r.filename}</h3>
      <p>Erreur: ${r.error}</p>
    </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'verification.html');
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`📄 Page de vérification créée: ${htmlPath}`);
  console.log('   Ouvrez ce fichier dans un navigateur pour vérifier toutes les images.\n');
}

downloadAll().catch(console.error);
