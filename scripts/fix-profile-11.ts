import * as fs from 'fs/promises';
import * as path from 'path';

async function fixProfile11() {
  const profilePath = path.join(process.cwd(), 'data', 'profiles', '11.json');

  try {
    // Read current profile
    const data = await fs.readFile(profilePath, 'utf-8');
    const profile = JSON.parse(data);

    console.log(`Current profile 11:`);
    console.log(`  Name: ${profile.name}`);
    console.log(`  Instance: ${profile.instanceName}`);
    console.log(`  Port: ${profile.port}`);

    // Choose a valid instance from the available list:
    // Options: 111, test21323, X-Worker-Clone-1, Instance_2_7, etc.

    // Let's use instance "111" (index 0, port 5555)
    const newInstanceName = '111';
    const newPort = 5555; // 5555 + 0 * 2

    profile.instanceName = newInstanceName;
    profile.port = newPort;
    profile.name = `Profile 11 (${newInstanceName})`;

    // Save updated profile
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));

    console.log(`\n✅ Profile 11 updated successfully!`);
    console.log(`  New instance: ${newInstanceName}`);
    console.log(`  New port: ${newPort}`);
    console.log(`\nYou can now launch profile 11 from the UI.`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixProfile11();
