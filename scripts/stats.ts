/**
 * npm run stats — сводка телеметрии в терминале.
 * Это те самые цифры для августовского кейса: юзеры, воронка, режимы.
 */
import { createTelemetry } from '../src/telemetry/events';

try {
  process.loadEnvFile('.env');
} catch {
  /* необязателен */
}

const t = createTelemetry();
const s = t.summary();

console.log('📊 Deka — статистика\n');
console.log(`Уникальных пользователей: ${s.uniqueUsers}`);
console.log(`Всего событий:            ${s.totalEvents}\n`);

if (s.byEvent.length > 0) {
  console.log('По типам событий:');
  for (const e of s.byEvent) console.log(`  ${e.event.padEnd(15)} ${e.count}`);
  console.log('');
}

const { started, reachedResult } = s.funnel;
if (started > 0) {
  const pct = Math.round((reachedResult / started) * 100);
  console.log(`Воронка визарда: ${started} начали → ${reachedResult} дошли до результата (${pct}%)\n`);
}

if (s.regimes.length > 0) {
  console.log('Какие режимы выпадают:');
  for (const r of s.regimes) console.log(`  ${String(r.regime).padEnd(15)} ${r.count}`);
  console.log('');
}

if (s.byDay.length > 0) {
  console.log('По дням (последние):');
  for (const d of s.byDay.slice(0, 14)) console.log(`  ${d.day}  юзеров: ${d.users}, событий: ${d.events}`);
}

t.close();
