"use strict";
{
  const economy_saver = {
    plan_name: "Economy Saver",
    plan_monthly_price: "69.00",
    usdCostCents: 6900,
    max_timers: 100,
    max_hits: 5000000
  };
  const medium_enterprise  = {
    plan_name: "Medium Enterprise",
    plan_monthly_price: "185.00",
    usdCostCents: 18500,
    max_timers: 1000,
    max_hits: 25000000
  };
  const major_player = {
    plan_name: "Major Player",
    plan_monthly_price: "555.00",
    usdCostCents: 55500, 
    max_timers: 10000,
    max_hits: 125000000
  };
  const stripeIdLive = {
    economy_saver: "plan_D2jQoArlu2zKBG",
    medium_enterprise: "plan_D2jSxGrlu2YKOl",
    major_player: "plan_D2jT5Ux5FoN0uG"
  };
  const stripeIdTest = {
    economy_saver: "plan_D2k1QjY36KfVAO",
    medium_enterprise: "plan_D2k1WqKUZ1HCUL",
    major_player: "plan_D2k11Ld2dkQH1C"
  }
  const stripeId = process.env.PAYMENTS == 'live' ? stripeIdLive : stripeIdTest;
  const plans = {
    economy_saver, medium_enterprise, major_player,
    stripeId
  };

  module.exports = plans;
}
