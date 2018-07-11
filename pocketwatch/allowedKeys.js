"use strict";
{
  const timerInitial = new Set([
    'name', 'url', 'method', 
    'interval_unit_count', 'interval_unit_type',
    'duration_unit_count', 'duration_unit_type',
    'body', 'contentType',
    'request_source', 'apiKey', 'action',
    'created_at', 'will_end_after'
  ]);
  const timerFinal = new Set([
    ...timerInitial.values(),
    'intervalDescription',
    'customerId', 'subscriptionId',
    'stripeEmail', 'stripeToken', 'stripeTokenType',
    'name', 'plan', 'plan_choice',
    'interval_count', 'interval_seconds',
    'first_inject', 'delay_seconds',
    'duration_seconds',
    'cost', 'usdCostCents'
  ])
  const allowedKeys = {
    timerInitial, is_valid, timerFinal
  };

  module.exports = allowedKeys;

  function is_valid( obj, defName ) {
    if ( ! allowedKeys[defName] ) {
      throw {code:500,message:'that definition name is not known'}; 
    }
    const objKeys = Object.keys(obj);
    const allowed = allowedKeys[defName];
    for( const k of objKeys ) {
      if ( ! allowed.has(k) ) {
        throw {code:400,message:`key ${k} is not allowed in this request.`};
      }
    }
    return true;
  }
}
