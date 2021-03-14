import type Telegraf from 'telegraf';
import {
  Message,
  ExtraReplyMessage,
  User,
  Chat,
} from 'telegraf/typings/telegram-types';
import { TelegrafContext } from 'telegraf/typings/context';
import { MiddlewareFn } from 'telegraf/typings/composer';
import type botConfig from '../bot.config.json';
import type { Game } from './game';
import type { Pool } from 'pg';

export type Tf = Telegraf<TelegrafContext>;
/* Standard middleware type */
export type Mw = MiddlewareFn<TelegrafContext>;
export type I18nToken = keyof typeof botConfig.phrases;

declare module 'telegraf/typings/context' {
  type UserRow = { user_id: number; first_name: string; last_name?: string };
  interface TelegrafContext {
    i18n: Record<I18nToken, string>;
    t(token: I18nToken, dict?: Record<string, string> | string[]): string;
    games: Map<number, Game>;
    replyTo(
      text: string,
      extra?: ExtraReplyMessage | undefined
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
}
