import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';

import { Arbitrage, zodBatchEvent } from './events';

export const batch = new Hono();
batch
  .use('*', async (c, next) => {
    const auth = bearerAuth({ token: c.env.INDEXER_SECRET });
    await auth(c, next);
  })
  .post(
    '',
    zValidator('json', zodBatchEvent, result => {
      if (result.success) return;
      console.info(result.error.errors);
    }),
    async c => {
      const batchEvents = c.req.valid('json');

      for (const batchEvent of batchEvents) {
        console.info(
          `[${new Date().toLocaleString()}] block_height ${batchEvent.blockHeight}`
        );

        const infoAddr = c.env.INFO.idFromName('');
        const infoStub = c.env.INFO.get(infoAddr);
        const botsAddr = c.env.BOTS.idFromName('');
        const botsStub = c.env.BOTS.get(botsAddr);

        await infoStub.fetch(`${new URL(c.req.url).origin}/last_block_height`, {
          method: 'POST',
          body: String(batchEvent.blockHeight)
        });

        const allSenders = new Set<string>();
        for (const event of batchEvent.events) {
          allSenders.add(event.senderId);
        }

        for (const senderId of allSenders) {
          const successEvents = batchEvent.events
            .filter(event => event.senderId === senderId)
            .filter(event => event.status === 'success')
            .map(
              event =>
                ({
                  senderId: event.senderId,
                  txHash: event.txHash,
                  profit: (event as Arbitrage).profit
                }) as Arbitrage
            );

          try {
            await new Promise<void>((resolve, reject) => {
              console.info(successEvents);

              awaitResponse(
                botsStub.fetch(
                  `${new URL(c.req.url).origin}/${encodeURI(senderId)}`,
                  {
                    method: 'POST',
                    body: JSON.stringify(successEvents)
                  }
                ),
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

          // TODO track gas fee for failure
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
