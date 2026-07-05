// /api/alerts — серверна проксі-функція.
//
// Навіщо вона потрібна: alerts.in.ua прямо забороняє віддавати токен у
// браузер користувача (див. їхню документацію, розділ "Використання у
// публічних сервісах"). Тому цей файл виконується НЕ в браузері, а на
// сервері Vercel, тримає токен у змінній середовища ALERTS_TOKEN і віддає
// фронтенду вже готовий спрощений список областей у тривозі.
//
// Vercel сам перетворює будь-який файл у папці /api на serverless-функцію,
// додаткового налаштування не потрібно.

export default async function handler(req, res) {
  const token = process.env.ALERTS_TOKEN;

  if (!token) {
    // Токен ще не додано в налаштуваннях проєкту на Vercel —
    // фронтенд покаже про це попередження замість того, щоб падати.
    res.status(200).json({
      error: 'no_token',
      active_oblasts: [],
      updated_at: new Date().toISOString(),
    });
    return;
  }

  try {
    const upstream = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      res.status(502).json({
        error: 'upstream_error',
        status: upstream.status,
        active_oblasts: [],
      });
      return;
    }

    const data = await upstream.json();
    const alerts = Array.isArray(data) ? data : data.alerts || [];

    // Нас цікавить повітряна тривога саме на рівні всієї області —
    // це те, що ми фарбуємо на карті. Деталізовані тривоги по районах/
    // громадах (location_type: raion/hromada/city) тут навмисно
    // ігноруються, щоб не заплутати карту областей.
    const activeOblasts = new Set();
    for (const alert of alerts) {
      if (alert.location_type === 'oblast' && alert.alert_type === 'air_raid') {
        activeOblasts.add(alert.location_title);
      }
    }

    // Кешуємо відповідь на рівні CDN Vercel на 15 секунд. Це означає, що
    // навіть якщо на сайт одночасно зайде 1000 людей, alerts.in.ua отримає
    // не більше одного запиту на ~15 секунд із нашого сервера — це і є
    // те "проксування", яке вимагає alerts.in.ua, і воно ж захищає від
    // ліміту 8-10 запитів/хв.
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({
      active_oblasts: [...activeOblasts],
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: 'server_error',
      message: String(err),
      active_oblasts: [],
    });
  }
}
