import { createServer } from 'http';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import * as c from './commands.js';
import * as a from './actions.js';
import * as m from './middlewares.js';
import { initializeWordGen } from './wordGen.js';
import { Action } from './actions.js';
import {
  interpolateText,
  userLink,
  mention,
  escapeHtml,
  numNoun,
  ratingMention,
} from './utils.js';
import botConfig from '../bot.config.json' assert { type: 'json' };
import packageJSON from '../package.json' assert { type: 'json' };
import { ShutdownManager } from './shutdownManager.js';
import { logger } from './log.js';
import { type Context, GameStorage } from './context.js';
import { migrateToLatest } from './db/migrate.js';
import { Store } from './db/store.js';
import { createKyselyInstance } from './db/instance.js';

const log = logger.child({ module: 'bot' });

function extendContext(ctx: Context) {
  ctx.i18n = botConfig.phrases;

  ctx.t = function (token, dict) {
    const text = ctx.i18n[token];
    if (!text) return '';
    if (dict) return interpolateText(text, dict);
    return text;
  };

  // ctx.games = new GameStorage();

  ctx.replyTo = function (text, extra) {
    return this.reply(text, {
      ...extra,
      reply_to_message_id: this.message?.message_id,
    });
  };

  ctx.cbQueryError = function () {
    return this.answerCbQuery('An error occured.');
  };

  ctx.questionTimeout = botConfig.misc['question_timeout'];
  ctx.winnerTimeout = botConfig.misc['winner_choise_timeout'];
  ctx.CREATOR_ID = +process.env.CREATOR_ID!;

  ctx.mention = async function (user) {
    return mention(user, true);
    // const q = 'SELECT * FROM aliases WHERE user_id = $1';
    // const dbResult = await this.db.query(q, [user.id]);
    // if (dbResult.rowCount) {
    //   return userLink(user.id, dbResult.rows[0].alias);
    // } else {
    //   return mention(user, true);
    // }
  };

  // ctx.ratingMention = async function (row) {
  //   const q = 'SELECT * FROM aliases WHERE user_id = $1';
  //   const dbResult = await this.db.query(q, [row.user_id]);
  //   if (dbResult.rowCount) {
  //     return escapeHtml(dbResult.rows[0].alias);
  //   } else {
  //     let text = row.first_name;
  //     if (row.last_name) {
  //       text += ` ${row.last_name}`;
  //     }
  //     return escapeHtml(text);
  //   }
  // };

  ctx.getGlobalRating = async function () {
    const users = await this.db.getGlobalRating();
    if (!users.length) return this.t('no_players_yet');
    const ratingText = users
      .map((user, i) =>
        this.t(i < 3 ? 'user_rating_bold' : 'user_rating', [
          i + 1,
          ratingMention(user.first_name, user.last_name ?? undefined),
          user.win_count,
          numNoun(user.win_count),
        ]),
      )
      .join('\n');
    return `${this.t('global_rating_header')}\n${ratingText}`;
  };

  ctx.getLocalRating = async function (chat) {
    const users = await this.db.getChatRating(chat.id);
    if (!users.length) return this.t('no_players_yet');
    const ratingText = users
      .map((user, i) =>
        this.t(i < 3 ? 'user_rating_bold' : 'user_rating', [
          i + 1,
          ratingMention(user.first_name, user.last_name ?? undefined),
          user.win_count,
          numNoun(user.win_count),
        ]),
      )
      .join('\n');
    return `${this.t('chat_rating_header')}\n${ratingText}`;
  };

  // ctx.getRating = async function (chat) {
  //   const ratingQuery = chat
  //     ? 'SELECT * FROM get_chat_rating($1)'
  //     : 'SELECT * FROM get_global_rating()';
  //   const aliasQuery = 'SELECT * FROM aliases';
  //   const [ratingDBResponse, aliasDBResponse] = await Promise.all([
  //     this.db.query(ratingQuery, chat ? [chat?.id] : []).then((r) => r.rows),
  //     this.db.query(aliasQuery).then((r) => r.rows),
  //   ]);
  //   const aliases: Map<number, string> = aliasDBResponse.reduce((acc, row) => {
  //     acc.set(row.user_id, row.alias);
  //     return acc;
  //   }, new Map());
  //
  //   if (!ratingDBResponse.length) return this.t('no_players_yet');
  //
  //   const ratingText = ratingDBResponse
  //     .map((r, i) =>
  //       this.t(i < 3 ? 'user_rating_bold' : 'user_rating', [
  //         i + 1,
  //         aliases.get(r.user_id) || ratingMention(r.first_name, r.last_name),
  //         r.wins,
  //         numNoun(r.wins),
  //       ]),
  //     )
  //     .join('\n');
  //
  //   const title = this.t(chat ? 'chat_rating_header' : 'global_rating_header');
  //   return `${title}\n${ratingText}`;
  // };
}

async function initBot(): Promise<Telegraf<Context>> {
  const bot = new Telegraf<Context>(process.env.BOT_TOKEN!, {
    // username: BOT_USERNAME!,
    telegram: { webhookReply: false },
  });

  const commands = Object.entries(botConfig.commands).map((c) => ({
    command: c[0],
    description: c[1],
  }));
  await bot.telegram.setMyCommands(commands);

  bot
    .use(m.checkChatType)
    .on(message(), m.addUser)
    .on(message('text'), m.onText)
    .start(m.addUser, c.onStart)
    .action(Action.REQUEST_LEADING, m.addUser, a.onRequestLeading)
    .action(Action.VIEW_WORD, a.onViewWord)
    .action(Action.CHANGE_WORD, a.onChangeWord)
    .command('rating', c.rating)
    .command('rating_global', c.globalRating)
    .hears(/\/alias(?:@\w+)?(?:\s+(.+))?/, c.toggleAlias)
    .command('listalias', c.listAlias)
    .command('changelog', c.changelog)
    .catch((err: unknown, ctx: Context) => {
      log.error(Object.assign(err as Error, { ctx }));
    });

  // @ts-expect-error passing Partial<Context> leads to a lot of errors I don't have time to fix rn
  extendContext(bot.context);
  return bot;
}

export async function main() {
  log.info(`Version ${packageJSON.version}`);
  if (process.env.NODE_ENV === 'development') {
    const dotenv = await import('dotenv');
    log.info(dotenv.config({ path: '.env.dev' }), 'parsed dotenv');
  }

  initializeWordGen();
  const shutdownMgr = new ShutdownManager();

  // const connectionCfg: pg.PoolConfig = {
  //   connectionString: process.env.DATABASE_URL,
  //   connectionTimeoutMillis: 5000,
  // };
  // const db = new pg.Pool(connectionCfg);
  log.info('DBMS connected');

  const bot = await initBot();

  const kysely = createKyselyInstance();
  log.info(await migrateToLatest(kysely), 'Database migration');
  // log.info(await kysely.destroy(), 'Kysely destroy');

  shutdownMgr.register(() => kysely.destroy());
  const dbStore = new Store(kysely);
  bot.context.db = dbStore;

  if (process.env.NODE_ENV === 'production') {
    const { WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_PATH } = process.env;

    const webhookCb = await bot.createWebhook({
      domain: `${WEBHOOK_HOST}:${WEBHOOK_PORT}`,
      path: WEBHOOK_PATH,
      drop_pending_updates: true,
    });
    const server = createServer(webhookCb);

    const port = process.env.PORT || 8080;
    server.listen(port, () =>
      log.info(`Webhook server listening on :${port}.`),
    );

    shutdownMgr.register(server.close.bind(server));
  } else {
    await bot.launch();
    log.info('Started dev bot.');
  }
}
