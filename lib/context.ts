import { MiddlewareFn, Context as TelegrafContext } from 'telegraf';
import type { Message, User, Chat } from 'telegraf/types';
import type * as tt from 'telegraf/typings/telegram-types';
import type botConfig from '../bot.config.json';
import type { Game } from './game';
import type { Pool } from 'pg';

/* Standard middleware type */
export type Mw = MiddlewareFn<Context>;
export type I18nToken = keyof typeof botConfig.phrases;

export class GameStorage {
  constructor(private games = new Map<string, Game>()) {}
  makeKey(chatId: number, threadId?: number) {
    if (threadId !== undefined) return `${chatId}:${threadId}`;
    else return `${chatId}`;
  }
  retrieve(chatId: number, threadId?: number) {
    return this.games.get(this.makeKey(chatId, threadId));
  }
  put(game: Game, chatId: number, threadId?: number) {
    this.games.set(this.makeKey(chatId, threadId), game);
  }
  threadIdFromCtx(ctx: Context) {
    if (ctx.callbackQuery) {
      return ctx.callbackQuery.message?.message_thread_id;
    }
    return ctx.message?.message_thread_id;
  }
  retrieveByContext(ctx: Context) {
    if (!ctx.chat) return;
    return this.retrieve(ctx.chat.id, this.threadIdFromCtx(ctx));
  }
  putByContext(game: Game, ctx: Context) {
    if (!ctx.chat) return;
    this.put(game, ctx.chat.id, this.threadIdFromCtx(ctx));
  }
}

type UserRow = { user_id: number; first_name: string; last_name?: string };

export interface Context extends TelegrafContext {
  i18n: Record<I18nToken, string>;
  t(token: I18nToken, dict?: Record<string, string> | string[]): string;
  games: GameStorage;
  replyTo(
    text: string,
    extra?: tt.ExtraReplyMessage | undefined,
  ): Promise<Message>;
  cbQueryError(): Promise<boolean>;
  db: Pool;
  questionTimeout: number;
  winnerTimeout: number;
  CREATOR_ID: number;
  mention(user: User): Promise<string>;
  ratingMention(row: UserRow): Promise<string>;
  getRating(chat?: Chat): Promise<string>;
}
