/**
 * Предвычисление поискового индекса: npm run build:index
 *
 * relevant.json → data/corpus/index.json (чанки + инвертированный индекс).
 * Этот файл бандлится в Cloudflare Worker: на проде индекс не строится,
 * а просто загружается — старт за миллисекунды вместо секунд токенизации.
 */
import { writeFileSync } from 'node:fs';
import { loadChunks } from '../src/rag/chunks';
import { SearchIndex } from '../src/rag/search';

const chunks = loadChunks();
const index = new SearchIndex(chunks);
const data = index.toJSON();

writeFileSync('data/corpus/index.json', JSON.stringify(data));

const bytes = Buffer.byteLength(JSON.stringify(data));
console.log(`✅ Индекс собран: ${chunks.length} чанков, ${(bytes / 1024 / 1024).toFixed(1)} МБ → data/corpus/index.json`);

// Самопроверка: загруженный из JSON индекс ищет так же, как живой.
const reloaded = SearchIndex.fromSerialized(JSON.parse(JSON.stringify(data)));
const a = index.search('лимит дохода самозанятого', 3).map((h) => h.chunk.id).join(',');
const b = reloaded.search('лимит дохода самозанятого', 3).map((h) => h.chunk.id).join(',');
if (a !== b) {
  console.error(`❌ Расхождение живого и сериализованного индекса: ${a} vs ${b}`);
  process.exit(1);
}
console.log('✅ Самопроверка: сериализованный индекс идентичен живому.');
