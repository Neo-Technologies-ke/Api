/**
 * VPS Cron Jobs
 * 
 * Replaces AWS Lambda scheduled events with cron jobs for VPS deployment.
 * This file should be run separately as a cron job or scheduled task.
 */

import { Environment } from "./shared/helpers/Environment.js";
import { handle15MinTimer, handleMidnightTimer, handleScheduledTasks } from "./lambda/timer-handler.js";

async function runCronJob(jobName: string, handler: Function) {
  console.log(`\n🕐 Starting cron job: ${jobName} at ${new Date().toISOString()}`);
  
  try {
    // Initialize environment if not already done
    if (!Environment.currentEnvironment) {
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "dev";
      await Environment.init(environment);
      console.log(`✅ Environment initialized: ${environment}`);
    }

    // Run the handler
    await handler({}, {});
    
    console.log(`✅ Cron job completed: ${jobName}`);
  } catch (error) {
    console.error(`❌ Cron job failed: ${jobName}`, error);
    process.exit(1);
  }
}

// Parse command line arguments
const jobType = process.argv[2];

async function main() {
  switch (jobType) {
    case "15min":
      await runCronJob("15-Minute Notifications", handle15MinTimer);
      break;
    
    case "midnight":
      await runCronJob("Midnight Digest", handleMidnightTimer);
      break;
    
    case "scheduled-tasks":
      await runCronJob("Scheduled Tasks", handleScheduledTasks);
      break;
    
    default:
      console.error("❌ Invalid job type. Use: 15min, midnight, or scheduled-tasks");
      console.log("\nUsage:");
      console.log("  npm run cron:15min          - Run 15-minute notification job");
      console.log("  npm run cron:midnight       - Run midnight digest job");
      console.log("  npm run cron:scheduled      - Run scheduled tasks job");
      process.exit(1);
  }
  
  process.exit(0);
}

main();
