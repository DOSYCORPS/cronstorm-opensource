"use strict";
{
  const credentials = require('./hardcodedCredentials.js');
  const exp = require('express');
  const ds = require('./ds.js');

  const app = exp();

  if ( require.main == module ) {
    const bodyParser = require('body-parser');
    app.use(bodyParser.urlencoded({extended:true}));
  }

  app.use("/",exp.static("public"));

  app.post("/save/:namespace/:kind/", (req,res,next) => {
    const {namespace,kind} = req.params;
    const data = Object.assign({},req.body);
    console.log(data);
    if ( credentials.has(data.apikey) ) {
      ds.save({namespace,kind,data}).then( result => res.end("saved"));
    } else {
      res.end("forbidden");
    }
  });

  app.get("/query/:namespace/:kind/", (req,res,next) => {
    const {namespace,kind} = req.params;
    const { q, apikey } = req.query;
    if ( credentials.has(apikey) ) {
      ds.query({namespace,kind,q}).then( result => res.end(JSON.stringify(result)) );
    } else {
      res.end("forbidden");
    }
  });

  module.exports = app;

  if ( require.main == module ) {
    const port = process.env.PORT || 8080;
    const server = app.listen(port, () => console.log(`Server up at ${new Date()} on port ${port}`));
  }
}
