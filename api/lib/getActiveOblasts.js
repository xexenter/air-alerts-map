// api/lib/getActiveOblasts.js — спільна логіка отримання списку областей
// у тривозі. Використовується і картою (/api/alerts), і Telegram-ботом
// (/api/telegram-check), щоб не було двох різних джерел правди.

export async function getActiveOblasts() {
  const token = process.env.ALERTS_TOKEN;

  if (!token) {
    const err = new Error('no_token');
    err.code = 'no_token';
    throw err;
  }

  const upstream = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    const err = new Error(`upstream_error_${upstream.status}`);
    err.code = 'upstream_error';
    err.status = upstream.status;
    throw err;
  }

  const data = await upstream.json();
  const alerts = Array.isArray(data) ? data : data.alerts || [];

  const activeOblasts = new Set();
  for (const alert of alerts) {
    if (alert.location_type === 'oblast' && alert.alert_type === 'air_raid') {
      activeOblasts.add(alert.location_title);
    }
  }

  return activeOblasts;
}
