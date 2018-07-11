"use strict";

{
  const enqueueMechanismMessage = require('./pocketwatch-mechanism/enqueueMessage.js');
  const ds = require('./gstore/ds.js');
  const redis = require('./pocketwatch-cache/redis.js');
  const supervision = require('./supervision.js');

  const namespace = 'pocketwatch-gen-1';
  const kind = 'Interval';

  const functions = {
    load_live_intervals, reinsert_missing_intervals 
  };

  module.exports = functions;

  async function load_live_intervals() {
    const currentTime = +new Date;
    await redis.client.setAsync(supervision.tasks.loadIntervals.type, currentTime);
    const q = {
      lines: [
        {
          type: 'filter',
          prop: 'will_end_after',
          op: '>',
          val: currentTime
        },
        { 
          type: 'filter',
          prop: 'marked_for_deletion',
          op: '=',
          val: false
        }
      ]
    }
    const load_results = await ds.query({namespace,kind,q}).then( ([results,info]) => {
      if ( process.env.DEBUG == 'full' ) {
        console.log("\n");
        console.log(
          JSON.stringify({
            count:results.length,
            currentTime,
            liveIntervals:results.map(i => i.keyName)
          }));
      }
      return Promise.all( results.map( i => redis.add_interval( i ) ) ); 
    });
    if ( process.env.DEBUG == 'full' ) {
      console.log("\n");
      console.log({load_results,currentTime});
    }
    return load_results;
  }

  async function reinsert_missing_intervals() {
    const currentTime = +new Date;
    const task = supervision.tasks.reconcileIntervals;
    return redis.get_missing_intervals().then( async intervals => {
      await redis.client.setAsync(task.type, currentTime);
      if ( process.env.DEBUG == 'full' ) {
        console.log("\n");
        console.log({missing_intervals:intervals.map( i => i.keyName )});
      }
      return Promise.all(intervals.map(message => {
        message.being_reinserted = true;
        if ( process.env.DEBUG == 'full' ) {
          const {keyName} = message;
          console.log("\n");
          console.log(
            JSON.stringify({reinserting:{keyName}}));
        }
        return enqueueMechanismMessage(message);
      }));
    });
  }
}
