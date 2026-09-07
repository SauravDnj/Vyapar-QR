import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { JsonDbClient } from '../jsondb';

/**
 * The application's database handle.
 *
 * Despite the name — kept so the 41 services injecting it need no edits — this
 * is no longer Prisma/MySQL. It is the JSON-document engine in `src/jsondb`,
 * which implements the same delegate API (`db.user.findMany(...)`) over one
 * JSON file per model. Storage is chosen by `JSONDB_DRIVER`: local files for
 * dev and VPS, Vercel Blob on Vercel, where the filesystem is read-only.
 *
 * The `JsonDbDelegates` interface is what gives call sites their types; the
 * delegates themselves are installed on the instance by `JsonDbClient`'s
 * constructor.
 */
@Injectable()
export class PrismaService
  extends JsonDbClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      `JSON database ready (driver: ${this.store.driverName}, ${String(this.schema.models.size)} models)`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
