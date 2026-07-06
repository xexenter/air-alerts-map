// /api/telegram-webhook — сюди Telegram надсилає всі повідомлення та натискання
// кнопок від користувачів бота. Реєструється один раз командою setWebhook
// (див. README, крок з реєстрацією вебхука).

import { kv } from '@vercel/kv';
import { OBLASTS, findOblast } from './_lib/oblasts.js';
import { fetchActiveOblastNames } from './_lib/fetchAlerts.js';

const TG = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

async function tg(method, payload) {
  const res = await fetch(TG(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function getUserSubs(chatId) {
  const raw = await kv.get(`user:${chatId}`);
  return Array.isArray(raw) ? raw : [];
}

async function setUserSubs(chatId, subs) {
  await kv.set(`user:${chatId}`, subs);
}

async function addSubscriber(oblastId, chatId) {
  const key = `subs:${oblastId}`;
  const raw = (await kv.get(key)) || [];
  if (!raw.includes(chatId)) {
    raw.push(chatId);
    await kv.set(key, raw);
  }
}

async function removeSubscriber(oblastId, chatId) {
  const key = `subs:${oblastId}`;
  const raw = (await kv.get(key)) || [];
  const next = raw.filter((id) => id !== chatId);
  await kv.set(key, next);
}

function buildKeyboard(subs) {
  const rows = [];
  for (let i = 0; i < OBLASTS.length; i += 2) {
    const pair = OBLASTS.slice(i, i + 2);
    rows.push(
      pair.map((o) => ({
        text: (subs.includes(o.id) ? '✅ ' : '▫️ ') + o.label,
        callback_data: `sub:${o.id}`,
      }))
    );
  }
  rows.push([{ text: '✔️ Готово', callback_data: 'done' }]);
  return { inline_keyboard: rows };
}

const WELCOME_TEXT =
  '🛰 <b>Тривоги по областях</b>\n\n' +
  'Обери області нижче — я напишу тобі, коли в них ПОЧИНАЄТЬСЯ або ЗАКІНЧУЄТЬСЯ повітряна тривога.\n\n' +
  'Команди:\n' +
  '/start — це меню\n' +
  '/status — поточна обстановка зараз\n' +
  '/stop — відписатися від усього';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('ok');
    return;
  }

  // Захист: перевіряємо секретний заголовок, який Telegram надсилає,
  // якщо секрет заданий при реєстрації вебхука.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = req.headers['x-telegram-bot-api-secret-token'];
    if (got !== expectedSecret) {
      res.status(401).send('unauthorized');
      return;
    }
  }

  const update = req.body;

  try {
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();

      if (text === '/start') {
        const subs = await getUserSubs(chatId);
        await tg('sendMessage', {
          chat_id: chatId,
          text: WELCOME_TEXT,
          parse_mode: 'HTML',
          reply_markup: buildKeyboard(subs),
        });
      } else if (text === '/status') {
        const token = process.env.ALERTS_TOKEN;
        if (!token) {
          await tg('sendMessage', { chat_id: chatId, text: 'Токен API ще не налаштовано на сервері.' });
        } else {
          const active = await fetchActiveOblastNames(token);
          const activeLabels = OBLASTS.filter((o) => o.apiNames.some((n) => active.has(n))).map((o) => o.label);
          const body = activeLabels.length
            ? '🔴 Зараз тривога:\n' + activeLabels.map((l) => '• ' + l).join('\n')
            : '🟢 Зараз тривог немає (за даними alerts.in.ua).';
          await tg('sendMessage', { chat_id: chatId, text: body });
        }
      } else if (text === '/stop') {
        const subs = await getUserSubs(chatId);
        for (const id of subs) await removeSubscriber(id, chatId);
        await setUserSubs(chatId, []);
        await tg('sendMessage', { chat_id: chatId, text: 'Відписано від усіх областей.' });
      } else {
        await tg('sendMessage', { chat_id: chatId, text: 'Не розумію цю команду. Напиши /start.' });
      }
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;

      if (data === 'done') {
        await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Збережено ✔️' });
      } else if (data.startsWith('sub:')) {
        const oblastId = data.slice(4);
        const oblast = findOblast(oblastId);
        if (!oblast) {
          await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Невідома область' });
          return res.status(200).send('ok');
        }

        const subs = await getUserSubs(chatId);
        let nextSubs, toastText;
        if (subs.includes(oblastId)) {
          nextSubs = subs.filter((id) => id !== oblastId);
          await removeSubscriber(oblastId, chatId);
          toastText = `Відписано: ${oblast.label}`;
        } else {
          nextSubs = [...subs, oblastId];
          await addSubscriber(oblastId, chatId);
          toastText = `Підписано: ${oblast.label}`;
        }
        await setUserSubs(chatId, nextSubs);

        await tg('answerCallbackQuery', { callback_query_id: cq.id, text: toastText });
        await tg('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: cq.message.message_id,
          reply_markup: buildKeyboard(nextSubs),
        });
      }
    }
  } catch (err) {
    console.error('telegram-webhook error', err);
  }

  res.status(200).send('ok');
}
