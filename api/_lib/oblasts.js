// Спільний довідник областей для бекенду.
// id — наш внутрішній ідентифікатор (як на карті),
// label — назва, яку бачить людина в Telegram,
// apiNames — точні назви, які повертає alerts.in.ua (щоб зіставляти статуси).

export const OBLASTS = [
  { id: 'krym',       label: 'АР Крим',            apiNames: ['Автономна Республіка Крим'] },
  { id: 'vinnytsia',  label: 'Вінницька',           apiNames: ['Вінницька область'] },
  { id: 'volyn',      label: 'Волинська',           apiNames: ['Волинська область'] },
  { id: 'dnipro',     label: 'Дніпропетровська',    apiNames: ['Дніпропетровська область'] },
  { id: 'donetsk',    label: 'Донецька',            apiNames: ['Донецька область'] },
  { id: 'zhytomyr',   label: 'Житомирська',         apiNames: ['Житомирська область'] },
  { id: 'zakarpat',   label: 'Закарпатська',        apiNames: ['Закарпатська область'] },
  { id: 'zaporizhia', label: 'Запорізька',          apiNames: ['Запорізька область'] },
  { id: 'ivano',      label: 'Івано-Франківська',   apiNames: ['Івано-Франківська область'] },
  { id: 'kirovohrad', label: 'Кіровоградська',      apiNames: ['Кіровоградська область'] },
  { id: 'luhansk',    label: 'Луганська',           apiNames: ['Луганська область'] },
  { id: 'lviv',       label: 'Львівська',           apiNames: ['Львівська область'] },
  { id: 'mykolaiv',   label: 'Миколаївська',        apiNames: ['Миколаївська область'] },
  { id: 'odesa',      label: 'Одеська',             apiNames: ['Одеська область'] },
  { id: 'poltava',    label: 'Полтавська',          apiNames: ['Полтавська область'] },
  { id: 'rivne',      label: 'Рівненська',          apiNames: ['Рівненська область'] },
  { id: 'sumy',       label: 'Сумська',             apiNames: ['Сумська область'] },
  { id: 'ternopil',   label: 'Тернопільська',       apiNames: ['Тернопільська область'] },
  { id: 'kharkiv',    label: 'Харківська',          apiNames: ['Харківська область'] },
  { id: 'khmelnytsk', label: 'Хмельницька',         apiNames: ['Хмельницька область'] },
  { id: 'cherkasy',   label: 'Черкаська',           apiNames: ['Черкаська область'] },
  { id: 'chernivtsi', label: 'Чернівецька',         apiNames: ['Чернівецька область'] },
  { id: 'chernihiv',  label: 'Чернігівська',        apiNames: ['Чернігівська область'] },
  { id: 'kherson',    label: 'Херсонська',          apiNames: ['Херсонська область'] },
  { id: 'kyiv',       label: 'Київська + м. Київ',  apiNames: ['Київська область', 'м. Київ'] },
  { id: 'sevastopol', label: 'Севастополь',         apiNames: ['м. Севастополь'] },
];

export function findOblast(id) {
  return OBLASTS.find(o => o.id === id) || null;
}
