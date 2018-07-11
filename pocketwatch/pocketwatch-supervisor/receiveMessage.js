"use strict";

{
  const enqueueSupervisorMessage = require('./enqueueSupervisorMessage.js');
  const functions = require('./functions.js');
  const supervision = require('./supervision.js');
  const redis = require('./pocketwatch-cache/redis.js');
  const warning = 'SUPERVISOR RECEIVE MESSAGE WARNING';

  module.exports = receiveMessage;

  async function receiveMessage({message} = {}) {
    await redis.client.delAsync(`s_inserted:${message.keyName}`);
    const msgDeduplicatorKey = `${message.origin}/${message.msgName}`;
    const isDuplicate = await redis.is_message_duplicate(msgDeduplicatorKey, message);
    if ( isDuplicate ) {
      console.warn("\n");
      console.warn(JSON.stringify({warning,isDuplicate,msgDeduplicatorKey}));
      return false;
    } 
    if ( await supervision.is_time_to_go_again( message.type ) ) {
      switch( message.type ) {
        case 'loadIntervals':
          await functions.load_live_intervals();
          return enqueueSupervisorMessage(message);
          break;
        case 'reconcileIntervals':
          await functions.reinsert_missing_intervals();
          return enqueueSupervisorMessage(message);
          break;
        default:
          console.warn("\n");
          console.warn(JSON.stringify({warning,unknown_message:message}));
          break;
      }
    }
  }
}
