import { createApp } from './app';
import { config } from './config';
import { startScheduledJobs } from './jobs/scheduler';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Nexus API listening on http://localhost:${config.port}`);
  startScheduledJobs();
});
