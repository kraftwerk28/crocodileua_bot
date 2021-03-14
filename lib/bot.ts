import { createServer } from 'http';
import Telegraf from 'telegraf';
import { Pool, PoolConfig } from 'pg';
import { TelegrafContext } from 'telegraf/typings/context';

import * as c from './commands';
import * as a from './actions';
import * as m from './middlewares';
import { initializeWordGen } from './wordGen';
import { Action } from './actions';
import {
  interText,
  flushUpdates,
  Log,
  userLink,
  mention,
  escapeHtml,
  numNoun,
  ratingMention,
} from './utils';
import botConfig from '../bot.config.json';
import packageJSON from '../package.json';
import { ShutdownManager } from './shutdownManager';
import { Tf } from './types';

function extendContext(ctx: TelegrafContext) {
  ctx.i18n = botConfig.phrases;
  ctx.t = function(token, dict) {
    const text = ctx.i18n[token];
    if (!text) return '';
    if (dict) return interText(text, dict);
    return text;
  };
  ctx.games = new Map();
  ctx.replyTo = function(text, extra) {
    return this.reply(text, {
      ...extra,
      reply_to_message_id: this.message?.message_id,
    });
  };
  ctx.cbQueryError = function() {
    return this.answerCbQuery('An error occured.');
  };
  ctx.questionTimeout = botConfig.misc['question_timeout'];
  ctx.winnerTimeout = botConfig.misc['winner_choise_timeout'];
  ctx.CREATOR_ID = +process.env.CREATOR_ID!;
  ctx.mention = async function(user) {
    const q = 'SELECT * FROM aliases WHERE user_id = $1';
    const dbResult = await this.db.query(q, [user.id]);
    if (dbResult.rowCount) {
      return userLink(user.id, dbResult.rows[0].alias);
    } else {
      return mention(user, true);
    }
  };
  ctx.ratingMention = async function(row) {
    const q = 'SELECT * FROM aliases WHERE user_id = $1';
    const dbResult = await this.db.query(q, [row.user_id]);
    if (dbResult.rowCount) {
      return escapeHtml(dbResult.rows[0].alias);
    } else {
      let text = row.first_name;
      if (row.last_name) {
        text += ` ${row.last_name}`;
      }
      return escapeHtml(text);
    }
  };

  ctx.getRating = async function(chat) {
    const ratingQuery = chat
      ? 'SELECT * FROM get_chat_rating($1)'
      : 'SELECT * FROM get_global_rating()';
    const aliasQuery = 'SELECT * FROM aliases';
    const [ratingDBResponse, aliasDBResponse] = await Promise.all([
      this.db.query(ratingQuery, chat ? [chat?.id] : []).then((r) => r.rows),
      this.db.query(aliasQuery).then((r) => r.rows),
    ]);
    const aliases: Map<number, string> = aliasDBResponse.reduce((acc, row) => {
      acc.set(row.user_id, row.alias);
      return acc;
    }, new Map());

    if (!ratingDBResponse.length) return this.t('no_players_yet');

    const ratingText = ratingDBResponse.map((r, i) =>
      this.t(i < 3 ? 'user_rating_bold' : 'user_rating', [
        i + 1,
        aliases.get(r.user_id) || ratingMention(r.first_name, r.last_name),
        r.wins,
        numNoun(r.wins),
      ])
    );

    const title = this.t(chat
      ? 'chat_rating_header'
      : 'global_rating_header'
    );
    return title + '\n\n' + ratingText.join('\n');
  };
}

async function initBot(): Promise<Tf> {
  const {
    BOT_TOKEN,
    BOT_USERNAME,
    DB_HOST,
    DB_PORT = 5433,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
  } = process.env;
  const bot = new Telegraf(BOT_TOKEN!, {
    username: BOT_USERNAME!,
    telegram: { webhookReply: false },
  });
  const connectionCfg: PoolConfig = {
    host: DB_HOST,
    port: +DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  };
  const db = new Pool(connectionCfg);
  await db.connect();
  Log.i('DBMS connected.');
  bot.context.db = db;

  const commands = Object.entries(botConfig.commands).map((c) => ({
    command: c[0],
    description: c[1],
  }));
  await bot.telegram.setMyCommands(commands);

  bot
    .use()
    .use(m.checkChatType)
    .on('text', m.onText)
    .start(m.addUser, c.onStart)
    .action(Action.REQUEST_LEADING, m.addUser, a.onRequestLeading)
    .action(Action.VIEW_WORD, a.onViewWord)
    .action(Action.CHANGE_WORD, a.onChangeWord)
    .command('rating', c.rating)
    .command('rating_global', c.globalRating)
    .hears(/\/alias(?:@\w+)?(?:\s+(.+))?/, c.toggleAlias)
    .command('listalias', c.listAlias);

  extendContext(bot.context);
  return bot;
}

export async function main() {
  Log.i(`Version ${packageJSON.version}`);
  if (process.env.NODE_ENV === 'development') {
    const { config } = await import('dotenv');
    config();
  }

  initializeWordGen();
  const shutdownMgr = new ShutdownManager();

  const bot = await initBot();
  shutdownMgr.register(bot.context.db.end.bind(bot.context.db));
  await flushUpdates(bot.telegram);

  if (process.env.NODE_ENV === 'production') {
    const { WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_PATH } = process.env;
    const port = process.env.PORT || 8080;
    const url = `https://${WEBHOOK_HOST}:${WEBHOOK_PORT}${WEBHOOK_PATH}`;
    Log.i(`Webhook path: ${url}`);

    await bot.telegram.setWebhook(url);
    const server = createServer(bot.webhookCallback(WEBHOOK_PATH!));
    server.listen(port, () => Log.i(`Webhook server listening on :${port}.`));

    shutdownMgr.register(server.close.bind(server));
  } else {
    bot.startPolling();
    Log.i('Started dev bot.');
  }
}
