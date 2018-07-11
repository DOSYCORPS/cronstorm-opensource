"use strict";
{
  const keys = require('./stripeKeysPublic.js')[process.env.PAYMENTS == 'live' ? 'live' : 'test'];

  const views = {
    confirmSubscription, stripePayment,
    successPayment,
    errorView
  };

  module.exports = views;

  function confirmSubscription( data ) {
    data = safe(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <section class=info>
          <p>
            Your <strong>${data.plan_name}</strong> subscription for 
            USD$${data.plan_monthly_price} a month will be activated immediately 
            upon successful payment.
          <p>
            Do you wish to proceed to purchase, and start your subscription?
        </section>
        <section class=control>
          <form target=modals method=POST action=/subscription/purchase_flow>
            <input type=hidden name=plan_choice value="${data.plan_choice}">
            <input type=hidden name=plan_name value="${data.plan_name}">
            <input type=hidden name=plan_monthly_price value="${data.plan_monthly_price}">
            <input type=hidden name=usdCostCents value="${data.usdCostCents}">
            <p>
              <label>
                <input type=checkbox required name=proceed> 
                Yes, I agree to the <a target=_new href=/terms.html>terms and conditions</a>, and 
                I wish to proceed to purchase and get my API key.
              </label>
            <p>
              <button autofocus name=action value=proceed_to_stripe_payment>Yes, proceed to pay USD$${data.plan_monthly_price} monthly now</button>
          </form>
          <p>
            <button name=action value=change>Change plan</button>
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
        <h1>Subscription Details</h1>
        <section class=info>
          <p>
            We will now charge your card for USD${data.plan_monthly_price} when you click 
            the payment button below. Each month until you cancel, we will charge your card 
            this same amount on the same day (or the closest day to it).
          <p>
            You can cancel at any time. However, please note we do 
            not issue refunds for partial months,
            and your subscription will therefore remain active 
            until the end of the billing cycle
            you cancel within.
          <p>
            Do you wish to finalize your purchase, start your subscription, and get your 
            <strong>${data.plan_name} API Key</strong>?
        </section>
        <section class=control>
          <form action="/subscription/purchase_flow" method="POST">
            <input type=hidden name=plan_choice value="${data.plan_choice}">
            <input type=hidden name=plan_name value="${data.plan_name}">
            <input type=hidden name=plan_monthly_price value="${data.plan_monthly_price}">
            <input type=hidden name=usdCostCents value="${data.usdCostCents}">
            <input type=hidden name=action value=verify_stripe_charge>
            <p>
              Yes 
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
              <noscript>, but first please enable JavaScript in order to use Credit Card payment.</noscript>
          </form>
          <p>
            No
            <button name=action value=change>Change plan</button>
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

  function couponStripePayment( data ) {
    data = safe(data);
    return `
      <link rel=stylesheet href=/modal.css>
      <article class=modal>
        <h1>Subscription Details</h1>
        <section class=info>
          <p>
            We will now charge your card for USD${data.plan_monthly_price} when you click 
            the payment button below. Each month until you cancel, we will charge your card 
            this same amount on the same day (or the closest day to it).
          <p>
            You can cancel at any time. However, please note we do 
            not issue refunds for partial months,
            and your subscription will therefore remain active 
            until the end of the billing cycle
            you cancel within.
          <p>
            Do you wish to finalize your purchase, start your subscription, and get your 
            <strong>${data.plan_name} API Key</strong>?
        </section>
        <section class=control>
          <form action="/subscription/purchase_flow" method="POST">
            <input type=hidden name=plan_choice value="${data.plan_choice}">
            <input type=hidden name=plan_name value="${data.plan_name}">
            <input type=hidden name=plan_monthly_price value="${data.plan_monthly_price}">
            <input type=hidden name=usdCostCents value="${data.usdCostCents}">
            <input type=hidden name=action value=verify_stripe_charge>
            <p>
              <i>Please note: if you use a valid coupon, although the next page will show ${data.plan_monthly_price} your card will <strong>only be charged the discounted amount</strong>, not the full amount</i>
            <p>
              Yes 
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
              <input type=text 
                name=coupon_name autofocus placeholder="Have a coupon? Enter it here.">
          </form>
          <p>
            No
            <button name=action value=change>Change plan</button>
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
            Your purchase of a <strong>${data.plan_name} Monthly Plan</strong>
            has been successful, and your subscription is now active.  
          </p>
          ${ ! data.discount ? '' : `
            <section class=bonus>
              <p>
                <strong>Your discount coupon was successful!</strong>
                You were only charged USD$${data.amount_paid} with this discount.
            </section>`
          }
          <form>
            <p>
              Your API Key for this subscription is:
            <p>
              <code class=api-key>${data.apiKey}</code>
              <button name=action value=copy-api-key>Copy to Clipboard</button>
              <span class="transparent result">Copied!</span>
            </p>
            <script>
              "use strict";
              {
                const form = document.currentScript.parentElement;
                form.onsubmit = e => {
                  e.preventDefault(); 
                  const tc = form.querySelector('.api-key');
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
          <p>
            <strong>About your API Key</strong>
          <p>
            You can use your API key to make requests to create timers, delete timers, and do other things. For more information about the API, read <a target=_blank href=https://dosyago-corp.github.io/pocketwatch-api/>the Documentation</a>.
          <p>
            You can also <a target=_new href=mailto:criscanbereached+dosy.help@gmail.com?&subject=Dosy+Help+for+Pocketwatch>email us</a>, and include your API key, in order to request information about your account, or about one of your timers, and to request any other support. 
          <p class=important>
            <i>Keep your API key safe and do not give it to anyone else.</i>
          <p>
            Now that you have an API key, you may wish you <a target=_blank href=https://dosyago-corp.github.io/pocketwatch-api/>read our developer docs</a>, or <a target=_blank href=https://github.com/dosyago-corp/pocketwatch.js>get the Node.js client library</a>.
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
            const go_back = modal.querySelector('button[value="go_back"]');
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
