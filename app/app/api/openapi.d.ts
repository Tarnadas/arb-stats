/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

/** OneOf type helpers */
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;
type OneOf<T extends any[]> = T extends [infer Only]
  ? Only
  : T extends [infer A, infer B, ...infer Rest]
    ? OneOf<[XOR<A, B>, ...Rest]>
    : never;

export interface paths {
  '/info': {
    /** @description Returns latest indexed block height */
    get: {
      responses: {
        /** @description latest indexed block height */
        200: {
          content: {
            'application/json': {
              lastBlockHeight: number;
            };
          };
        };
      };
    };
  };
  '/bots/{bot_id}/daily/profit': {
    /** @description Returns daily arbitrage statistics. Can fetch at most 7 days. Keep date params empty to fetch latest data. */
    get: {
      parameters: {
        query?: {
          startDate?: string;
          endDate?: string;
          dates?: string;
        };
        path: {
          bot_id:
            | 'bot.marior.near'
            | 'bot0.marior.near'
            | 'bot2.marior.near'
            | 'bot3.marior.near'
            | 'bot4.marior.near'
            | 'bot5.marior.near'
            | 'bot6.marior.near'
            | 'aldor.near'
            | 'frisky.near'
            | 'sneaky1.near'
            | 'kagool.near'
            | 'zalevsky.near'
            | 'shitake.near'
            | 'drooling.near'
            | 'foxboss.near'
            | 'xy_k.near'
            | 'arb.brayo.near';
        };
      };
      responses: {
        /** @description daily arbitrage statistics */
        200: {
          content: {
            'application/json': {
              date: string;
              from: number;
              to: number;
              profits: string;
              profitsNear: string;
            }[];
          };
        };
        /** @description `startDate` and `endDate` are invalid */
        400: {
          content: {
            'text/plain': string;
          };
        };
        /** @description No data available */
        404: {
          content: never;
        };
        /** @description Unexpected server error */
        500: {
          content: never;
        };
      };
    };
  };
  '/bots/{bot_id}/daily/gas': {
    /** @description Returns daily gas usage. Can fetch at most 7 days. Keep date params empty to fetch latest data. */
    get: {
      parameters: {
        path: {
          bot_id:
            | 'bot.marior.near'
            | 'bot0.marior.near'
            | 'bot2.marior.near'
            | 'bot3.marior.near'
            | 'bot4.marior.near'
            | 'bot5.marior.near'
            | 'bot6.marior.near'
            | 'aldor.near'
            | 'frisky.near'
            | 'sneaky1.near'
            | 'kagool.near'
            | 'zalevsky.near'
            | 'shitake.near'
            | 'drooling.near'
            | 'foxboss.near'
            | 'xy_k.near'
            | 'arb.brayo.near';
        };
      };
      responses: {
        /** @description daily gas usage */
        200: {
          content: {
            'application/json': {
              date: string;
              from: number;
              to: number;
              gasBurnt: string;
              nearBurnt: string;
            }[];
          };
        };
        /** @description `startDate` and `endDate` are invalid */
        400: {
          content: {
            'text/plain': string;
          };
        };
        /** @description No data available */
        404: {
          content: never;
        };
        /** @description Unexpected server error */
        500: {
          content: never;
        };
      };
    };
  };
  '/bots/{bot_id}': {
    /** @description Returns all arbitrage trades filtered by success value */
    get: {
      parameters: {
        query: {
          status?: 'success' | 'failure';
          date: string;
        };
        path: {
          bot_id:
            | 'bot.marior.near'
            | 'bot0.marior.near'
            | 'bot2.marior.near'
            | 'bot3.marior.near'
            | 'bot4.marior.near'
            | 'bot5.marior.near'
            | 'bot6.marior.near'
            | 'aldor.near'
            | 'frisky.near'
            | 'sneaky1.near'
            | 'kagool.near'
            | 'zalevsky.near'
            | 'shitake.near'
            | 'drooling.near'
            | 'foxboss.near'
            | 'xy_k.near'
            | 'arb.brayo.near';
        };
      };
      responses: {
        /** @description arbitrage trades */
        200: {
          content: {
            'application/json': OneOf<
              [
                {
                  senderId: string;
                  blockHeight: number;
                  timestamp: number;
                  txHash: string;
                  gasBurnt: number;
                  profit: string;
                  /** @enum {string} */
                  status: 'success';
                },
                {
                  senderId: string;
                  blockHeight: number;
                  timestamp: number;
                  txHash: string;
                  gasBurnt: number;
                  /** @enum {string} */
                  status: 'failure';
                }
              ]
            >[];
          };
        };
        /** @description `limit` and `skip` search param must be an integer */
        400: {
          content: never;
        };
      };
    };
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {};
  responses: never;
  parameters: {};
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export type operations = Record<string, never>;
