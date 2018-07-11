"use strict";
{
  const keys = require('./stripeKeysPublic.js')[process.env.PAYMENTS == 'live' ? 'live' : 'test'];
  const views = {
    costCalculated, stripePayment,
    successPayment,
    errorView
  };

  module.exports = views;

  function costCalculated( data ) {
    console.log(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <section class=info>
          <p>
            Your interval will place a <code>${data.method}</code> request to 
            <code class=long>${data.url}</code>
            every ${data.interval_unit_count} ${data.interval_unit_type}s, for 
            a total of ${data.duration_unit_count} ${data.duration_unit_type}s
            (a total of ${data.interval_count} invocations), and will begin 
            immediately after purchase. The first request will occur 
            in ${data.interval_unit_count} ${data.interval_unit_type}s.
          <p>
            Do you wish to proceed to purchase, and start your interval?
        </section>
        <section class=control>
          <form target=modals method=POST action=/interval/purchase_flow>
            <input type=hidden name=name value="${data.name}">
            <input type=hidden name=request_source value="${data.request_source}">
            <input type=hidden name=intervalDescription value="${data.intervalDescription}">
            <input type=hidden name=interval_unit_count value="${data.interval_unit_count}">
            <input type=hidden name=interval_unit_count value="${data.interval_unit_count}">
            <input type=hidden name=interval_unit_type value="${data.interval_unit_type}">
            <input type=hidden name=duration_unit_count value="${data.duration_unit_count}">
            <input type=hidden name=duration_unit_type value="${data.duration_unit_type}">
            <input type=hidden name=url value="${data.url}">
            <input type=hidden name=method value="${data.method}">
            <input type=hidden name=cost value="${data.cost}">
            <input type=hidden name=usdCostCents value="${data.usdCostCents}">
            <p>
              <label>
                <input type=checkbox required name=proceed> 
                Yes, I agree to the <a target=_new href=/terms.html>terms and conditions</a>, and 
                I wish to proceed to purchase and start my interval.
              </label>
            <p>
              <button autofocus name=action value=proceed_to_stripe_payment>Yes, proceed to pay USD$${data.cost} now</button>
          </form>
          <p>
            <button name=action value=change>Change interval</button>
        </section>
        <script>
          "use strict";
          {
            const modal = document.currentScript.closest('.modal');
            const change = modal.querySelector('button[value="change"]');
            self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'block';
            self.addEventListener('unload', () => {
              self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'none';
            });
            change.onclick = () => {
              window.history.back();
            };
          }
        </script>
      </article>
    `;
  }

  function stripePayment( data ) {
    data = safe(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <section class=info>
          <p>
            We will now charge your card for USD${data.cost} when you click 
            the payment button below.
          <p>
            Do you wish to proceed to purchase, and start your interval?
        </section>
        <section class=control>
          <form action="/interval/purchase_flow" method="POST">
            <input type=hidden name=name value="${data.name}">
            <input type=hidden name=request_source value="${data.request_source}">
            <input type=hidden name=intervalDescription value="${data.intervalDescription}">
            <input type=hidden name=interval_unit_count value="${data.interval_unit_count}">
            <input type=hidden name=interval_unit_type value="${data.interval_unit_type}">
            <input type=hidden name=duration_unit_count value="${data.duration_unit_count}">
            <input type=hidden name=duration_unit_type value="${data.duration_unit_type}">
            <input type=hidden name=url value="${data.url}">
            <input type=hidden name=method value="${data.method}">
            <input type=hidden name=cost value="${data.cost}">
            <input type=hidden name=usdCostCents value="${parseInt(data.usdCostCents)-10}">
            <input type=hidden name=action value=verify_stripe_charge>
            <script
              src="https://checkout.stripe.com/checkout.js" class="stripe-button"
              data-key="${keys.public}"
              data-amount="${data.usdCostCents}"
              data-name="Pocketwatch by DOSY"
              data-description="Purveyors of the finest intervals"
              data-image="https://stripe.com/img/documentation/checkout/marketplace.png"
              data-zip-code="true"
              data-locale="auto">
            </script>
          </form>
          <p>
            <button name=action value=change>Change interval</button>
        </section>
        <script>
          "use strict";
          {
            const modal = document.currentScript.closest('.modal');
            const change = modal.querySelector('button[value="change"]');
            self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'block';
            self.addEventListener('unload', () => {
              self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'none';
            });
            change.onclick = () => {
              window.history.back();
            };
          }
        </script>
      </article>
    `;
  }

  function successPayment( data ) {
    data = safe(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <h1>Successful payment</h1>
        <section class=info>
          <p>
            Your purchase of 1 Pocketwatch interval has been successful, and you interval has begun running.
          <p>
            Your interval will place a <code>${data.method}</code> request to 
            <code class=long>${data.url}</code>
            every ${data.interval_unit_count} ${data.interval_unit_type}s, for 
            a total of ${data.duration_unit_count} ${data.duration_unit_type}s
            (a total of ${data.interval_count} invocations), and 
            the first request will occur 
            in ${data.interval_unit_count} ${data.interval_unit_type}s.
          </p>
          <form>
            <p>
              Your tracking code for this interval is 
              <code class=tracking-code>${data.trackingCode}</code>
              <button name=action value=copy-tracking-code>Copy to Clipboard</button>
              <span class="transparent result">Copied!</span>
            </p>
            <script>
              "use strict";
              {
                const form = document.currentScript.parentElement;
                form.onsubmit = e => {
                  e.preventDefault(); 
                  const tc = form.querySelector('.tracking-code');
                  const result = form.querySelector('.result');
                  const r = document.createRange();
                  r.selectNode(tc);
                  window.getSelection().addRange(r);
                  let copied = false;
                  try {
                    copied = document.execCommand('copy');
                  } catch(e) {}
                  if ( ! copied ) {
                    result.innerText = 'Not copied. Copy it yourself.';
                    result.classList.add('fail');
                  }
                  result.classList.remove('transparent');
                };
              }
            </script>
          </form>
          <p class=important>
            You can use your tracking code to email us to request information about or to delete your interval. Keep your tracking code safe and do not give it to anyone else.
        </section>
        <section class=control>
          <form method=GET action=/success.html target=_top>
            <button autofocus name=achievement value=unlocked>Ok, got it.</button>
          </form>
        </section>
        <script>
          "use strict";
          {
            const modal = document.currentScript.closest('.modal');
            if ( top !== self ) {
              self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'block';
              self.addEventListener('unload', () => {
                self.parent.document.querySelector(\`iframe[name="\${self.name}]"\`).style.display = 'none';
              });
            }
          }
        </script>
      </article>
    `;
  }

  function errorView( data ) {
    data = safe(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <h1>An error occurred</h1>
        <section class=info>
          <p class=long>
            ${data.message}
        </section>
        <section class=control>
          <button autofocus name=action value=go_back>Go back</button>
        </section>
        <script>
          "use strict";
          {
            const modal = document.currentScript.closest('.modal');
            const go_back = modal.querySelector('button[value="go_back"]');
            if ( top !== self ) {
              self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'block';
              self.addEventListener('unload', () => {
                self.parent.document.querySelector(\`iframe[name="\${self.name}"]\`).style.display = 'none';
              });
            }
            go_back.onclick = () => {
              window.history.back();
            };
          }
        </script>
      </article>
    `;
  }

  function safe( data ) {
    const dataString = JSON.stringify(data);
    const safe = dataString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return JSON.parse(safe);
  }
}
