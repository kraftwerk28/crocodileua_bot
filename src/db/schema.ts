import {
  index,
  pgTable,
  text,
  timestamp,
  bigserial,
  bigint,
  integer,
} from "drizzle-orm/pg-core";

const telegramId = () => bigint({ mode: "number" });

export const chat = pgTable("chat", {
  id: telegramId().primaryKey(),
  username: text(),
  title: text(),
  game_duration_s: integer()
    .notNull()
    .default(60 * 5),
  winner_hold_duration_s: integer().notNull().default(5),
  dictionary_id: text().notNull().default("default"),
});

export const user = pgTable("user", {
  id: telegramId().primaryKey(),
  first_name: text().notNull(),
  last_name: text(),
  username: text(),
  legacy_win_count: integer().notNull().default(0),
});

export const game = pgTable(
  "game",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    chat_id: telegramId()
      .notNull()
      .references(() => chat.id),
    thread_id: telegramId(),
    leader_user_id: telegramId()
      .notNull()
      .references(() => user.id),
    created_at: timestamp().notNull().defaultNow(),
    expires_at: timestamp().notNull(),
    completed_at: timestamp(),
    winner_user_id: telegramId().references(() => user.id),
    cooldowns_at: timestamp(),
    current_word: text(),
    game_message_id: telegramId().notNull(),
  },
  (tbl) => [index().on(tbl.created_at)],
);

export const wordHistory = pgTable("word_history", {
  id: bigserial({ mode: "number" }).primaryKey(),
  game_id: telegramId()
    .notNull()
    .references(() => game.id),
  word: text().notNull(),
  created_at: timestamp().notNull().defaultNow(),
});

export const word = pgTable("word", {
  id: bigserial({ mode: "number" }).primaryKey(),
  word: text().notNull(),
  dictionary_id: text().notNull(),
});
