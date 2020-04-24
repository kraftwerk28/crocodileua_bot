import { ContextMessageUpdate, Telegram, Markup } from 'telegraf';
import { randWord } from './wordGen';
import { User } from 'telegraf/typings/telegram-types';
import { Action } from './actions';

export function noop() {}

export function capitalize(w: string) {
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

export async function flushUpdates(tg: Telegram) {
  await tg.deleteWebhook();

  async function flushUpdate(lastUpdateID: number): Promise<void> {
    const newUpdates = await tg.getUpdates(
      // @ts-ignore
      undefined,
      100,
      lastUpdateID
    );

    if (newUpdates.length > 0) {
      lastUpdateID = newUpdates[newUpdates.length - 1].update_id;
      console.log(`Fetched old updates [id: ${lastUpdateID}].`);
      return flushUpdate(lastUpdateID + 1);
    }
  }
  return flushUpdate(0);
}

export function mention(u: User, link = false, includeLastName = true) {
  if (u.username) {
    return `@${u.username}`;
  }
  let text = u.first_name;
  if (includeLastName && u.last_name) {
    text += ` ${u.last_name}`;
  }
  return link ? `<a href="tg://user?id=${u.id}">${text}</a>` : text;
}

export function ratingMention(first_name: string, last_name?: string) {
  if (!last_name) return first_name;
  return `${first_name} ${last_name}`;
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

export enum GameState {
  PENDING = 'PENDING',
  WINNING = 'WINNING',
  IDLE = 'IDLE',
  TIMED_OUT = 'TIMED_OUT',
}

export interface Game {
  chatID: number;
  gameState: GameState;
  gameMessageID: number;
  gameEndMessageID?: number;
  leader: User;
  winner?: User;
  word: string;
  elapsedTimeoutInstance?: NodeJS.Timeout;
  winnerTimeoutInstance?: NodeJS.Timeout;
}

// TODO!!!
export function checkWord(text: string, word: string): boolean {
  return RegExp(`\s*${word}[?!,.]?\s*`, 'im').test(text);
}

export async function endGame(ctx: ContextMessageUpdate, winner?: User) {
  const { t, telegram, chat, games } = ctx;
  if (!chat) return;
  const game = games.get(chat.id);
  if (!game) return;

  clearTimeout(game.elapsedTimeoutInstance as NodeJS.Timeout);

  // Game timed out
  if (!winner) {
    const replyMarkup = Markup.inlineKeyboard([
      Markup.callbackButton(t('request_play_btn'), Action.REQUEST_LEADING),
    ]);
    await telegram.editMessageReplyMarkup(
      chat.id,
      game.gameMessageID,
      undefined,
      JSON.stringify(replyMarkup)
    );
    game.gameEndMessageID = game.gameMessageID;
    game.gameState = GameState.TIMED_OUT;
    games.set(chat.id, game);
    return;
  }

  game.winner = winner;
  game.gameState = GameState.WINNING;
  game.winnerTimeoutInstance = setTimeout(() => {
    game.gameState = GameState.IDLE;
  }, ctx.winnerTimeout);
  const replyMarkup = Markup.inlineKeyboard([
    Markup.callbackButton(t('request_play_btn'), Action.REQUEST_LEADING),
  ]);

  const endMessage = await telegram.sendMessage(
    game?.chatID!,
    t('winner_msg', { word: game.word, winner: mention(winner) }),
    {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }
  );
  game.gameEndMessageID = endMessage.message_id;
  games.set(chat.id, game);
}

export async function createGame(
  ctx: ContextMessageUpdate,
  leader: User
): Promise<Game | undefined> {
  const { chat, from, games, t, telegram, db } = ctx;
  if (!(chat && from)) return;

  const { word } = await randWord();
  const prevGame = games.get(chat.id);

  if (prevGame) {
    clearTimeout(prevGame.elapsedTimeoutInstance as NodeJS.Timeout);
    clearTimeout(prevGame.winnerTimeoutInstance as NodeJS.Timeout);

    if (prevGame.gameEndMessageID) {
      await telegram.editMessageReplyMarkup(
        chat.id,
        prevGame.gameEndMessageID,
        undefined,
        JSON.stringify({ reply_markup: [] })
      );
    }
  }

  await db.query('SELECT * FROM increase_user_leadings($1, $2)', [
    chat.id,
    leader.id,
  ]);

  const replyMarkup = Markup.inlineKeyboard([
    Markup.callbackButton(t('view_word_btn'), Action.VIEW_WORD),
    Markup.callbackButton(t('change_word_btn'), Action.CHANGE_WORD),
  ]);
  const text = t('game_started', { user: mention(leader) });
  const gameMessage = await ctx.reply(text, {
    reply_markup: replyMarkup,
    parse_mode: 'HTML',
  });

  const game: Game = {
    word,
    gameState: GameState.PENDING,
    gameMessageID: gameMessage.message_id,
    chatID: chat.id,
    leader: leader,
  };

  game.elapsedTimeoutInstance = setTimeout(
    endGame,
    ctx.questionTimeout,
    ctx
  ) as any;
  games.set(chat.id, game);
  return game;
}

export function numNoun(num: number): string {
  if (num >= 5 && num <= 20) return 'перемог';
  const n = num % 10;
  if (n === 0) return 'перемог';
  else if (n === 1) return 'перемога';
  else if (n >= 2 && n <= 4) return 'перемоги';
  else return 'перемог';
}
