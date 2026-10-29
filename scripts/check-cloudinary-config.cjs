#!/usr/bin/env node
// Read-only local check. Reports names and availability, never secret values.
const { cloudinaryUploadConfig } = require('../server/cloudinaryConfig');
let missing = false;
for (const [label, type] of [['Images', 'image'], ['Vocaux', 'video']]) {
  const config = cloudinaryUploadConfig(process.env, type);
  if (config.configured) console.log(`${label} : paramètres présents.`);
  else {
    missing = true;
    console.log(`${label} : configuration incomplète.`);
    for (const name of config.missing) console.log(`  Manquant : ${name}`);
  }
}
console.log('Contrôle local uniquement : identifiants, existence des presets et transferts réels non vérifiés auprès de Cloudinary.');
process.exitCode = missing ? 1 : 0;
