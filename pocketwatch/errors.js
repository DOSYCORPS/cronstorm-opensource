"use strict";
{
  const service = 'web';
  const errors = {
    log, xhr, html, errorView
  };

  module.exports = errors;

  function log(error, req, res, next) {
    console.log("\n");
    console.log(error);
    next(error);
  }

  function xhr(error, req, res, next) {
    res.status(error.code || error.statusCode).end(JSON.stringify({error}));
  }

  function html(err, req, res, next) {
    res.type('html');  
    res.end('unspecified error');
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
