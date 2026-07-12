import { Bot } from 'grammy';
import { registerWizard } from './wizard-flow';
import { registerSearch } from './search-flow';
import { createTelemetry } from '../telemetry/events';
import { loadChunks } from '../rag/chunks';
import { SearchIndex } from '../rag/search';
import { neon } from '@neondatabase/serverless';
import type { SqlExecutor } from '../rag/vector-search';

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
const searchIndex = new SearchIndex(loadChunks());
console.log(`📚 Индекс кодекса: ${searchIndex.size} чанков`);

const geminiKey = process.env.GEMINI_API_KEY;
const llm = geminiKey
  ? { apiKey: geminiKey, model: process.env.GEMINI_MODEL }
  : undefined;
console.log(llm ? `🧠 LLM-ответы включены (${llm.model ?? 'gemini-2.5-flash'})` : '🧠 LLM выключен — режим дословных фрагментов');

const dbUrl = process.env.DATABASE_URL;
const retrieval =
  dbUrl && geminiKey ? { sql: neon(dbUrl) as unknown as SqlExecutor, apiKey: geminiKey } : undefined;
console.log(retrieval ? '🔎 Гибридный поиск: BM25 + вектор (Neon)' : '🔎 Поиск: только BM25');

registerWizard(bot, telemetry);
registerSearch(bot, searchIndex, telemetry, llm, retrieval); // после визарда: он ловит свободный текст
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
