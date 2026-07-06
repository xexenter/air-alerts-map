// api/telegram-check.js — цей ендпоінт треба викликати регулярно ЗЗОВНІ
// (див. TELEGRAM_SETUP.md), напр. раз на 1-2 хвилини безкоштовним
// зовнішнім cron-сервісом. Vercel Hobby не дає викликати власний Cron
// частіше разу на добу — тому зовнішній тригер тут обов'язковий.
//
// Що робить:
// 1. Отримує поточний список областей у тривозі (та сама функція, що й карта).
// 2. Порівнює з попереднім станом, збереженим у Redis (Upstash) — бо
//    serverless-функція "забуває" все між викликами, стан треба десь тримати.
// 3. Якщо є новий початок/відбій тривоги — шле повідомлення в Telegram.

import { Redis } from '@upstash/redis';
import { getActiveOblasts } from './lib/getActiveOblasts.js';

const redis = Redis.fromEnv(); // читає KV_REST_API_URL / KV_REST_API_TOKEN
                                // (або UPSTASH_REDIS_REST_URL/TOKEN — обидва
                                // варіанти автоматично підхоплюються)

const STATE_KEY = 'telegram:prev_active_oblasts';

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API помилка ${res.status}: ${body}`);
  }
}

function buildMessage(started, ended) {
  const lines = [];
  if (started.length) {
    lines.push('🔴 <b>Повітряна тривога</b>');
    started.forEach(n => lines.push(`• ${n}`));
  }
  if (ended.length) {
    if (lines.length) lines.push('');
    lines.push('🟢 <b>Відбій тривоги</b>');
    ended.forEach(n => lines.push(`• ${n}`));
  }
  return lines.join('\n');
}

export default async function handler(req, res) {
  // Захист від випадкових/чужих викликів ендпоінту — зовнішній cron-сервіс
  // має передавати цей самий секрет у заголовку.
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const active = await getActiveOblasts();

    const prevRaw = await redis.get(STATE_KEY);
    const prev = new Set(Array.isArray(prevRaw) ? prevRaw : []);
    const isFirstRun = prevRaw === null;

    const started = [...active].filter(n => !prev.has(n));
    const ended = [...prev].filter(n => !active.has(n));

    if (!isFirstRun && (started.length || ended.length)) {
      await sendTelegramMessage(buildMessage(started, ended));
    }

    await redis.set(STATE_KEY, [...active]);

    res.status(200).json({
      ok: true,
      active_count: active.size,
      started,
      ended,
      first_run: isFirstRun,
    });
  } catch (err) {
    if (err.code === 'no_token') {
      res.status(200).json({ ok: false, error: 'no_token' });
      return;
    }
    console.error('[telegram-check]', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
