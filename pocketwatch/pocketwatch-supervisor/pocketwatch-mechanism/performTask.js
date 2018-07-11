"use strict";
{
  const fetch = require('node-fetch');
  const HEADER = {
    'User-Agent': 'Pocketwatch Timer Fetch; Report Misuse to: criscanbereached+pw.bad.actors@gmail.com; Subscribe for your own timers at https://api.pocketwatch.xyz'
  };

  module.exports = performTask;

  async function performTask(msg) {
    const { method, url } = msg;
    const { keyName, msgName, origin } = msg;
    let taskPromise;
    try {
      switch( method ) {
        case 'DELETE':
        case 'PUT':
        case 'PATCH':
        case 'POST': {
          let { body, contentType: contentType = 'application/x-www-form-urlencoded' } = msg;
          if ( !! body ) {
            if ( process.env.DEBUG == 'full' ) {
              console.log("\n");
              console.log(
                JSON.stringify({message:"Body request",where:"performTask",body}));
            }
          }
          const headers = Object.assign({ 
            'Content-Type': contentType
          }, HEADER);
          taskPromise = await fetch(url, {method, headers, body}); 
          break;
        }
        case 'HEAD':
        case 'GET': {
          taskPromise = await fetch(url, {method, headers: HEADER});
          break;
        }
      }
    } catch(error) {
      if ( process.env.DEBUG == 'full' ) {
        const event = "performTask: error when making HTTP fetch";
        error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
        console.log("\n");
        console.warn(
          JSON.stringify({event,error,
            message:{keyName,msgName,origin}}));
      }
      return;
    }
    if ( process.env.DEBUG == 'full' ) {
      const event = "performTask: reached end of function block";
      console.log("\n");
      console.log(
        JSON.stringify({event,
          message:{keyName,msgName,origin}}));
    }
    return taskPromise;
  }
}
