import { OpenAPIHono } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { bearerAuth } from 'hono/bearer-auth';

import { Arbitrage, zodBatchEvent } from './events';

export const batch = new OpenAPIHono();
batch
  .use('*', async (c, next) => {
    const auth = bearerAuth({ token: c.env.INDEXER_SECRET });
    await auth(c, next);
  })
  .delete('', async c => {
    console.info('clearing old data...');
    const botIdsAddr = c.env.BOT_IDS.idFromName('');
    const botIdsStub = c.env.BOT_IDS.get(botIdsAddr);
    const res = await botIdsStub.fetch(`${new URL(c.req.url).origin}`);
    const botIds = await res.json<string[]>();
    await Promise.all(
      botIds.map(botId => {
        const addr = c.env.BOTS.idFromName(botId);
        const obj = c.env.BOTS.get(addr);
        return obj.fetch(`${new URL(c.req.url).origin}`, {
          method: 'DELETE'
        });
      })
    );
    console.info('clearing finished');
    return new Response(null, { status: 204 });
  })
  .post(
    '',
    zValidator('json', zodBatchEvent, result => {
      if (result.success) return;
      console.info(result.error.errors);
    }),
    async c => {
      const batchEvents = c.req.valid('json');

      const blockHeight = batchEvents[batchEvents.length - 1].blockHeight;
      console.info(
        `[${new Date().toLocaleString()}] block_height ${blockHeight}`
      );

      const infoAddr = c.env.INFO.idFromName('');
      const infoStub = c.env.INFO.get(infoAddr);
      const botIdsAddr = c.env.BOT_IDS.idFromName('');
      const botIdsStub = c.env.BOT_IDS.get(botIdsAddr);

      const res = await infoStub.fetch(
        `${new URL(c.req.url).origin}/last_block_height`,
        {
          method: 'POST',
          body: String(blockHeight)
        }
      );
      if (!res.ok) {
        return new Response(null, { status: 400 });
      }

      const allSenders = new Set<string>();
      for (const batchEvent of batchEvents) {
        for (const event of batchEvent.events) {
          allSenders.add(event.senderId);
        }
      }
      await botIdsStub.fetch(`${new URL(c.req.url).origin}`, {
        method: 'POST',
        body: JSON.stringify(Array.from(allSenders))
      });

      for (const senderId of allSenders) {
        const events = batchEvents
          .flatMap(({ blockHeight, timestamp, events }) =>
            events.map(event => ({ blockHeight, timestamp, ...event }))
          )
          .filter(event => event.senderId === senderId);
        if (events.length === 0) {
          continue;
        }

        try {
          await new Promise<void>((resolve, reject) => {
            console.info(
              `[${new Date().toLocaleString()}] Indexing ${
                events.length
              } events for ${senderId}`
            );

            const botsAddr = c.env.BOTS.idFromName(senderId);
            const botsStub = c.env.BOTS.get(botsAddr);

            awaitResponse(
              botsStub.fetch(`${new URL(c.req.url).origin}`, {
                method: 'POST',
                body: JSON.stringify(events satisfies Arbitrage[])
              }),
              reject
            )
              .then(resolve)
              .catch(reject);
          });
        } catch (err) {
          if (err instanceof Response) {
            return err;
          } else {
            console.error(`Unexpected error: ${err}`);
          }
        }
      }

      return new Response(null, { status: 204 });
    }
  );

async function awaitResponse(
  promise: Promise<Response>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void
) {
  try {
    const res = await promise;
    if (!res.ok) {
      rejectWithError(res, reject);
      return;
    }
  } catch (err) {
    rejectWithError(new Response('', { status: 500 }), reject);
  }
}

async function rejectWithError(
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void
) {
  console.error(
    `Response from ${res.url} returned error: [${
      res.status
    }] ${await res.text()}`
  );
  reject(new Response(null, { status: 500 }));
}
