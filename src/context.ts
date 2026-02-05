import { Logger } from "pino";
import { Context as GrammyContext } from "grammy";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./db/schema.js";

type ChatGame = typeof schema.game.$inferSelect;

export interface Context extends GrammyContext {
  log: Logger;
  db: NodePgDatabase<typeof schema>;
  // dbChatGame: typeof schema.game.$inferSelect | undefined;
  dbChat: typeof schema.chat.$inferSelect | undefined;
  getChatGame(): Promise<ChatGame | undefined>;
  _chatGameCached?: ChatGame;
}
