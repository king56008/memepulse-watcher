import 'dotenv/config';
import { run } from '@grammyjs/runner';
import { envHealth } from './lib/config.js';
import { log, safeErr } from './lib/logger.js';

process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { err: safeErr(reason) });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.error('uncaught exception', { err: safeErr(err) });
  process.exit(1);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function boot() {
  log.info('boot start');
  try {
    const { cfg } = await import('./lib/config.js');
    const { getDb } = await import('./lib/db.js');
    const { createBot } = await import('./bot.js');
    const { registerCommands } = await import('./commands/loader.js');
    const { registerPendingPromptHandler } = await import('./features/pendingPrompts.js');
    const { startScheduler } = await import('./services/scheduler.js');

    log.info('config loaded', envHealth());

    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is required. Create it with the verified @BotFather, add it in Config or .env, then redeploy.');
      process.exit(1);
    }

    if (!cfg.MONGODB_URI) {
      console.error('MONGODB_URI is required for Coin Tailer. It stores watchlists, settings, prompts, scheduler state, and memory. Add it in Config or .env, then redeploy.');
      process.exit(1);
    }

    await getDb();

    if (!cfg.COOKMYBOTS_X_ENDPOINT || !cfg.COOKMYBOTS_X_KEY) {
      log.warn('X integration disabled until COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY are set and an X account is connected in CookMyBots.');
    }

    if (!cfg.COOKMYBOTS_AI_KEY) {
      log.warn('AI digest generation disabled until COOKMYBOTS_AI_KEY is set.');
    }

    const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);
    await registerCommands(bot);
    registerPendingPromptHandler(bot);

    await bot.init();
    await bot.api.setMyCommands([
      { command: 'start', description: 'Welcome and setup guidance' },
      { command: 'help', description: 'Show available commands' },
      { command: 'setup', description: 'Initialize a group' },
      { command: 'addtoken', description: 'Add a token to track' },
      { command: 'removetoken', description: 'Remove a tracked token' },
      { command: 'tokens', description: 'List tracked tokens' },
      { command: 'price', description: 'Show current token price' },
      { command: 'trend', description: 'Show token trend summary' },
      { command: 'digest', description: 'Generate on-demand digest' },
      { command: 'announcements', description: 'Show recent official X posts' },
      { command: 'settime', description: 'Set daily digest time' },
      { command: 'settimezone', description: 'Set digest timezone' },
      { command: 'alerts', description: 'Toggle immediate alerts' },
      { command: 'pause', description: 'Pause scheduled posts' },
      { command: 'resume', description: 'Resume scheduled posts' },
      { command: 'settings', description: 'Show group settings' },
      { command: 'reset', description: 'Clear your bot memory' },
      { command: 'cancel', description: 'Cancel a pending prompt' },
    ]);

    let backoff = 2000;
    let runner = null;
    startScheduler(bot);

    while (true) {
      try {
        log.info('polling loop start', { loop: 'telegram' });
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        runner = run(bot, {
          runner: {
            fetch: { allowed_updates: ['message', 'callback_query'] },
            sink: { concurrency: 1 },
          },
        });
        log.info('polling started', { loop: 'telegram' });
        await runner.task();
        backoff = 2000;
      } catch (err) {
        log.error('polling failure', { loop: 'telegram', err: safeErr(err), backoffMs: backoff });
        try {
          if (runner?.isRunning?.()) await runner.stop();
        } catch (stopErr) {
          log.warn('runner stop failed', { err: safeErr(stopErr) });
        }
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 20000);
      }
    }
  } catch (err) {
    log.error('boot failure', { code: err?.code, err: safeErr(err) });
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('A module could not be loaded. Check that all relative imports include .js and the files exist.');
    }
    process.exit(1);
  }
}

boot();
