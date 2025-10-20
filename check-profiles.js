import fs from 'fs';
import path from 'path';

const profilesDir = 'D:\\BArmy\\Worker-mobile\\data\\profiles';
const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.json'));

console.log(`Found ${files.length} profile files\n`);

files.forEach(file => {
  const content = fs.readFileSync(path.join(profilesDir, file), 'utf8');
  const profile = JSON.parse(content);
  const hasScript = profile.metadata?.scriptContent && profile.metadata.scriptContent.trim().length > 0;
  const scriptLength = profile.metadata?.scriptContent?.length || 0;

  console.log(`Profile ${profile.id}: ${profile.name}`);
  console.log(`  Instance: ${profile.instanceName}`);
  console.log(`  Status: ${profile.status}`);
  console.log(`  Has script: ${hasScript ? 'YES' : 'NO'} (${scriptLength} chars)`);
  console.log('');
});
