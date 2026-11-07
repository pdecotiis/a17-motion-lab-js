// The person who set the lab up on this computer, shown as an avatar beside the theme switch: their initials on a
// light circle, their name as the tooltip. The name is the computer's git user (vite.config.ts reads it when the dev
// server starts), so each designer sees themselves; a built copy has none and shows no avatar. Pure: main.ts draws it.

/** One or two capital letters from a name ("Maya Chen" → "MC", "maya" → "M", "maya.chen" → "MC"); '' when there is none. */
export function initialsOf(name: string | undefined): string {
  const words = (name ?? '').trim().split(/[\s._-]+/).filter(w => /[\p{L}\p{N}]/u.test(w[0] ?? ''));
  if (words.length === 0) return '';
  const first = Array.from(words[0]!)[0]!;
  const last = words.length > 1 ? Array.from(words[words.length - 1]!)[0]! : '';
  return (first + last).toLocaleUpperCase();
}
