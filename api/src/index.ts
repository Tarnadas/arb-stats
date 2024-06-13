import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { poweredBy } from 'hono/powered-by';
import { match } from 'ts-pattern';

import { batch } from './batch';
import { bots } from './bots';
import { info } from './info';

const app = new Hono();

app.use('*', poweredBy());
app.use('*', cors());

app.route('/info', info);
app.route('/bots', bots);
app.route('/batch', batch);

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

export { Bots } from './bots';
export { Info } from './info';
