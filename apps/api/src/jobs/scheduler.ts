import cron from 'node-cron';
import { reingestAllSites } from '../services/actionGraph';
import { clusterProductSignals } from '../services/productSignals';
import { query } from '../db';

const REINGEST_CRON = process.env.ACTION_GRAPH_CRON ?? '0 3 * * *';
const SIGNALS_CRON = process.env.SIGNALS_CRON ?? '0 4 * * *';

export function startScheduledJobs(): void {
  cron.schedule(REINGEST_CRON, () => {
    console.log('[cron] Starting nightly Action Graph re-ingest...');
    reingestAllSites().catch((err) => {
      console.error('[cron] Action Graph re-ingest failed:', err);
    });
  });

  cron.schedule(SIGNALS_CRON, async () => {
    console.log('[cron] Clustering product signals...');
    try {
      const sites = await query<{ id: string }>('SELECT id FROM sites');
      for (const site of sites) {
        await clusterProductSignals(site.id);
      }
    } catch (err) {
      console.error('[cron] Product signals job failed:', err);
    }
  });

  console.log(`[cron] Action Graph re-ingest: ${REINGEST_CRON}`);
  console.log(`[cron] Product signals: ${SIGNALS_CRON}`);
}
