import { Mw } from './types';
import { randWord } from './wordGen';
import { createGame, GameState } from './game';

export enum Action {
  REQUEST_LEADING = 'request_leading',
  VIEW_WORD = 'view_word',
  CHANGE_WORD = 'change_word',
}

// When user presses `I want to be lead` button
export const onRequestLeading: Mw = async function (ctx) {
  const { t, games, chat, callbackQuery: { from } = {} } = ctx;
  if (!(chat && from)) return ctx.cbQueryError();

  const game = games.get(chat.id);

  if (game) {
    if (game.gameState === GameState.PENDING) {
      return ctx.answerCbQuery(t('game_already_started_cb_answer'), true);
    }
    if (game.gameState === GameState.WINNING && game.winner?.id !== from.id) {
      return ctx.answerCbQuery(t('game_winning_cb_answer'), true);
    }
  }

  const newGame = await createGame(ctx, ctx.from!)!;
  if (newGame) {
    const { word } = newGame;
    return ctx.answerCbQuery(t('newgame_cb_answer', { word }), true);
  }

  return ctx.cbQueryError();
};

export const onViewWord: Mw = async function (ctx) {
  const { callbackQuery: { message } = {}, chat, from, games, t } = ctx;
  if (!(from && message && chat)) return;
  const game = games.get(chat.id);
  if (game?.leader.id === from.id) {
    return ctx.answerCbQuery(t('newgame_cb_answer', { word: game.word }), true);
  } else {
    return ctx.answerCbQuery(t('restrict_word_cb_answer'), true);
  }
};

export const onChangeWord: Mw = async function (ctx) {
  const { callbackQuery: { message } = {}, chat, from, games, t } = ctx;
  if (!(from && message && chat)) return;
  const game = games.get(chat.id);

  if (game?.leader.id === from.id) {
    const { word } = await randWord();
    game.word = word;
    games.set(chat.id, game);
    return ctx.answerCbQuery(t('change_word_cb_answer', { word }), true);
  } else {
    return ctx.answerCbQuery(t('restrict_word_cb_answer'), true);
  }
};
