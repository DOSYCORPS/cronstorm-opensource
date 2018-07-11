"use strict";
{
  const version = 'v1';
  const service = 'api';
  const TIMEOUT = 15000;

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

  const namespace = 'pocketwatch-gen-1';
  const kinds = {
    interval: 'Interval',
    subscription: 'Subscription'
  };

  const keys = require('./stripeKeysSecret.js')[process.env.PAYMENTS == 'live' ? 'live' : 'test'];
  const plans = require('./plans.js');
  const coupons = require('./coupons.js');
  const stripe = require('stripe')(keys.secret);
  const pw = require('./pocketwatch/api.js');
  const allowedKeys = require('./pocketwatch/allowedKeys.js');
  const demoAPIKeys = require('./demoAPIKeys.js');
  const cost = require('./pocketwatch/cost.js');
  const redis = require('./pocketwatch-cache/redis.js');
  const path = require('path');
  const exp = require('express');
  const ds = require('./gstore/ds.js');
  const bodyParser = require('body-parser');
  const wrapAsync = require('./wrapAsync.js');
  const errors = require('./errors.js');
  const views = require('./views.js');

  stripe.setTimeout(Math.ceil(3/5*TIMEOUT));
  stripe.on('request', stripeRequest => {
    console.log(JSON.stringify({stripeRequest}));
  });
  stripe.on('response', stripeResponse => {
    console.log(JSON.stringify({stripeResponse}));
  });

  const app = exp();
  const port = process.env.PORT || 8080;

  app.get("/health", (req,res,next) => {
    res.end("OK");
  });

  app.use(bodyParser.urlencoded({extended:true}));
  app.use(bodyParser.json({extended:true}));

  app.use((err,req,res,next) => {
    if ( err.type == 'entity.parse.failed' ) {
      throw {code:err.statusCode || 400, message: 'This request was incorrect JSON'};
    } else if ( err.type == 'entity.too.large' ) {
      throw {code:err.statusCode || 400, message: 'This request was too large'};
    }
    next(err);
  });

  app.use("/", exp.static(path.join(__dirname, "subscribe")));

  app.post("/subscription/purchase_flow", wrapAsync(async (req,res,next) => {
    switch( req.body.action ) {
      case "confirm_subscription": {
        const data = Object.assign({}, req.body);
        Object.assign( data, plans[data.plan_choice] );
        res.type('html');
        res.end(views.confirmSubscription(data));
        break;
      }
      case "proceed_to_stripe_payment": {
        const data = Object.assign({}, req.body);
        res.type('html');
        res.end(views.stripePayment(data));
        break;
      }
      case "verify_stripe_charge": {
        const data = Object.assign({}, req.body);
        const {coupon_name} = data;
        const customer = await stripe.customers.create({
          email: data.stripeEmail,
          source: data.stripeToken
        });
        if ( customer.object !== "customer" || ! customer.id ) {
          let error = customer;
          res.end(views.errorView({type:error.type,message:error.message}));
          break;
        }
        const subspec = {
          customer: customer.id,
          items: [
            {
              plan: plans.stripeId[data.plan_choice]
            }
          ]
        };
        if ( !!coupons[coupon_name] ) {
          subspec.coupon = coupons[coupon_name];
        }
        const subscription = await stripe.subscriptions.create(subspec);
        if ( subscription.object !== "subscription" || ! subscription.id ) {
          let error = subscription;
          res.end(views.errorView({type:error.type,message:error.message}));
          break;
        } else if ( !! subscription.discount && !! subscription.discount.coupon ) {
          const {percent_off} = subscription.discount.coupon;
          const amount_paid = Math.ceil(subscription.plan.amount * (100 - percent_off)/100.0);
          data.discount = true;
          data.amount_paid = (amount_paid/100).toFixed(2);
        }
        res.type('html');
        data.customerId = customer.id;
        data.subscriptionId = subscription.id;
        data.apiKey = ds.newRandom();
        data.used_timers = 0;
        data.used_hits = 0;
        const store_result = await ds.save({namespace,kind:kinds.subscription,data});
        data.keyName = store_result.keyName;
        res.end(views.successPayment(data));
        break;
      }
      default:
        next();
    }
  }));

  app.use((req,res,next) => {
    if ( ! req.body.apiKey ) {
      throw {code:404,message:"You must supply an API key with your request"};
    }
    next();
  });

  // API 
    // SUBSCRIPTIONS
      //CANCEL
      app.post(`/${version}/subscription/cancel`, wrapAsync(async (req,res,next) => {
        const {apiKey} = req.body;
        if ( demoAPIKeys.has(apiKey) ) {
          throw {code:403,message:"This demo API key is blocked from this endpoint"};
        }
        // get from ds
        const [subscriptions,info] = await ds.query({namespace,kind:kinds.subscription,
          q: {
            lines: [
              {
                type: 'filter',
                prop: 'apiKey',
                op: '=',
                val: apiKey
              }
            ]
          }
        });
        if ( subscriptions.length !== 1 ) {
          throw {code:401,message:`No such subscription with given API key`};
        }
        const sub = subscriptions[0];
        const {subscriptionId} = sub;
        // stripe command
        let result;
        try { 
          result = await stripe.subscriptions.del(subscriptionId+'a', {at_period_end:true});
        } catch(error) {
          const event = "Received error from stripe.subscription.del";
          error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
          console.log("\n");
          console.log(JSON.stringify({service,event,error}));
          throw {code:400,message:'there was an error deleting this subscription'};
        }
        // stripe timestamp is in seconds 
        const endsAt = 1000*(result.cancel_at_period_end ? 
          result.current_period_end : result.canceled_at);
        sub.canceled = true;
        sub.endsAt = endsAt;
        let store_result;
        try {
          store_result = await ds.update({namespace,kind:kinds.subscription,data:sub});
        } catch(error) {
          const event = "Received error from gstore/ds.update";
          error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
          console.log("\n");
          console.log(JSON.stringify({service,event,error}));
          throw {code:500,message:'something failed'};
        }
        const outcome = {action:'cancel',status:'success',endsAt};
        res.type("JSON").end(JSON.stringify(outcome));
      }));

    // KEYS
      //REFRESH
      app.post(`/${version}/key/refresh`, wrapAsync(async (req,res,next) => {
        // get from ds
        let {apiKey} = req.body;
        if ( demoAPIKeys.has(apiKey) ) {
          throw {code:403,message:"This demo API key is blocked from this endpoint"};
        }
        const [subscriptions,info] = await ds.query({namespace,kind:kinds.subscription,
          q: {
            lines: [
              {
                type: 'filter',
                prop: 'apiKey',
                op: '=',
                val: apiKey
              }
            ]
          }
        });
        if ( subscriptions.length !== 1 ) {
          throw {code:401,message:`No such subscription with given API key`};
        }
        const sub = subscriptions[0];
        // replace apiKey
        const oldKey = apiKey;
        sub.apiKey = ds.newRandom();
        apiKey = sub.apiKey;
        let store_result;
        try {
          store_result = await ds.update({namespace,kind:kinds.subscription,data:sub});
        } catch(error) {
          const event = "Received error from gstore/ds.update";
          error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
          console.log("\n");
          console.log(JSON.stringify({service,event,error}));
          throw {code:500,message:'something failed'};
        }
        let outcome = {action:'refresh',oldKey,apiKey,status:'success'};
        res.type("JSON").end(JSON.stringify(outcome));
      }));
    // TIMERS
      //CREATE
        app.post(`/${version}/job/new`, wrapAsync(async (req,res,next) => {
          allowedKeys.is_valid(req.body, "timerInitial");
          const data = cost.calculate(req.body);
          const {apiKey} = data;

          // find the subscription 
            let subscriptions;
            let args = {namespace,kind:kinds.subscription,
              q: {
                lines: [
                  {
                    type: 'filter',
                    prop: 'apiKey',
                    op: '=',
                    val: apiKey
                  }
                ]
              }
            };
            try {
              [subscriptions] = await ds.query(args);
            } catch(error) {
              const event = "Received error from timer/create ds.query";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: No such subscription with given API key`};
            }
            if ( subscriptions.length !== 1 ) {
              throw {code:401,message:`No such subscription with given API key`};
            }
            const sub = subscriptions[0];

          // check and account against subscription plan quotas
            const plan = plans[sub.plan_choice];
            // FIXME: 
              // we should also calculate the timers someone has live
              // but this is more complex let's do it later
              // since the restrictions really are about
              // how many timers can someone run at one time
            // FIXME:
              // This get and set needs to be a transaction 
            if ( sub.used_timers + 1 > plan.max_timers ) {
              throw {code:403,message:`This timer would put you over your timer quota.
                You have already used the maximum amount of timers for your plan for this
                billing cycle.`};
            }
            if ( sub.used_hits + data.interval_count > plan.max_hits ) {
              throw {code:403,message:`This timer's total hits ${data.interval_count} which 
                would put you over your hit quota for this billing cycle by ${Math.abs(plan.max_hits-(sub.used_hits+data.interval_count))} hits.`};
            }
            sub.used_timers += 1;
            const used_hits = Math.max(sub.used_hits,sub.used_hits+data.interval_count);
            if ( Number.isNaN(used_hits) ) {
              const event = "Received error from timer/new used_hits calculation";
              console.log("\n");
              console.log(JSON.stringify({service,event,sub,data}));
              throw {code:401,message:`Internal #2: error updating subscription quotas`};
            }
            sub.used_hits = used_hits;

          // update subscription quotas in db 
            args = {namespace,kind:kinds.subscription,data:sub};
            try {
              await ds.update(args);
            } catch(error) {
              const event = "Received error from timer/create ds.update";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: error updating subscription quotas`};
            }

          // create the timer 
            const { subscriptionId, customerId } = sub;
            Object.assign( data, {
              apiKey,
              plan: sub.plan_choice,
              subscriptionId, customerId
            });
            allowedKeys.is_valid(data, "timerFinal");
            let result;
            try {
              result = await pw.create_timer(data);
            } catch(error) {
              const event = "Received error from timer/create pw.create_timer";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: error creating timer`};
            }

          // report back 
            let outcome = {action:'create'};
            if ( result == 'success' ) {
              outcome.status = result; 
              outcome.job = {
                keyName: data.keyName
              };
            } else {
              outcome.status == 'failure';
            }
            res.type("JSON").end(JSON.stringify(outcome));
        }));

      //DELETE
        app.post(`/${version}/delete/job`, wrapAsync(async (req,res,next) => {
          const {apiKey, keyName} = req.body;
          if ( ! keyName ) {
            throw {code:400,message:`Provide a keyName`};
          }

          // find the subscription 
            let subscriptions;
            let args = {namespace,kind:kinds.subscription,
              q: {
                lines: [
                  {
                    type: 'filter',
                    prop: 'apiKey',
                    op: '=',
                    val: apiKey
                  }
                ]
              }
            };
            try {
              [subscriptions] = await ds.query(args);
            } catch(error) {
              const event = "Received error from timer/delete ds.query";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: No such subscription with given API key`};
            }
            if ( subscriptions.length !== 1 ) {
              throw {code:401,message:`No such subscription with given API key`};
            }
            const sub = subscriptions[0];

          // find the interval
            let intervals;
            args = {namespace,kind:kinds.interval,
              q: {
                lines: [
                  {
                    type: 'filter',
                    prop: 'keyName',
                    op: '=',
                    val: keyName
                  }
                ]
              }
            };
            try {
              [intervals] = await ds.query(args);
            } catch(error) {
              const event = "Received error from ds.query";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: No such subscription with given API key`};
            }
            if ( intervals.length !== 1 ) {
              throw {code:400,message:'No such timer with given keyName'};
            }
            const timer = intervals[0];

          // mark for deletion 
            let timer_delay = 1;
            if ( !! timer ) {
              timer_delay = timer.delay_seconds;
              timer.marked_for_deletion = true;
            }
            await redis.mark_for_deletion( keyName, timer_delay );

            args = {namespace,kind:kinds.interval,data:timer};
            try {
              await ds.update(args);
            } catch(error) {
              const event = "Received error from ds.update";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: Error updating timer for deletion`};
            }

          // add hits remaining back to sub
            const approximateHitsRemaining = cost.calculateApproximateHitsRemaining(timer);
            const used_hits = Math.max(0, sub.used_hits-approximateHitsRemaining);
            if ( Number.isNaN(used_hits) ) {
              const event = "Received error from delete/timer used_hits calculation";
              console.log("\n");
              console.log(JSON.stringify({service,event,sub,timer}));
              throw {code:401,message:`Internal #2: error updating subscription quotas`};
            }
            sub.used_hits = used_hits;
            args = {namespace,kind:kinds.subscription,data:sub};
            try {
              await ds.update(args);
            } catch(error) {
              const event = "Received error from ds.update";
              error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
              console.log("\n");
              console.log(JSON.stringify({service,event,error,args}));
              throw {code:401,message:`Internal: Error updating subscription quotas for timer deletion`};
            }

          // report back
            let outcome = {action:'delete',status:'success',keyName};
            res.type("JSON").end(JSON.stringify(outcome));
        }));

  app.use(errors.log);
  app.use((req,res,next) => {
    res.type('json').status(404).send(JSON.stringify({error: 'endpoint not found'}));
  });

  const server = app.listen(port, () => {
    const currentTime = new Date;
    const serverLive = `Server up at ${currentTime} on port ${port}. Timeout: ${TIMEOUT}`;
    console.log(JSON.stringify({serverLive,timeout:TIMEOUT,port,currentTime}));
    return true;
  });

  server.setTimeout(TIMEOUT);

  module.exports = server;
}
