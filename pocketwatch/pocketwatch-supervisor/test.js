"use strict";
{
  const functions = require('./functions.js');

  test();

  async function test() {
    let r = await functions.load_live_intervals();
    console.log(r);
  }
}
