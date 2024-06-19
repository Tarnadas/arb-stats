import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { cors } from 'hono/cors';
import { poweredBy } from 'hono/powered-by';
import { match } from 'ts-pattern';

import { batch } from './batch';
import { bots } from './bots';
import { info } from './info';

extend(utc);

const app = new OpenAPIHono();

app.use('*', poweredBy());
app.use('*', cors());

app.route('/info', info);
app.route('/bots', bots);
app.route('/batch', batch);

app.get('/', swaggerUI({ url: '/doc' }));

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Arbitrage Bot Stats API'
  }
});

app.onError(
  err =>
    new Response(null, {
      status: match(err.message)
        .with('Unauthorized', () => 401 as const)
        .with('Bad Request', () => 400 as const)
        .otherwise(() => {
          throw err;
        })
    })
);

app.notFound(() => {
  return new Response(null, { status: 404 });
});

export default app;

export { Bots, BotIds, DailyGasStats, DailyProfitStats } from './bots';
export { Info } from './info';
