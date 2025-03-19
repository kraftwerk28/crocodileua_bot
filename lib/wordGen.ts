import fs from 'node:fs';
import path from 'node:path';
import { BASE_DIR } from './utils.js';

// Singleton
let wordList: string[];

export function initializeWordGen() {
  try {
    const fpath = path.join(BASE_DIR, 'nouns_simplified.txt');
    wordList = fs.readFileSync(fpath, 'utf-8').split('\n');
  } catch (e) {
    throw new Error('Failed reading wordlist');
  }
}

type RandomWord = { word: string; description?: string };

export async function randWord(
  includeDescription = false,
): Promise<RandomWord> {
  const nth = Math.floor(Math.random() * wordList.length);
  const word = wordList[nth];
  let description: string | undefined;
  return { word, description };
}
