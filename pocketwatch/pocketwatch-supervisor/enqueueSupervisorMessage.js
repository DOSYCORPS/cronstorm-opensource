"use strict";
{
  const QU = require('./QU.js');
  const promisify = require('./promisify.js');
  const redis = require('./pocketwatch-cache/redis.js');
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
    const packagedMessage = createMessage(msg);
    const already_in_queue = await redis.client.getAsync(`s_inserted:${msg.keyName}`);
    if ( !! already_in_queue ) {
      return 'not enqueued: already in queue';
    }
    const result = await sendMsg(packagedMessage);
    const resultStatus = makeStatus( result );
    if ( process.env.DEBUG == 'full' ) {
      console.log("\n");
      const {origin,msgName,keyName} = msg;
      console.log(JSON.stringify({resultStatus,message:{origin,msgName,keyName},QU}));
    }
    if ( resultStatus == 'success' ) {
      await redis.client.setAsync(`s_inserted:${msg.keyName}`,"OK","EX",msg.delay_seconds*2);
    }
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
