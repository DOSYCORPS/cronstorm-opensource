"use strict";
{
  const app = require('./server.js');

  module.exports = ( req, res ) => {
    if ( ! req.path ) {
      req.url = '/';
    }
    return app( req, res );
  };
}
