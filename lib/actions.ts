import { Mw } from './context';
import { randWord } from './wordGen';
import { createGame, GameState } from './game';

export enum Action {
  REQUEST_LEADING = 'request_leading',
  VIEW_WORD = 'view_word',
  CHANGE_WORD = 'change_word',
}

// When user presses `I want to be lead` button
export const onRequestLeading: Mw = async function (ctx) {
  const { t, games, chat, from, callbackQuery } = ctx;
  if (!(chat && callbackQuery?.message && from)) return ctx.cbQueryError();

  const game = games.retrieveByContext(ctx);

  if (game) {
    if (game.gameState === GameState.PENDING) {
      return ctx.answerCbQuery(t('game_already_started_cb_answer'), {
        show_alert: true,
      });
    }
    if (game.gameState === GameState.WINNING && game.winner?.id !== from.id) {
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
  const { callbackQuery, chat, from, games, t } = ctx;
  if (!(from && callbackQuery?.message && chat)) return;
  const game = games.retrieveByContext(ctx);
  if (game?.leader.id === from.id) {
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
  const { callbackQuery: { message } = {}, chat, from, games, t } = ctx;
  if (!(from && message && chat)) return;
  const game = games.retrieveByContext(ctx);

  if (game?.leader.id === from.id) {
    const { word } = await randWord();
    game.word = word;
    games.putByContext(game, ctx);
    return ctx.answerCbQuery(t('change_word_cb_answer', { word }), {
      show_alert: true,
    });
  } else {
    return ctx.answerCbQuery(t('restrict_word_cb_answer'), {
      show_alert: true,
    });
  }
};
