import type { User } from 'telegraf/types';
import path from 'path';
import { logger } from './log';

const log = logger.child({ module: 'utils' });

export const BASE_DIR = path.resolve(__dirname, '../../dicts/');

export function noop() {
  return Promise.resolve();
}

export function capitalize(w: string) {
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
}

export function userLink(uID: number, userName: string): string {
  return `<a href="tg://user?id=${uID}">${escapeHtml(userName)}</a>`;
}

export function mention(u: User, link = false, includeLastName = true) {
  let text = '';
  if (u.username) {
    text += `@${u.username}`;
  } else {
    text += u.first_name;
    if (includeLastName && u.last_name) {
      text += ` ${u.last_name}`;
    }
  }
  text = escapeHtml(text);

  return link ? userLink(u.id, text) : text;
}

export function ratingMention(first_name: string, last_name?: string) {
  if (!last_name) return escapeHtml(first_name);
  return escapeHtml(`${first_name} ${last_name}`);
}

export function interText(
  text: string,
  dict: Record<string, string> | string[]
) {
  if (Array.isArray(dict)) {
    return text.replace(/\$(\d+)/g, (_, k) => dict[k]);
  } else {
    return text.replace(/\$\{(\w+)\}/g, (_, k) => dict[k]);
  }
}

export function assert(...args: any[]): boolean {
  return args.some((v) => !Boolean(v));
}

export function checkWord(text: string, word: string): boolean {
  const regex = RegExp(`^\\s*${word}[:()?\\.,\\s]*$`, 'im');
  return regex.test(text);
}

export function numNoun(num: number): string {
  if (num >= 5 && num <= 20) return 'перемог';
  const n = num % 10;
  if (n === 0) return 'перемог';
  else if (n === 1) return 'перемога';
  else if (n >= 2 && n <= 4) return 'перемоги';
  else return 'перемог';
}

// export const Log = {
//   _t(): string {
//     const d = new Date();
//     const date = [
//       d.getDate().toString().padStart(2, '0'),
//       d.getMonth().toString().padStart(2, '0'),
//       d.getFullYear().toString().padStart(4, '0'),
//     ].join('.');
//     const time = [
//       d.getHours().toString().padStart(2, '0'),
//       d.getMinutes().toString().padStart(2, '0'),
//       d.getSeconds().toString().padStart(2, '0'),
//     ].join(':');
//     return `[${date} ${time}]`;
//   },
//   i(...args: any[]) {
//     return console.log(this._t(), ...args);
//   },
//   w(...args: any[]) {
//     return console.warn(this._t(), args);
//   },
//   e(...args: any[]) {
//     return console.error(this._t(), args);
//   },
// };
