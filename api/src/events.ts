import { z } from 'zod';

const zodArbitrage = z.object({
  senderId: z.string(),
  txHash: z.string(),
  profit: z.string()
});
export type Arbitrage = z.infer<typeof zodArbitrage>;

export const zodBatchEvent = z
  .object({
    blockHeight: z.number(),
    timestamp: z.number(),
    events: z
      .discriminatedUnion('status', [
        z.object({
          senderId: z.string(),
          txHash: z.string(),
          profit: z.string(),
          status: z.literal('success')
        }),
        z.object({
          senderId: z.string(),
          txHash: z.string(),
          status: z.literal('failure')
        })
      ])
      .array()
  })
  .array();

export type BatchEvent = z.infer<typeof zodBatchEvent>;
