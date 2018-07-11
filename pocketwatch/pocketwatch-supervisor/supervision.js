"use strict";

{
  const enqueueSupervisorMessage = require('./enqueueSupervisorMessage.js');
  const redis = require('./pocketwatch-cache/redis.js');

  const tasks = {
    reconcileIntervals: {
      type: 'reconcileIntervals',
      delay_seconds: 7,
      keyName: 'reconcile_missing_intervals'
    },
    loadIntervals: {
      type: 'loadIntervals',
      delay_seconds: 11,
      keyName: 'load_live_intervals'
    }
  };

  const supervision = { 
    check, is_time_to_go_again, tasks 
  };

  module.exports = supervision;


  async function is_time_to_go_again(type) {
    const task = tasks[type];
    const lastTime = (await redis.client.getAsync(type)) || 0;
    const currentTime = +new Date;
    const secondsSinceLastTime = (currentTime - lastTime)/1000;
    if ( secondsSinceLastTime >= task.delay_seconds ) {
      return true;
    }
    return false;
  }

  async function check() {
    if ( await is_time_to_go_again('reconcileIntervals') ) {
      enqueueSupervisorMessage(tasks.reconcileIntervals);
    } 
    if ( await is_time_to_go_again('loadIntervals') ) {
      enqueueSupervisorMessage(tasks.loadIntervals);
    } 
  }
}
