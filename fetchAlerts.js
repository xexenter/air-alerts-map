// Спільна функція отримання поточних тривог з alerts.in.ua.
// Використовується і бекендом карти (/api/alerts), і кроном для бота
// (/api/check-alerts), щоб не дублювати логіку запиту.

export async function fetchActiveOblastNames(token) {
  const upstream = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    throw new Error(`alerts.in.ua responded with ${upstream.status}`);
  }

  const data = await upstream.json();
  const alerts = Array.isArray(data) ? data : data.alerts || [];

  const activeNames = new Set();
  for (const alert of alerts) {
    if (alert.location_type === 'oblast' && alert.alert_type === 'air_raid') {
      activeNames.add(alert.location_title);
    }
  }
  return activeNames;
}
