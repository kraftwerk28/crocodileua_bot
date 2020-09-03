import { Markup } from 'telegraf';
import { randWord } from './wordGen';
import { User } from 'telegraf/typings/telegram-types';
import { Action } from './actions';
import { TelegrafContext } from 'telegraf/typings/context';

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

export async function createGame(
  ctx: TelegrafContext,
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
  const text = t('game_started', { user: await ctx.mention(leader) });
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

export async function endGame(ctx: TelegrafContext, winner?: User) {
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
    t('winner_msg', { word: game.word, winner: await ctx.mention(winner) }),
    { parse_mode: 'HTML', reply_markup: replyMarkup },
  );
  game.gameEndMessageID = endMessage.message_id;
  games.set(chat.id, game);
}
