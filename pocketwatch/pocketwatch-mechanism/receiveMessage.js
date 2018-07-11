"use strict";
{
  const redis = require('./pocketwatch-cache/redis.js');
  const performTask = require('./performTask.js');
  const enqueueMessage = require('./enqueueMessage.js');
  const MAX = 660; // 11 * 60 ( 11 minutes in seconds ) 
  const warning = "TIMEKEEPER RECEIVE MESSAGE WARNING";

  module.exports = receiveMessage;

  async function receiveMessage({message}) {
    // initialization 
      const ct = + new Date;
      const {
        will_next_execute_at, will_end_after 
      } = message;
    // see the message
      const msgDeduplicatorKey = `${message.origin}/${message.msgName}`;
      const isDuplicate = await redis.is_message_duplicate(msgDeduplicatorKey, message);
      if ( isDuplicate ) {
        console.info("\n");
        console.warn(JSON.stringify({warning,isDuplicate,msgDeduplicatorKey}));
        return false;
      } 
      if ( message.being_reinserted ) { 
        // when a message is reinserted we do not see only delete it from insert table
        delete message.being_reinserted;
      } else {
        // if it is not reinserted we do delete all table entries
        await redis.see_interval( message.keyName );
      }
      const is_marked_for_deletion = await redis.is_marked_for_deletion( message.keyName );
      if ( is_marked_for_deletion ) {
        return 'not reinserted as marked for deletion';
      }
    // task performance branching 
      let taskPerformed = false;
      if ( ct >= will_next_execute_at ) { // be prompt with executing tasks ( execute on OR after )
        performTask(message);
        taskPerformed = true;
      }
    // message enqueuing branching
      if ( ct > will_end_after ) { // be generous with people's intevals ( only end *after* )
        // don't enqueue another message
      } else {
        if ( taskPerformed ) {
          message.last_executed_at = ct;
          message.will_next_execute_at = ct + message.interval_seconds*1000;
        } else {
          // don't update last and next execute
        }
        if ( message.will_next_execute_at > ct + (MAX*1000) ) {
          message.delay_seconds = MAX;
        } else {
          message.delay_seconds = Math.max(1,
            Math.ceil((message.will_next_execute_at - ct)/1000));
        }
        return enqueueMessage(message);
      }
  }
}
