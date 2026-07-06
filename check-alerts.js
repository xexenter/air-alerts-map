// /api/check-alerts — цей ендпоінт треба смикати ЗОВНІ (напр. cron-job.org)
// раз на 30-60 секунд. Vercel Hobby-план не дозволяє власний cron частіше
// разу на день, тому опитування тут навмисно винесене на зовнішній безкоштовний
// планувальник (див. README, розділ "Telegram-бот").
//
// Логіка: порівнюємо поточний список областей у тривозі з тим, що було
// збережено на попередньому запуску. Якщо десь тривога З'ЯВИЛАСЬ або
// ЗНИКЛА — розсилаємо повідомлення підписникам саме цієї області.

import { kv } from '@vercel/kv';
import { OBLASTS } from './_lib/oblasts.js';
import { fetchActiveOblastNames } from './_lib/fetchAlerts.js';

const TG = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

async function sendTelegram(chatId, text) {
  try {
    await fetch(TG('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('sendTelegram failed', chatId, err);
  }
}

export default async function handler(req, res) {
  // простий захист від випадкового/зловмисного виклику ким завгодно
  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const alertsToken = process.env.ALERTS_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!alertsToken || !botToken) {
    res.status(200).json({ skipped: true, reason: 'ALERTS_TOKEN or TELEGRAM_BOT_TOKEN not set yet' });
    return;
  }

  try {
    const activeNames = await fetchActiveOblastNames(alertsToken);

    const prevState = (await kv.get('alert_state')) || {};
    const nextState = {};
    const changes = [];

    for (const o of OBLASTS) {
      const isActive = o.apiNames.some((n) => activeNames.has(n));
      nextState[o.id] = isActive;
      const wasActive = !!prevState[o.id];
      if (isActive !== wasActive) {
        changes.push({ oblast: o, isActive });
      }
    }

    await kv.set('alert_state', nextState);

    let notified = 0;
    for (const change of changes) {
      const subs = (await kv.get(`subs:${change.oblast.id}`)) || [];
      if (!subs.length) continue;

      const text = change.isActive
        ? `🔴 Повітряна тривога: ${change.oblast.label}`
        : `🟢 Відбій тривоги: ${change.oblast.label}`;

      await Promise.all(subs.map((chatId) => sendTelegram(chatId, text)));
      notified += subs.length;
    }

    res.status(200).json({ ok: true, changes: changes.length, notified });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: String(err) });
  }
}
