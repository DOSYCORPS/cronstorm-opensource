"use strict";
{
  const service = 'pw-web:';

  process.on('unhandledRejection', error => {
    const event = "Received unhandled promise rejection";
    error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
    console.log("\n");
    console.log(JSON.stringify({service,event,error}));
  });
  process.on('uncaughtException', error => {
    const event = "Received uncaught exception";
    error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
    console.log("\n");
    console.log(JSON.stringify({service,event,error}));
  });

  const keys = require('./stripeKeysSecret.js')[process.env.PAYMENTS == 'live' ? 'live' : 'test'];
  const redis = require('./pocketwatch-mechanism/pocketwatch-cache/redis.js');
  const ds = require('./pocketwatch-supervisor/gstore/ds.js');
  const stripe = require('stripe')(keys.secret);
  const path = require('path');
  const exp = require('express');
  const ba = require('express-basic-auth');
  const bodyParser = require('body-parser');
  const wrapAsync = require('./wrapAsync.js');
  const errors = require('./errors.js');
  const allowedKeys = require('./allowedKeys.js');
  const api = require('./api.js');
  const views = require('./views.js');
  const cost = require('./cost.js');

  stripe.setTimeout(20000);
  stripe.on('request', req => {
    //console.log(`Stripe request: ${JSON.stringify(req)}`);
  });
  stripe.on('response', res => {
    //console.log(`Stripe response: ${JSON.stringify(res)}`);
  })

  const app = exp();
  const port = process.env.PORT || 8080;

  app.use(bodyParser.urlencoded({extended:true}));
  app.use(bodyParser.json({extended:true}));

  app.get("/health", (req,res,next) => {
    res.end("OK");
  });

  app.get("/clear-pw-redis-cache-ALPHAGARDEN", wrapAsync(async (req,res,next) => {
    res.end(await redis.clear());
  }));

  app.get("/demo-functions/purge-timers", wrapAsync(async (req,res,next) => {
    const namespace = 'pocketwatch-gen-1';
    const kind = 'Interval';
    const {apiKey, maxDurationUnit, maxDurationCount} = req.query;
    if ( ! apiKey || ! maxDurationUnit || ! maxDurationCount ) {
      throw {code:400,message:`request for timer purge has incorrect parameters. #1`};
    }
    if ( ! cost.seconds[maxDurationUnit] ) {
      throw {code:400,message:`request for timer purge has incorrect parameters. #2`};
    }
    // get timers made with that key that were created more than
    // max duration time ago
    const maxDurationUnitSeconds = cost.seconds[maxDurationUnit];
    const currentTime = +new Date;
    const maxTimeAgo = currentTime - (maxDurationUnitSeconds * maxDurationCount * 1000);
    let timers_to_purge;
    let args = {namespace,kind,q: {
      lines: [
        {
          type: 'filter',
          prop: 'apiKey',
          op: '=',
          val: apiKey
        },
        {
          type: 'filter',
          prop: 'created_at',
          op: '<',
          val: maxTimeAgo
        }
      ]
    }};
    try {
      [timers_to_purge] = await ds.query(args);
    } catch(error) {
      const event = "Received error from ds.query";
      error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
      console.log("\n");
      console.log(JSON.stringify({service,event,error,args}));
      throw {code:400,message:'there was an error querying for timers to purge'};
    }
    // for each such timer, call redis mark for deletion
    // on its keyName
    const mark_for_deletion_results = await Promise.all(
      timers_to_purge.map(t => redis.mark_for_deletion(t.keyName, t.delay_seconds)));
    // and delete it from the database so it is not revived later by supervisor
    const delete_from_db_results = await Promise.all(
      timers_to_purge.map(t => ds.delete({namespace,kind,keyName:t.keyName})));
    res.end("OK");
  }));

  app.use(errors.log);
  app.use(errors.xhr);

  /**
  app.use(ba({
    challenge: true,
    realm: 'pocketwatch-999',
    users: {
      "dominate": "all situations"
    }
  }));
  **/

  app.use("/",exp.static(path.join(__dirname, "public")));

  app.post("/interval/purchase_flow", wrapAsync(async (req,res,next) => {
    switch( req.body.action ) {
      case "calculate_cost": {
        allowedKeys.is_valid(req.body,"timerInitial");
        const data = cost.calculate(req.body);
        res.type('html');
        res.end(views.costCalculated(data));
        break;
      }
      case "proceed_to_stripe_payment": {
        const data = cost.calculate(req.body);
        res.type('html');
        res.end(views.stripePayment(data));
        break;
      }
      case "verify_stripe_charge": {
        const data = cost.calculate(req.body);
        const charge = await stripe.charges.create({
          amount: data.usdCostCents,
          source: data.stripeToken,
          currency: 'usd',
          description: data.intervalDescription,
          statement_descriptor: '1 pocketwatch interval'
        });
        res.type('html');
        //console.log('charge', charge);
        if ( charge.status == 'succeeded' ) {
          allowedKeys.is_valid(data,"timerFinal");
          const result = await api.create_timer(data);
          console.log("Message data", data);
          //console.log("First enqueue result", result);
          res.end(views.successPayment(data));
        } else {
          res.end(views.error({message:charge.failure_message}));
        }
        break;
      }
      default:
        next();
    }
  }));

  app.use(errors.log);
  app.use(errors.html);
  app.use((req,res,next) => {
    res.status(404).send(views.errorView({message: 'Page not found'}));
  });

  const server = app.listen(port, () => console.log(`Server up at ${new Date()} on port ${port}`));

  server.on('clientError', (err,socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
}
