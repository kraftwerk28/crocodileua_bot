const fs = require('fs');
const qs = require('querystring');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const pretty = require('pretty');

function capitalize(w) {
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

const words = fs.readFileSync('nouns.txt', 'utf-8').split('\n');

async function description(word) {
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

async function randWord(withDescription = false) {
  const nth = Math.floor(Math.random() * words.length);
  // const wrd = words[nth];
  const wrd = 'абрис';
  return { wrd, desc: await description(wrd) };
  // const html = await fetch('http://sum.in.ua/random').then(r => r.text());
  // const w = cheerio('#article strong', html);
  // w.find('.stress').remove();
  // return capitalize(w.text());
}

(async () => {
  console.log(await description('абрис'));
  // console.log(await randWord());
})();
