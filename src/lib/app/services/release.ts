// Release codenames.
//
// Each minor version is named after a Japanese prefecture, ordered from the
// smallest to the largest population (a nod to Android's dessert names). The
// name advances with the minor version; patch releases share their minor's
// codename.

/** Japanese prefectures, ascending by population. */
const PREFECTURE_CODENAMES = [
  'Tottori',
  'Shimane',
  'Kochi',
  'Tokushima',
  'Fukui',
  'Saga',
  'Yamanashi',
  'Akita',
  'Wakayama',
  'Kagawa',
  'Miyazaki',
  'Yamagata',
  'Toyama',
  'Oita',
  'Ishikawa',
  'Iwate',
  'Aomori',
  'Nagasaki',
  'Ehime',
  'Nara',
  'Yamaguchi',
  'Okinawa',
  'Shiga',
  'Kagoshima',
  'Kumamoto',
  'Mie',
  'Fukushima',
  'Gunma',
  'Gifu',
  'Tochigi',
  'Okayama',
  'Nagano',
  'Niigata',
  'Miyagi',
  'Kyoto',
  'Hiroshima',
  'Ibaraki',
  'Shizuoka',
  'Hokkaido',
  'Fukuoka',
  'Hyogo',
  'Chiba',
  'Saitama',
  'Aichi',
  'Osaka',
  'Kanagawa',
  'Tokyo',
];

/**
 * The codename for a version. Advances with each minor version (1.0 → prefecture
 * 0, 1.1 → prefecture 1, …), so it changes automatically when the minor bumps;
 * patch releases keep their minor's name.
 */
export function releaseCodename(version: string): string {
  const [major, minor] = version.split('.').map((n) => Number(n) || 0);
  const index = Math.max(0, (major - 1) * 10 + minor);
  return PREFECTURE_CODENAMES[index] ?? '';
}

/** `1.4.0` → `1.4`. */
export function majorMinor(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}

/** Pull the timestamp out of a build stamp like `abc1234 — 2026-10-08 12:00:00Z`. */
export function buildDate(stamp: string): string {
  const match = stamp.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}Z?/);
  return match ? match[0] : stamp;
}
