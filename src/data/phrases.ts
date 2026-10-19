export const FROG_EAT = ['Ням!', 'Ква-вкусно!', 'Хрум!', 'М-м-м!', 'Ещё!', 'Объеденье!', 'Ням-ням!'];
export const FROG_LICK = ['Хи-хи!', 'Чмок!', 'Ой, какой!', 'Лизь!', 'Сладенький!'];
export const FROG_MISS = ['Ква?', 'Мимо…', 'Хм?', 'Где?'];
export const FROG_POKE = ['Щекотно!', 'Хи!', 'Не тыкай!', 'Ква-ква!'];
export const FROG_FULL = ['Кваа… битком!', 'Брюшко полное!', 'Пых-пых…'];
export const FROG_WIN = ['Ура-ква!', 'Сытая!', 'Вот это пир!'];
export const FROG_FAIL = ['Голодная…', 'Ещё разок?', 'Животик урчит…'];
export const BUG_BLUSH = ['Ой! Кошмар!', 'И-и-и!', 'Ой, мамочки!', 'Ай-яй!', 'Фуу!'];
export const MOSQUITO_BLUSH = ['Пи-и-и!', 'Ай!', 'Ой!'];

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Russian 1 / 2-4 / 5+ forms, including 11–14 and 21, 22, 44, … */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function sparksLabel(n: number): string {
  return `${n} ${plural(n, 'искорка', 'искорки', 'искорок')}`;
}
