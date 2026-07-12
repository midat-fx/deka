import { Bot } from 'grammy';
import { registerWizard } from './wizard-flow';
import { createTelemetry } from '../telemetry/events';

// Node ≥20.12 умеет читать .env сам. Если файла нет — не страшно,
// переменные могут быть заданы в окружении (или в проде через секреты).
try {
  process.loadEnvFile('.env');
} catch {
  /* .env необязателен */
}

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ Не задан BOT_TOKEN.');
  console.error('   Получи токен у @BotFather и положи в .env (см. SETUP.md, шаг 1).');
  process.exit(1);
}

const bot = new Bot(token);
const telemetry = createTelemetry();
registerWizard(bot, telemetry);
bot.catch((err) => console.error('Ошибка в боте:', err.error));

console.log('🤖 Deka запускается…');
await bot.start({
  onStart: async (me) => {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Подобрать налоговый режим' },
      { command: 'help', description: 'Что умеет бот' },
    ]);
    console.log(`✅ Запущен как @${me.username}. Открой бота в Telegram и напиши /start.`);
  },
});
