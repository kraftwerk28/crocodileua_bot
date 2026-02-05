import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { drizzle } from "drizzle-orm/node-postgres";
import { pino } from "pino";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createServer } from "node:http";
import * as v from "valibot";

import { Context } from "./context.js";
import * as schema from "./db/schema.js";
import { takeFirst, takeFirstOrThrow } from "./db/utils.js";

const log = pino({
  level: "debug",
});

async function main() {
  const env = v.parse(
    v.object({
      BOT_TOKEN: v.string(),
      DATABASE_URL: v.string(),
      NODE_ENV: v.picklist(["development", "production"]),
    }),
    process.env,
  );

  const bot = new Bot<Context>(env.BOT_TOKEN);

  const db = drizzle({
    connection: process.env.DATABASE_URL!,
    schema,
  });

  async function getChatGame(this: Context) {
    if (!this.chat) return;
    this._chatGameCached = await this.db
      .select()
      .from(schema.game)
      .where(
        and(
          eq(schema.game.chat_id, this.chat.id),
          sql`now() < ${schema.game.expires_at}`,
          isNull(schema.game.winner_user_id),
        ),
      )
      .orderBy(desc(schema.game.created_at))
      .limit(1)
      .then(takeFirst);
    return this._chatGameCached;
  }

  bot.use(async (ctx) => {
    const logMixin = {} as Record<string, any>;
    if (ctx.chat) {
      logMixin.chat = { id: ctx.chat.id, title: ctx.chat.title };
    }
    if (ctx.from) {
      logMixin.from = {
        id: ctx.from.id,
        first_name: ctx.from.first_name,
        username: ctx.from.username,
      };
    }
    if (ctx.msg) {
      logMixin.msg = {
        id: ctx.msg.message_id,
        thread_id: ctx.msg.message_thread_id,
      };
    }
    ctx.log = log.child(logMixin);
    ctx.db = db;
    ctx.getChatGame = getChatGame;
  });

  bot.chatType("private").command("start", async (ctx) => {
    const startParam = `pm-${ctx.from.id}`;
    const kbd = new InlineKeyboard();
    kbd.url("Додати в чат", `https://t.me/${ctx.me}?startgroup=${startParam}`);
    return ctx.reply(
      "Я працюю лише в групах. Додай мене в одну з них, щоб розпочати гру!",
      { link_preview_options: { is_disabled: true }, reply_markup: kbd },
    );
  });

  bot.chatType(["group", "supergroup"]).on("message", async (ctx, next) => {
    ctx.dbChat = await ctx.db
      .insert(schema.chat)
      .values({
        id: ctx.chat.id,
        title: ctx.chat.title,
        username: ctx.chat.username,
      })
      .onConflictDoUpdate({
        target: schema.chat.id,
        set: {
          username: ctx.chat.username,
          title: ctx.chat.title,
        },
      })
      .returning()
      .then(takeFirst);

    const partialUser: Omit<typeof schema.user.$inferInsert, "id"> = {
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
    };
    await ctx.db
      .insert(schema.user)
      .values({ id: ctx.from.id, ...partialUser })
      .onConflictDoUpdate({ target: schema.user.id, set: partialUser });

    return next();
  });

  bot.chatType(["group", "supergroup"]).command("start", async (ctx, next) => {
    if (!ctx.dbChat) return next();

    const pmUserId = ctx.match.match(/^pm-(.*)$/)?.[1];
    if (pmUserId) {
      ctx.log.info(
        { user_id: parseInt(pmUserId) },
        "Added bot from private messages",
      );
    }

    if (await ctx.getChatGame()) {
      return;
    }

    const keyboard = new InlineKeyboard([
      [
        InlineKeyboard.text("Prev word", "game:prev_word"),
        InlineKeyboard.text("Current word", "game:get_word"),
        InlineKeyboard.text("Next word", "game:next_word"),
      ],
    ]);
    const gameMessage = await ctx.reply(`New game!`, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    const gameDuration = ctx.dbChat.game_duration_s;
    await ctx.db.transaction(async (tx) => {
      const { word } = await tx
        .select()
        .from(schema.word)
        .where(eq(schema.chat.dictionary_id, schema.word.dictionary_id))
        .orderBy(sql`random()`)
        .limit(1)
        .then(takeFirstOrThrow);

      const game = await tx
        .insert(schema.game)
        .values({
          chat_id: ctx.chat.id,
          expires_at: sql`now() + interval '1s' * ${gameDuration}`,
          game_message_id: gameMessage.message_id,
          leader_user_id: ctx.from.id,
          current_word: word,
        })
        .returning()
        .then(takeFirstOrThrow);

      await tx.insert(schema.wordHistory).values({ game_id: game.id, word });
    });
    // TODO: start a game
  });

  const keyboardComposer = bot
    .chatType(["group", "supergroup"])
    .callbackQuery(/^game:/, async (ctx, next) => {
      await next();
      // TODO: update the keyboard
      return ctx.answerCallbackQuery("An unexpected error occured");
    });

  keyboardComposer.callbackQuery("game:prev_word", async (ctx, next) => {
    const game = await ctx.getChatGame();
    if (!game) return next();
    const lastWords = await ctx.db
      .select()
      .from(schema.wordHistory)
      .where(eq(schema.wordHistory.game_id, game.id))
      .orderBy(desc(schema.wordHistory.created_at))
      .limit(2);
    if (lastWords.length < 2) return next(); // Invalid
    const currentWord = lastWords[0]!;
    const prevWord = lastWords[1]!;
    await ctx.db
      .delete(schema.wordHistory)
      .where(eq(schema.wordHistory.id, currentWord.id));
    await ctx.answerCallbackQuery({
      text: `Your word is ${prevWord.word}.`,
      show_alert: true,
    });
    return next();
  });

  keyboardComposer.callbackQuery("game:next_word", async (ctx, next) => {
    const game = await ctx.getChatGame();
    if (!game) return next();
    const { word } = await ctx.db
      .select()
      .from(schema.word)
      .where(eq(schema.chat.dictionary_id, schema.word.dictionary_id))
      .orderBy(sql`random()`)
      .limit(1)
      .then(takeFirstOrThrow);
    await ctx.db.insert(schema.wordHistory).values({ game_id: game.id, word });
    return ctx.answerCallbackQuery({
      text: `Your word is ${word}.`,
      show_alert: true,
    });
  });

  keyboardComposer.callbackQuery("game:get_word", async (ctx, next) => {
    const game = await ctx.getChatGame();
    if (!game) return next();
    const { word } = await ctx.db
      .select()
      .from(schema.wordHistory)
      .where(eq(schema.wordHistory.game_id, game.id))
      .orderBy(desc(schema.wordHistory.created_at))
      .limit(1)
      .then(takeFirstOrThrow);
    return ctx.answerCallbackQuery({
      text: `Твоє слово: ${word}`,
      show_alert: true,
    });
  });

  bot.chatType(["group", "supergroup"]).command("rules", async () => {
    // TODO: explain the game
  });

  bot.api.config.use(async (prev, method, payload, signal) => {
    const result = await prev(method, payload, signal);
    log.debug({ method, payload, result }, "API call");
    return result;
  });

  if (env.NODE_ENV === "development") {
    log.info("Starting in polling mode...");
    await bot.start({ timeout: 10 });
    // Unreachable
  } else {
    const wcb = webhookCallback(bot, "http");
    createServer(wcb).listen({ port: 1234 });
  }
}

main().catch((err) => log.error(err));
