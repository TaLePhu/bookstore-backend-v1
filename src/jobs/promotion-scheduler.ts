import { container } from 'tsyringe';
import { AdminPromotionService } from '@services/AdminPromotionService';

const PROMOTION_SYNC_INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let isRunning = false;

export function startPromotionScheduler(): void {
  if (timer) return;

  const runSync = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await container.resolve(AdminPromotionService).syncPromotionEffects();
    } catch (error) {
      console.error('Promotion scheduler sync failed:', error);
    } finally {
      isRunning = false;
    }
  };

  void runSync();
  timer = setInterval(runSync, PROMOTION_SYNC_INTERVAL_MS);
}

export function stopPromotionScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
