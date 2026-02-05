import { type Kysely, sql } from 'kysely';
import { type Chat, type Message, type User } from 'telegraf/types';
import { type Context } from 'telegraf';

import type { DB } from './db.generated.js';

type GameId = string;

export enum DbGameState {
  Pending = 1,
  WinnerHold = 2,
  Completed = 3,
}

type CreateGameDto = {
  chatId: number;
  threadId: number | undefined;
  hostUserId: number;
  word: string;
  gameMessageId: number;
};

export class Store {
  constructor(public kysely: Kysely<DB>) {}

  public saveChat(chat: Chat.GroupChat | Chat.SupergroupChat) {
    const row = {
      id: chat.id,
      title: chat.title,
      username: 'username' in chat ? chat.username : undefined,
      word_dict: 'legacy',
    };
    return this.kysely
      .insertInto('chat')
      .values(row)
      .onConflict((cb) => cb.columns(['id']).doUpdateSet(row))
      .execute();
  }

  public saveChatMember(chat: Chat, user: User) {
    return this.kysely
      .insertInto('chat_member')
      .values({
        chat_id: chat.id,
        user_id: user.id,
      })
      .onConflict((cb) => cb.doNothing())
      .execute();
  }

  public saveUser(user: User) {
    const row = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
    };
    return this.kysely
      .insertInto('user')
      .values(row)
      .onConflict((cb) => cb.columns(['id']).doUpdateSet(row))
      .execute();
  }

  public async getExpiredGames() {
    const pending = await this.kysely
      .updateTable('game')
      .set({ state: DbGameState.Completed })
      .where('game.state', '=', DbGameState.Pending)
      .where(
        sql<boolean>`now() >= game.created_at + (interval'1s' * chat.game_duration_seconds)`,
      )
      .returning(['game.id'])
      .execute();

    const winHold = await this.kysely
      .updateTable('game')
      .set({ state: DbGameState.Completed })
      .where('game.state', '=', DbGameState.WinnerHold)
      .where(
        sql<boolean>`now() >= game.win_at + (interval'1s' * chat.win_hold_duration_seconds)`,
      )
      .returning(['game.id'])
      .execute();

    return { pending, winHold };

    // const expirationWhereClause = sql<boolean>`now() >= game.created_at + (chat.game_duration_seconds * interval'1s')`;
    // const isWinHoldExpr = sql<boolean>`now() >= game.created_at + (chat.game_duration_seconds + chat.win_hold_duration_seconds) * interval '1s'`;
    // return (
    //   this.kysely
    //     .updateTable('game')
    //     // .set(eb => ({
    //     //   checked: true
    //     // })
    //     // .set(sql`checked = true`)
    //     .set({ checked: true })
    //     .from('chat')
    //     .where('game.chat_id', '=', 'chat.id')
    //     .where(
    //       sql<boolean>`now() >= game.created_at + (chat.game_duration_seconds * interval'1s')`,
    //     )
    //     .where()
    //     // .where(expirationWhereClause)
    //     // .where('game.checked', '=', false)
    //     .returning([
    //       'game.id',
    //       'game.created_at',
    //       isWinHoldExpr.as('is_win_hold'),
    //     ])
    //     .execute()
    // );
  }

  // public getGame(chatId: number, threadId?: number) {
  //   let q = this.kysely
  //     .selectFrom('game')
  //     .where('chat_id', '=', chatId.toString());
  //   if (threadId !== undefined) {
  //     q = q.where('thread_id', '=', threadId.toString());
  //   }
  //   return q.selectAll().executeTakeFirst();
  // }

  public getGlobalRating() {
    const winCountExpr = sql<number>`count(game.id)`;
    return this.kysely
      .selectFrom('user')
      .innerJoin('game', 'game.winner_user_id', 'user.id')
      .selectAll('user')
      .select(winCountExpr.as('win_count'))
      .groupBy('user.id')
      .orderBy(winCountExpr, 'desc')
      .limit(8)
      .execute();
  }

  public getChatRating(chatId: number) {
    const winCountExpr = sql<number>`count(game.id)`;
    return this.kysely
      .selectFrom('game')
      .innerJoin('user', 'user.id', 'game.winner_user_id')
      .innerJoin('chat_member', 'chat_member.user_id', 'user.id')
      .selectAll('user')
      .select(winCountExpr.as('win_count'))
      .where('chat_member.chat_id', '=', chatId.toString())
      .groupBy('user.id')
      .orderBy(winCountExpr, 'desc')
      .limit(8)
      .execute();
  }

  public getGameByCtx<C extends Context>(ctx: C) {
    if (!ctx.chat) return;
    let threadId: number | undefined;
    if (ctx.callbackQuery) {
      threadId = ctx.callbackQuery.message?.message_thread_id;
    } else {
      threadId = ctx.message?.message_thread_id;
    }
    return this.getGame(ctx.chat.id, threadId);
  }

  public async getGame(chatId: number, threadId: number | undefined) {
    // const isPendingExpr = sql<boolean>`now() < game.created_at + (chat.game_duration_seconds * interval'1s')`;
    // const isWinningExpr = sql<boolean>`
    //   now() >= (game.created_at + chat.game_duration_seconds) * interval'1s'
    //   and now() < (game.created_at + chat.game_duration_seconds + chat.win_hold_duration_seconds) * interval'1s'`;
    // TODO: check if there is actually a single game for the chat/thread in
    // either Pending or WinnerHold state
    let dbRow = await this.kysely
      .selectFrom('game')
      .innerJoin('chat', 'chat.id', 'game.chat_id')
      .selectAll('game')
      .where('game.state', 'in', [DbGameState.Pending, DbGameState.WinnerHold])
      .where('game.chat_id', '=', chatId.toString())
      .$if(threadId !== undefined, (qb) =>
        qb.where('thread_id', '=', threadId!.toString()),
      )
      .executeTakeFirst();
    if (!dbRow) return dbRow;
    return {
      ...dbRow,
      chat_id: parseInt(dbRow.chat_id),
      host_user_id: parseInt(dbRow.host_user_id),
      winner_user_id:
        dbRow.winner_user_id != null
          ? parseInt(dbRow.winner_user_id)
          : undefined,
      thread_id:
        dbRow.thread_id != null ? parseInt(dbRow.thread_id) : undefined,
    };
  }

  public updateGameWord(gameId: GameId, word: string) {
    return this.kysely
      .updateTable('game')
      .set({ word })
      .where('game.id', '=', gameId)
      .execute();
  }

  public createGame(dto: CreateGameDto) {
    return this.kysely
      .insertInto('game')
      .values({
        chat_id: dto.chatId,
        thread_id: dto.threadId,
        word: dto.word,
        game_message_id: dto.gameMessageId,
        host_user_id: dto.hostUserId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  public setGameWinner(gameId: GameId, user: User, endMessage: Message) {
    return this.kysely
      .updateTable('game')
      .where('id', '=', gameId)
      .set({
        winner_user_id: user.id,
        win_at: sql`now()`,
        state: DbGameState.WinnerHold,
        game_end_message_id: endMessage.message_id,
      })
      .execute();
  }
}
