"use strict";
{
  const service = 'supervisor';

  process.on('unhandledRejection', error => {
    const event = "Received unhandled promise rejection";
    error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
    console.log("\n");
    console.error(JSON.stringify({service,event,error}));
  });
  process.on('uncaughtException', error => {
    const event = "Received uncaught exception";
    error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
    console.log("\n");
    console.error(JSON.stringify({service,event,error}));
  });

  const supervision = require('./supervision.js');
  const receiveMessage = require('./receiveMessage.js');
  const ds = require('./gstore/ds.js');
  const exp = require('express');
  const bodyParser = require('body-parser');
  const path = require('path');
  const wrapAsync = require('./wrapAsync.js');
  const errors = require('./errors.js');

  const app = exp();
  const port = process.env.PORT || 8080;

  app.use("/", exp.static(path.join(__dirname, "public")));
  app.use(bodyParser.urlencoded({extended:true}));
  app.use(bodyParser.json({extended:true}));

  app.get("/", async (req,res,next) => {
    res.type("text").status(200).end("OK");
  });

  app.post("/inbox", wrapAsync(async (req,res,next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const time = new Date();
    // init
      const message = !! req.body.MessageBody ? JSON.parse(req.body.MessageBody) : req.body; 
      const {keyName,msgName,origin} = message;
      console.log("\n");
      console.log(
        JSON.stringify({service,ip,time,path:'/inbox',message:{keyName,msgName,origin}}));
    // receive it
      const receiveResult = await receiveMessage({message});
    // response ( always OK )
      res.type("text").status(200).end("OK");
  }));

  app.post("/check-supervision", async (req,res,next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log("\n");
    console.log(
      JSON.stringify({service,ip,time: new Date(),path:req.originalUrl}));
    await supervision.check();
    res.end("OK");
  });

  app.use(errors.log);
  app.use(errors.xhr);
  app.use(errors.html);
  app.use((req,res,next) => {
    res.status(404).send(errors.errorView({message: 'Page not found'}));
  });

  const server = app.listen(port, () => {
    const currentTime = new Date;
    const serverLive = `Server up at ${currentTime} on port ${port}`;
    console.log("\n");
    console.log(JSON.stringify({serverLive,port,currentTime}));
    if ( process.env.NODE_ENV !== 'dev' ) {
      setInterval(() => {
          const currentTime = new Date;
          console.log("\n");
          console.log(JSON.stringify({supervisionCheck:{currentTime}}));
          supervision.check();
        }, 
        5*1000 
      );
    }
    return true;
  });

  module.exports = server;
}
