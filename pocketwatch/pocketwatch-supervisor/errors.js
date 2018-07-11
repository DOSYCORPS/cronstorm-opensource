"use strict";
{
  const service = 'supervisor';
  const errors = {
    log, xhr, html, errorView
  };

  module.exports = errors;

  function log(error, req, res, next) {
    const event = "received error";
    error = {error,message:error+'',stack:error.stack.split('\n').map(l => l.trim())};
    console.log("\n");
    console.error(JSON.stringify({service,event,error}));
    next(error);
  }

  function xhr(err, req, res, next) {
    if ( req.xhr ) {
      res.status(500).end({ error: 'Something failed!' });
    } else {
      next(err);
    }
  }

  function html(err, req, res, next) {
    res.type('html');  
    res.end(
      errorView({message: err.message || 'unspecified error'})
    );
  }

  function safe( data ) {
    const dataString = JSON.stringify(data);
    const safe = dataString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return JSON.parse(safe);
  }

  function errorView( data ) {
    data = safe(data);
    return `
      <article class=modal>
        <h1>An error occurred</h1>
        <section class=info>
          <p class=long>
            ${data.message}
        </section>
        <section class=control>
          <button id=go_back name=action value=go_back>Go back</button>
        </section>
        <script>
          "use strict";
          {
            document.querySelector('#go_back').onclick = () => {
              window.history.back();
            };
          }
        </script>
      </article>
    `;
  }
}
