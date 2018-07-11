"use strict";
{
  const ds = require('./gstore/ds.js');
  const enqueueMessage = require('./pocketwatch-mechanism/enqueueMessage.js');

  const namespace = 'pocketwatch-gen-1';
  const kind = 'Interval';

  const excludeFromIndexes = [
    'action',
    'body',
    'contentType',
    'cost',
    'delay_seconds',
    'duration_seconds',
    'duration_unit_count',
    'duration_unit_type',
    'first_inject',
    'interval_count',
    'interval_seconds',
    'interval_unit_count',
    'interval_unit_type',
    'stripeTokenType',
    'usdCostCents'
  ];

  const api = {
    create_timer
  };

  module.exports = api;

  async function create_timer(data) {
    const ct = + new Date;
    data.created_at = ct;
    data.will_end_after = ct + data.duration_seconds * 1000;
    data.marked_for_deletion = false;
    data.first_inject = true;
    const store_result = await ds.save({namespace,kind,data,excludeFromIndexes});
    data.keyName = store_result.keyName;
    const result = await enqueueMessage(data);
    data.trackingCode = data.keyName;
    return result;
  }
}
