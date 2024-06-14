import { z } from '@hono/zod-openapi';

export const zArbitrage = z.object({
  senderId: z.string(),
  blockHeight: z.number(),
  timestamp: z.number(),
  txHash: z.string(),
  gasBurnt: z.number(),
  profit: z.string()
});
export type Arbitrage = z.infer<typeof zArbitrage>;

export const zodBatchEvent = z
  .object({
    blockHeight: z.number(),
    timestamp: z.number(),
    events: z
      .discriminatedUnion('status', [
        z.object({
          senderId: z.string(),
          txHash: z.string(),
          gasBurnt: z.number(),
          profit: z.string(),
          status: z.literal('success')
        }),
        z.object({
          senderId: z.string(),
          txHash: z.string(),
          gasBurnt: z.number(),
          status: z.literal('failure')
        })
      ])
      .array()
  })
  .array();

export type BatchEvent = z.infer<typeof zodBatchEvent>;
