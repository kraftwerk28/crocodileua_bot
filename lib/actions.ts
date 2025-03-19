import { Mw } from './context.js';
import { randWord } from './wordGen.js';
import { createGame } from './game.js';
import { DbGameState } from './db/store.js';

export enum Action {
  REQUEST_LEADING = 'request_leading',
  VIEW_WORD = 'view_word',
  CHANGE_WORD = 'change_word',
}

// When user presses `I want to be lead` button
export const onRequestLeading: Mw = async function (ctx) {
  const { t, chat, from, callbackQuery } = ctx;
  if (!(chat && callbackQuery?.message && from)) return ctx.cbQueryError();

  // const game = games.retrieveByContext(ctx);
  const currentGame = await ctx.db.getGameByCtx(ctx);

  if (currentGame) {
    const { host_user_id, state } = currentGame;
    if (state === DbGameState.Pending) {
      return ctx.answerCbQuery(t('game_already_started_cb_answer'), {
        show_alert: true,
      });
    } else if (
      state === DbGameState.WinnerHold &&
      (host_user_id == null || host_user_id !== from.id)
    ) {
      return ctx.answerCbQuery(t('game_winning_cb_answer'), {
        show_alert: true,
      });
    }
  }

  const newGame = await createGame(ctx);
  if (newGame) {
    const { word } = newGame;
    return ctx.answerCbQuery(t('newgame_cb_answer', { word }), {
      show_alert: true,
    });
  }

  return ctx.cbQueryError();
};

export const onViewWord: Mw = async function (ctx) {
  const { callbackQuery, chat, from, t } = ctx;
  if (!(from && callbackQuery?.message && chat)) return;
  const game = await ctx.db.getGameByCtx(ctx);
  if (game && game.host_user_id === from.id) {
    return ctx.answerCbQuery(t('newgame_cb_answer', { word: game.word }), {
      show_alert: true,
    });
  } else {
    return ctx.answerCbQuery(t('restrict_word_cb_answer'), {
      show_alert: true,
    });
  }
};

export const onChangeWord: Mw = async function (ctx) {
  const { callbackQuery: { message } = {}, chat, from, t } = ctx;
  if (!(from && message && chat)) return;
  const game = await ctx.db.getGameByCtx(ctx);
  if (game && game.host_user_id === from.id) {
    const { word } = await randWord();
    await ctx.db.updateGameWord(game.id, word);
    return ctx.answerCbQuery(t('change_word_cb_answer', { word }), {
      show_alert: true,
    });
  } else {
    return ctx.answerCbQuery(t('restrict_word_cb_answer'), {
      show_alert: true,
    });
  }
};
