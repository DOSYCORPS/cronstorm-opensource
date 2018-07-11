"use strict";
{
  const service = 'api';
  const errors = {
    log, errorView
  };

  module.exports = errors;

  function log(error, req, res, next) {
    console.log("\n");
    console.log(error);
    res.status(error.code || error.statusCode).end(JSON.stringify({error}));
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
