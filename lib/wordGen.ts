import fs from 'fs';
import path from 'path';
import qs from 'querystring';
import cheerio from 'cheerio';
import fetch from 'node-fetch';

// Singleton
let wordList: string[];

export function initializeWordGen() {
  try {
    const fpath = path.resolve(__dirname, '../../nouns.txt');
    wordList = fs.readFileSync(fpath, 'utf-8').split('\n');
  } catch(e) {
    throw new Error('Failed reading wordlist')
  }
}

export async function randWord(
  withDescription = false
): Promise<{ word: string; desc?: string }> {
  const nth = Math.floor(Math.random() * wordList.length);
  const word = wordList[nth];
  if (!withDescription) return { word };
  return { word, desc: await description(word) };
}

async function description(word: string): Promise<string | undefined> {
  return;
  // To be implemented...
  const q = qs.stringify({ swrd: word });

  const html = await fetch(`http://sum.in.ua?${q}`).then((r) => r.text());

  const $ = cheerio.load(html);
  const d = $('#article div[itemprop=articleBody] p');
  if (d.length > 1) {
    const descp = d.eq(1);
    descp.find('*').remove();
    return descp
      .contents()
      .get()
      .map((e) => e.data.trim())
      .filter((e) => e.length > 1)
      .join(' ');
  }
}
