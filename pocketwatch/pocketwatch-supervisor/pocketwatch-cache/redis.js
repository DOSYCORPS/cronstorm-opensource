"use strict";
{
  const EC = {
    name: process.env.NODE_ENV !== 'dev' ? 
      'localhost' : 
      '<your redis endpoint here>',
    port: 6379
  };

  const Redis = require('redis');
  const bluebird = require('bluebird');
  bluebird.promisifyAll(Redis.RedisClient.prototype);
  bluebird.promisifyAll(Redis.Multi.prototype);

  let client;

  connect();

  const redis = client;

  const api = {
    see_interval, add_interval, remove_interval, get_missing_intervals,
    is_message_duplicate,
    add_origin,
    mark_for_deletion,
    is_marked_for_deletion,
    clear, 
    client
  };

  Object.assign( redis, api );

  module.exports = redis;

  function connect() {
    if ( !! client ) {
      client.end(true);
    }
    client = Redis.createClient(EC.port, EC.name, {retry_strategy});
  }

  function clear() {
    return redis.flushallAsync();
  }

  function is_marked_for_deletion( id ) {
    return redis.client.getAsync(`deleting:${id}`);
  }

  function mark_for_deletion( id, timer_delay = 1 ) {
    // notes on deletion
      // we set the key long enough for either our whole system to reboot 
      // 10 minutes is an overestimate
      // or for 3 intervals to pass
      // the idea is if we haven't see the timer for 3 intervals
      // then it is not coming back 
      // but if the delay is short
      // and our system goes down 
      // we might miss it and 
      // we need to wait at least until our system goes back to give us a chance to see
      // the timer
      // the weakness in this system is that we will not delete it if we purge redis
      // but we can fix that by writing to datastore as above
      // and then doing a deleteReconcile task 
      // looking for intervals that are marked for deletion but not yet deleted
      // or some other such mechansim
      // we want to keep any heavy lifting ( datastore writes ) out of the critical path
      // in timekeeper receive message
    return redis.client.setAsync(`deleting:${id}`,
      "OK", "EX", Math.max(600,2*timer_delay));
  }

  function is_message_duplicate( id, msg ) {
    return redis.getAsync( `messages:${id}` ).then( result => {
      if ( !! result ) {
        return true;
      } else {
        return redis.setAsync( `messages:${id}`, "OK", "EX", Math.max(30,msg.delay_seconds*3) ).then( result => false );
      }
    });
  }

  function see_interval( id ) {
    return remove_interval( id );
  }

  function has_origin( i ) {
    return redis.getAsync( `inserted:${i.keyName}` );
  }

  function add_origin( i ) {
    const originKey = `inserted:${i.keyName}`;
    const expire_time = Math.ceil(1.5*i.delay_seconds);
    return redis.setAsync( originKey, "OK", "EX", expire_time);
  }

  async function add_interval( i ) {
    const key = `interval:${i.keyName}`;
    const ji = JSON.stringify(i);
    const missing_timeout = 2*i.delay_seconds;
    const expire_timeout = Math.max(120,missing_timeout);
    const already_set = !! ( await redis.getAsync(key) );
    if ( ! already_set ) {
      await redis.setAsync( key, ji, "EX", expire_timeout );
      const currentTime = +new Date;
      const score = currentTime + missing_timeout*1000;
      await redis.zaddAsync('intervals',score,key);
      return `added:${key}`;
    } else {
      return `already_present_not_added:${key}`;
    }
  }

  function remove_interval( id ) {
    const key = `interval:${id}`;
    const originKey = `inserted:${id}`;
    return redis.delAsync( key ).then( 
      () => redis.zremAsync( 'intervals', key )
    ).then( 
      () => redis.delAsync( originKey )
    );
  }

  async function get_missing_intervals() {
    const currentTime = +new Date;
    const keys = await redis.zrangebyscoreAsync( 'intervals', 0, currentTime );
    if ( process.env.DEBUG == 'full' ) {
      console.log("\n");
      console.log(JSON.stringify({missingIntervalKeys:keys}));
    }
    let intervals = [];
    if ( keys.length ) {
      intervals = await redis
        .mgetAsync(...keys)
        .then(json_intervals => json_intervals
          .filter( ji => !! ji )
          .map( ji => JSON.parse(ji) )
        );
    }
    const intervals_to_insert = [];
    for ( const i of intervals ) {
      const has_o = await has_origin(i);
      const inserted = has_o == "OK";
      if ( ! inserted ) {
        intervals_to_insert.push( i ); 
      }
    }
    if ( process.env.DEBUG == 'full' ) {
      console.log("\n");
      console.log(JSON.stringify({intervals_to_insert}));
    }
    return intervals_to_insert;
  }

  function retry_strategy(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined;
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
}
