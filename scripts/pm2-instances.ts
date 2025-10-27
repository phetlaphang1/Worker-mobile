/**
 * PM2 Instance Manager
 * Dynamically start/stop/restart LDPlayer instances as PM2 processes
 *
 * Usage:
 *   npx tsx scripts/pm2-instances.ts start <profileId>      - Start instance
 *   npx tsx scripts/pm2-instances.ts stop <profileId>       - Stop instance
 *   npx tsx scripts/pm2-instances.ts restart <profileId>    - Restart instance
 *   npx tsx scripts/pm2-instances.ts list                   - List all instances
 *   npx tsx scripts/pm2-instances.ts start-all              - Start all profiles
 *   npx tsx scripts/pm2-instances.ts stop-all               - Stop all instances
 *   npx tsx scripts/pm2-instances.ts logs <profileId>       - View instance logs
 */

import pm2 from 'pm2';
import fs from 'fs/promises';
import path from 'path';

interface Profile {
  id: number;
  name: string;
  instanceName: string;
  port: number;
  status: string;
}

const PROFILES_PATH = path.join(process.cwd(), 'data', 'profiles');
const LOGS_PATH = path.join(process.cwd(), 'logs', 'pm2', 'instances');

// Load all profiles from disk
async function loadProfiles(): Promise<Profile[]> {
  try {
    const files = await fs.readdir(PROFILES_PATH);
    const profiles: Profile[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(PROFILES_PATH, file), 'utf-8');
        profiles.push(JSON.parse(content));
      }
    }

    return profiles.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Failed to load profiles:', error);
    return [];
  }
}

// Start instance as PM2 process
async function startInstance(profileId: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const profiles = await loadProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
      return reject(new Error(`Profile ${profileId} not found`));
    }

    // Ensure logs directory exists
    await fs.mkdir(LOGS_PATH, { recursive: true });

    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connection error:', err);
        return reject(err);
      }

      const processName = `instance-${profileId}`;

      // Check if already running
      pm2.describe(processName, (err, processDescription) => {
        if (!err && processDescription.length > 0) {
          console.log(`✅ Instance ${profileId} (${profile.name}) is already running`);
          pm2.disconnect();
          return resolve();
        }

        // Start new process - this will run a worker script that manages the instance
        pm2.start(
          {
            name: processName,
            script: 'dist/workers/instance-worker.js', // Worker script to be created
            args: `--profile-id ${profileId}`,
            cwd: process.cwd(),
            instances: 1,
            autorestart: true,
            max_memory_restart: '300M',
            env: {
              NODE_ENV: process.env.NODE_ENV || 'development',
              PROFILE_ID: profileId.toString(),
              INSTANCE_NAME: profile.instanceName,
              ADB_PORT: profile.port.toString(),
            },
            error_file: path.join(LOGS_PATH, `instance-${profileId}-error.log`),
            out_file: path.join(LOGS_PATH, `instance-${profileId}-out.log`),
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
            min_uptime: '5s',
            max_restarts: 5,
            restart_delay: 3000,
          },
          (err) => {
            pm2.disconnect();
            if (err) {
              console.error(`❌ Failed to start instance ${profileId}:`, err.message);
              return reject(err);
            }
            console.log(`✅ Started instance ${profileId} (${profile.name}) on port ${profile.port}`);
            resolve();
          }
        );
      });
    });
  });
}

// Stop instance
async function stopInstance(profileId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connection error:', err);
        return reject(err);
      }

      const processName = `instance-${profileId}`;

      pm2.stop(processName, (err) => {
        if (err) {
          pm2.disconnect();
          console.error(`❌ Failed to stop instance ${profileId}:`, err.message);
          return reject(err);
        }

        // Delete the process after stopping
        pm2.delete(processName, (err) => {
          pm2.disconnect();
          if (err) {
            console.error(`⚠️ Stopped but failed to delete instance ${profileId}:`, err.message);
          } else {
            console.log(`✅ Stopped instance ${profileId}`);
          }
          resolve();
        });
      });
    });
  });
}

// Restart instance
async function restartInstance(profileId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connection error:', err);
        return reject(err);
      }

      const processName = `instance-${profileId}`;

      pm2.restart(processName, (err) => {
        pm2.disconnect();
        if (err) {
          console.error(`❌ Failed to restart instance ${profileId}:`, err.message);
          return reject(err);
        }
        console.log(`✅ Restarted instance ${profileId}`);
        resolve();
      });
    });
  });
}

// List all instances
async function listInstances(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connection error:', err);
        return reject(err);
      }

      pm2.list((err, processDescriptionList) => {
        pm2.disconnect();
        if (err) {
          console.error('Failed to list processes:', err);
          return reject(err);
        }

        // Filter only instance processes
        const instances = processDescriptionList.filter(p =>
          p.name?.startsWith('instance-')
        );

        if (instances.length === 0) {
          console.log('No instances running');
          return resolve();
        }

        console.log('\n📋 LDPlayer Instances Status:\n');
        console.log('ID\tNAME\t\t\tSTATUS\t\tMEMORY\t\tRESTARTS');
        console.log('='.repeat(80));

        instances.forEach(proc => {
          const profileId = proc.name?.replace('instance-', '');
          const status = proc.pm2_env?.status || 'unknown';
          const memory = proc.monit?.memory
            ? `${Math.round(proc.monit.memory / 1024 / 1024)}MB`
            : 'N/A';
          const restarts = proc.pm2_env?.restart_time || 0;

          console.log(
            `${profileId}\t${proc.name}\t${status}\t\t${memory}\t\t${restarts}`
          );
        });

        console.log('\n');
        resolve();
      });
    });
  });
}

// Start all profiles
async function startAll(): Promise<void> {
  const profiles = await loadProfiles();
  console.log(`Starting ${profiles.length} instances...\n`);

  for (const profile of profiles) {
    try {
      await startInstance(profile.id);
      // Small delay between starts to avoid overwhelming system
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`Failed to start instance ${profile.id}:`, error.message);
    }
  }

  console.log('\n✅ All instances started');
}

// Stop all instances
async function stopAll(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connection error:', err);
        return reject(err);
      }

      pm2.list((err, processDescriptionList) => {
        if (err) {
          pm2.disconnect();
          return reject(err);
        }

        const instances = processDescriptionList.filter(p =>
          p.name?.startsWith('instance-')
        );

        if (instances.length === 0) {
          console.log('No instances to stop');
          pm2.disconnect();
          return resolve();
        }

        console.log(`Stopping ${instances.length} instances...\n`);

        let stopped = 0;
        instances.forEach(proc => {
          pm2.delete(proc.name!, (err) => {
            stopped++;
            if (err) {
              console.error(`❌ Failed to stop ${proc.name}:`, err.message);
            } else {
              console.log(`✅ Stopped ${proc.name}`);
            }

            if (stopped === instances.length) {
              pm2.disconnect();
              console.log('\n✅ All instances stopped');
              resolve();
            }
          });
        });
      });
    });
  });
}

// View logs for an instance
async function viewLogs(profileId: number): Promise<void> {
  const logFile = path.join(LOGS_PATH, `instance-${profileId}-out.log`);
  const errorLogFile = path.join(LOGS_PATH, `instance-${profileId}-error.log`);

  console.log(`📄 Logs for instance ${profileId}:`);
  console.log(`Output: ${logFile}`);
  console.log(`Errors: ${errorLogFile}\n`);
  console.log('Use: pm2 logs instance-${profileId} for real-time logs\n');
}

// Main CLI handler
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'start':
        if (!arg) {
          console.error('Usage: npx tsx scripts/pm2-instances.ts start <profileId>');
          process.exit(1);
        }
        await startInstance(parseInt(arg));
        break;

      case 'stop':
        if (!arg) {
          console.error('Usage: npx tsx scripts/pm2-instances.ts stop <profileId>');
          process.exit(1);
        }
        await stopInstance(parseInt(arg));
        break;

      case 'restart':
        if (!arg) {
          console.error('Usage: npx tsx scripts/pm2-instances.ts restart <profileId>');
          process.exit(1);
        }
        await restartInstance(parseInt(arg));
        break;

      case 'list':
        await listInstances();
        break;

      case 'start-all':
        await startAll();
        break;

      case 'stop-all':
        await stopAll();
        break;

      case 'logs':
        if (!arg) {
          console.error('Usage: npx tsx scripts/pm2-instances.ts logs <profileId>');
          process.exit(1);
        }
        await viewLogs(parseInt(arg));
        break;

      default:
        console.log(`
PM2 Instance Manager - LDPlayer Instance Control

Usage:
  npx tsx scripts/pm2-instances.ts <command> [args]

Commands:
  start <profileId>     Start an instance
  stop <profileId>      Stop an instance
  restart <profileId>   Restart an instance
  list                  List all running instances
  start-all             Start all profiles
  stop-all              Stop all instances
  logs <profileId>      View log paths for instance

Examples:
  npx tsx scripts/pm2-instances.ts start 8
  npx tsx scripts/pm2-instances.ts stop 8
  npx tsx scripts/pm2-instances.ts list
  npx tsx scripts/pm2-instances.ts start-all
        `);
        process.exit(0);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
