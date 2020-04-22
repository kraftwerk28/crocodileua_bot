import { createServer } from 'http';
import Telegraf, { ContextMessageUpdate, Middleware } from 'telegraf';
import { Message, ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { Pool } from 'pg';

import * as c from './commands';
import * as a from './actions';
import * as m from './middlewares';
import { initializeWordGen } from './wordGen';
import { Action } from './actions';
import { Game, interText, flushUpdates } from './utils';
import botConfig from '../bot.config.json';
import { ShutdownManager } from './shutdownManager';

type Tf = Telegraf<ContextMessageUpdate>;
/* Standard middleware type */
export type Mw = Middleware<ContextMessageUpdate>;
type I18nToken = keyof typeof botConfig.phrases;

declare module 'telegraf' {
  interface ContextMessageUpdate {
    i18n: Record<I18nToken, string>;
    t(token: I18nToken, dict?: Record<string, string> | string[]): string;
    games: Map<number, Game>;
    replyTo(
      text: string,
      extra?: ExtraReplyMessage | undefined
    ): Promise<Message>;
    cbQueryError(): Promise<boolean>;
  }
}

function extendContext(ctx: ContextMessageUpdate) {
  ctx.i18n = botConfig.phrases;
  ctx.t = function (token, dict) {
    const text = ctx.i18n[token];
    if (!text) return '';
    if (dict) return interText(text, dict);
    return text;
  };
  ctx.games = new Map();
  ctx.replyTo = function (text, extra) {
    return this.reply(text, {
      ...extra,
      reply_to_message_id: this.message?.message_id,
    });
  };
  ctx.cbQueryError = function () {
    return this.answerCbQuery('An error occured.');
  };
}

async function initBot(): Promise<Tf> {
  const {
    BOT_TOKEN,
    BOT_USERNAME,
    DB_HOST,
    DB_PORT = 5433,
    DB_USERNAME,
    DB_PASSWORD,
    DB_NAME,
  } = process.env;
  const bot = new Telegraf(BOT_TOKEN!, { username: BOT_USERNAME! });
  const db = new Pool({
    host: DB_HOST,
    port: +DB_PORT,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
  await db.connect();

  const commands = Object.entries(botConfig.commands).map((c) => ({
    command: c[0],
    description: c[1],
  }));
  // @ts-ignore
  await bot.telegram.setMyCommands(commands);

  bot
    .use(m.checkChatType)
    .on('text', m.onText)
    .start(c.onStart)
    .action(Action.REQUEST_LEADING, a.onRequestLeading)
    .action(Action.VIEW_WORD, a.onViewWord)
    .action(Action.CHANGE_WORD, a.onChangeWord);

  // TODO: auto set commange

  extendContext(bot.context);
  return bot;
}

export async function main() {
  if (process.env.NODE_ENV === 'development') {
    const { config } = await import('dotenv');
    config();
  }
  initializeWordGen();
  const shutdownMgr = new ShutdownManager();
  const bot = await initBot();
  await flushUpdates(bot.telegram);

  if (process.env.NODE_ENV === 'production') {
    const { WEBHOOK_PATH, WEBHOOK_URL, WEBHOOK_PORT } = process.env;
    const PORT = +WEBHOOK_PORT!;
    await bot.telegram.setWebhook(WEBHOOK_URL!);
    const server = createServer(bot.webhookCallback(WEBHOOK_PATH!));
    server.listen(PORT, () =>
      console.log(`Webhook server listening on :${PORT}`)
    );
    shutdownMgr.register(server.close.bind(server));
  } else {
    bot.startPolling();
    console.log('Started dev bot.');
  }
}
