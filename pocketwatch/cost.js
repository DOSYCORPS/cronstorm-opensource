"use strict";
{
  const seconds = {
    "second": 1,
    "minute": 60,
    "hour": 3600,
    "day": 86400,
    "week": 604800,
    "month": 2629800
  };
  const cost = {
    calculate, seconds, calculateApproximateHitsRemaining
  };

  const {URL} = require('url');
  const METHODS = new Set([
    'GET',
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
    'HEAD'
  ]);
  const TIMEUNITS = new Set([
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month'
  ]);
  const EMAIL_EX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  module.exports = cost;

  function calculate(body) {
    const { 
      interval_unit_count, interval_unit_type,
      duration_unit_count, duration_unit_type
    } = body;
    const data = Object.assign({}, body);
    guardValidate(data);
    const iuc = parseInt(interval_unit_count); 
    const duc = parseInt(duration_unit_count); 
    const interval_seconds = iuc*seconds[interval_unit_type];
    const delay_seconds = interval_seconds;
    const duration_seconds = duc*seconds[duration_unit_type];
    const interval_count = Math.floor(duration_seconds/interval_seconds);
    // 1 right now and 1 every interval seconds until duration seconds elapsed from first invocation
    const cost = Math.max(
      85,
      (0.001*interval_count/duration_seconds)+(duration_seconds*0.000001)+(interval_count*0.001)
    );
    data.intervalDescription = data.intervalDescription || `${data.name}: every ${iuc} ${interval_unit_type} for ${duc} ${duration_unit_type}s.`
    data.usdCostCents = cost.toFixed(0);
    data.cost = (cost/100).toFixed(2);
    Object.assign(data, {interval_count, interval_seconds, delay_seconds, duration_seconds });
    guardFinal(data);
    return data;
  }

  function calculateApproximateHitsRemaining(timer) {
    const ct = +new Date;
    const {created_at, interval_count,will_end_after} = timer;
    const runningDuration = ct - created_at;
    const totalDuration = Math.max(1,will_end_after - created_at); 
    const completeRatio = runningDuration/totalDuration;
    const remainingRatio = 1 - Math.abs(completeRatio);
    const approximateHitsRemaining = Math.floor(remainingRatio*interval_count);
    return parseInt(Math.abs(approximateHitsRemaining));
  }

  function guardValidate(data) {
    guardInteger(data.interval_unit_count); 
    guardInteger(data.duration_unit_count); 
    guardUrl(data.url);
    guardMember(data.method,METHODS);
    guardString(data.contentType,{optional:true});
    guardString(data.body,{optional:true});
    guardEmail(data.stripeEmail,{optional:true});
    guardMember(data.interval_unit_type,TIMEUNITS);
    guardMember(data.duration_unit_type,TIMEUNITS);
  }

  function guardString(i, {optional:optional=false,message:message=null}={}) {
    const type = typeof i;
    if ( type === "string" ) {
      return true;
    } else if ( ( i == null || i == undefined ) && optional ) {
      return true;
    } else {
      throw {code:400,message:`${
          optional? 'optional' : 'required'
        } value ${i} was asked to be of type String. it was not. ${message||''}`};
    }
  }

  function guardFinal(data) {
    guardFloat(data.cost);
    guardInteger(data.usdCostCents);
    guardInteger(data.interval_seconds);
    guardInteger(data.delay_seconds);
    guardInteger(data.duration_seconds);
  }

  function guardInteger(i, {optional:optional=false, message:message=null} = {}) {
    const int = parseInt(i);
    if ( Number.isInteger(int) ) {
      return true;
    } else {
      throw {code:400,message:`${i} was asked to be integer. it was not. ${message||''}` };
    }
  }

  function guardFloat(i, {optional:optional=false, message:message=null} = {}) {
    const float = parseFloat(i);
    if ( Number.isFinite(float) && ! Number.isNaN(float)) {
      return true;
    } else {
      throw {code:400,message:`${i} was asked to be floating point number. it was not. ${message||''}` };
    }
  }

  function guardMember(i, set, {optional: optional=false, message: message=null}={}) {
    const test = !! i && set.has(i);
    if ( test ) {
      return true;
    } else {
      throw {code:400,message:`${i} was asked to be one of ${[...set.values()].join(',')}, it was not. ${message||''}`};
    }
  }

  function guardUrl(i, {optional: optional=false, message: message=null}={}) {
    try {
      return !!(new URL(i));
    } catch(e) {
      throw {code:400, message:`${i} was required to be a valid URL. It was not.${message||''}`};
    }
  }

  function guardEmail(i, {optional: optional=false, message: message=null}={}) {
    const exists = !! i;
    if ( optional && ! exists ) {
      return true; 
    } else {
      const test = !! i && EMAIL_EX.test(i);
      if ( test ) {
        return true;
      } else {
        throw {code:400,message:`${i} is required to be an email. it is not. ${message||''}`};
      }
    }
  }
}
