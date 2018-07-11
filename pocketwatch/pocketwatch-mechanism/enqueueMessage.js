"use strict";
{
  const QU = require('./QU.js');
  const redis = require('./pocketwatch-cache/redis.js');
  const promisify = require('./promisify.js');
  const crypto = require('crypto');
  const AWS = require('aws-sdk');

  AWS.config.update({region:'us-west-2'});
  const sqs = new AWS.SQS({apiVersion:'2012-11-05'});

  const sendMsg = promisify((...args) => sqs.sendMessage(...args));

  module.exports = enqueueMessage;

  function newRandom() {
    return crypto.randomBytes(20).toString('hex');
  }

  async function enqueueMessage( msg ) {
    if ( !! msg.first_inject ) {
      delete msg.first_inject;
      const ct = +new Date;
      msg.will_next_execute_at = ct + msg.interval_seconds * 1000;
    }
    const packagedMessage = createMessage(msg);
    await redis.add_origin(msg);
    const result = await sendMsg(packagedMessage);
    const resultStatus = makeStatus( result );
    const msgDeduplicatorKey = `${msg.origin}/${msg.msgName}`;
    //console.log(JSON.stringify({QU,msgDeduplicatorKey,resultStatus}));
    return resultStatus;
  }

  function createMessage( obj ) {
    obj.msgName = ( obj.msgName || 0 ) + 1;
    obj.origin = obj.origin || newRandom();
    const MessageBody = JSON.stringify(obj);
    const QueueUrl = QU;
    const DelaySeconds = obj.delay_seconds || 0;
    const params =  {
      MessageBody, QueueUrl, DelaySeconds
    }
    return params; 
  }

  function makeStatus( [ err, data ] = [] ) {
    if ( !! err ) {
      return `fail`;
    } else if ( !! data ) {
      return `success`;
    } else {
      return `unknown`;
    }
  }
}
