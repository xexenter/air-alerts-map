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

    // ВАЖЛИВО: тривога буває оголошена на всю область (location_type:"oblast")
    // АБО лише на окремі райони/громади всередині області (location_type:
    // raion/hromada/city) — на самому alerts.in.ua другий випадок теж
    // підсвічує область (блідішим кольором). Щоб наша карта збігалася з
    // офіційною, рахуємо обидва випадки: беремо location_oblast (це поле
    // є в кожному записі і завжди вказує на "батьківську" область), а для
    // Києва/Севастополя, які самі є окремими одиницями без області-батька,
    // використовуємо їх власний location_title.
    const activeOblasts = new Set();
    const fullOblasts = new Set(); // ті, де тривога на ВСЮ область (для майбутнього більш точного відображення)
    for (const alert of alerts) {
      if (alert.alert_type !== 'air_raid') continue;
      const groupName = alert.location_type === 'oblast'
        ? alert.location_title
        : (alert.location_oblast || alert.location_title);
      activeOblasts.add(groupName);
      if (alert.location_type === 'oblast') fullOblasts.add(groupName);
    }

    // Кешуємо відповідь на рівні CDN Vercel на 15 секунд. Це означає, що
    // навіть якщо на сайт одночасно зайде 1000 людей, alerts.in.ua отримає
    // не більше одного запиту на ~15 секунд із нашого сервера — це і є
    // те "проксування", яке вимагає alerts.in.ua, і воно ж захищає від
    // ліміту 8-10 запитів/хв.
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({
      active_oblasts: [...activeOblasts],
      full_oblasts: [...fullOblasts],
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
