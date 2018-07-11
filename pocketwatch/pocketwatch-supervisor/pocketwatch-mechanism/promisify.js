"use strict";
{
  // aim is to promisify all extension apis that use callbacks
  
  module.exports = promisify;

  function promisify(func) {
    return async function(...args) {
      return new Promise((res,rej) => {
        try {
          func(...args, (...cb_args) => res(cb_args));
        } catch(e) {
          rej(e);
        }
      });
    }
  }
}
