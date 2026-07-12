import { createApp } from './app';
import { config } from './config';
import { startScheduledJobs } from './jobs/scheduler';
import { ensureSeedPlatformAdmin } from './services/platformAuthService';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Nexus API listening on http://localhost:${config.port}`);
  startScheduledJobs();
  ensureSeedPlatformAdmin().catch((err) => {
    console.warn('[platform] Failed to seed platform admin:', err.message);
  });
});
