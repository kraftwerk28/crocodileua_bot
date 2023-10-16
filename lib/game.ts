import { Markup } from 'telegraf';
import { randWord } from './wordGen';
import type { Message, User } from 'telegraf/types';
import { Action } from './actions';
import { Context } from './context';
import { escapeHtml } from './utils';
import { logger } from './log';

const log = logger.child({ module: 'game' });

export enum GameState {
  PENDING = 'PENDING',
  WINNING = 'WINNING',
  IDLE = 'IDLE',
  TIMED_OUT = 'TIMED_OUT',
}

export interface Game {
  chatID: number;
  threadId?: number;
  gameState: GameState;
  gameMessageID: number;
  gameEndMessageID?: number;
  leader: User;
  winner?: User;
  word: string;
  elapsedTimeoutInstance?: NodeJS.Timeout;
  winnerTimeoutInstance?: NodeJS.Timeout;
}

function noop() {}

export async function createGame(ctx: Context): Promise<Game | undefined> {
  const { from, chat } = ctx;
  if (!(chat && from)) return;

  const { word } = await randWord();
  const prevGame = ctx.games.retrieveByContext(ctx);

  if (prevGame) {
    clearTimeout(prevGame.elapsedTimeoutInstance as NodeJS.Timeout);
    clearTimeout(prevGame.winnerTimeoutInstance as NodeJS.Timeout);

    if (prevGame.gameEndMessageID) {
      await ctx.telegram
        .editMessageReplyMarkup(
          chat.id,
          prevGame.gameEndMessageID,
          undefined,
          Markup.inlineKeyboard([]).reply_markup,
        )
        .catch(noop);
    }
  }

  await ctx.db.query('SELECT * FROM increase_user_leadings($1, $2)', [
    chat.id,
    from.id,
  ]);

  const replyMarkup = Markup.inlineKeyboard([
    Markup.button.callback(ctx.t('view_word_btn'), Action.VIEW_WORD),
    Markup.button.callback(ctx.t('change_word_btn'), Action.CHANGE_WORD),
  ]);
  const text = ctx.t('game_started', { user: await ctx.mention(from) });
  const threadId = ctx.games.threadIdFromCtx(ctx);

  const gameMessage = await ctx.reply(text, {
    parse_mode: 'HTML',
    message_thread_id: threadId,
    ...replyMarkup,
  });

  const game: Game = {
    word,
    gameState: GameState.PENDING,
    gameMessageID: gameMessage.message_id,
    chatID: chat.id,
    leader: from,
    threadId,
  };

  game.elapsedTimeoutInstance = setTimeout(
    () => endGame(ctx).catch((err) => log.error(err)),
    ctx.questionTimeout,
  );
  ctx.games.putByContext(game, ctx);
  return game;
}

export async function endGame(ctx: Context, winner?: User) {
  const { t, telegram, chat, games } = ctx;
  if (!chat) return;
  const game = games.retrieveByContext(ctx);
  if (!game) return;

  clearTimeout(game.elapsedTimeoutInstance as NodeJS.Timeout);

  // Game timed out
  if (!winner) {
    const replyMarkup = Markup.inlineKeyboard([
      Markup.button.callback(t('request_play_btn'), Action.REQUEST_LEADING),
    ]);
    await telegram
      .editMessageReplyMarkup(
        chat.id,
        game.gameMessageID,
        undefined,
        replyMarkup.reply_markup,
      )
      .catch(noop);
    game.gameEndMessageID = game.gameMessageID;
    game.gameState = GameState.TIMED_OUT;
    games.putByContext(game, ctx);
    return;
  }

  game.winner = winner;
  game.gameState = GameState.WINNING;
  game.winnerTimeoutInstance = setTimeout(() => {
    game.gameState = GameState.IDLE;
  }, ctx.winnerTimeout);
  const replyMarkup = Markup.inlineKeyboard([
    Markup.button.callback(t('request_play_btn'), Action.REQUEST_LEADING),
  ]);

  const endMessage = await telegram.sendMessage(
    game.chatID,
    t('winner_msg', {
      word: escapeHtml(game.word),
      winner: await ctx.mention(winner),
    }),
    {
      parse_mode: 'HTML',
      message_thread_id: game.threadId,
      ...replyMarkup,
    },
  );
  game.gameEndMessageID = endMessage.message_id;
  games.putByContext(game, ctx);
}
