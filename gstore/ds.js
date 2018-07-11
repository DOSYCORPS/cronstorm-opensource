"use strict";
{
  const crypto = require('crypto');
  const path = require('path');
  const Datastore = require('@google-cloud/datastore');
  const projectId = '<your project id>';
  const keyFilename = path.join(__dirname, 'gcp-ds-key.json');
  const datastore = new Datastore({projectId,keyFilename});
  const ds = {
    test, save, query, keyFromName, newRandom, update, 
    "delete": del
  };

  module.exports = ds;

  if ( require.main === module ) {
    (function() {
      test().then( r => console.log(r));
    }());
  }

  function newRandom() {
    return crypto.randomBytes(20).toString('hex');
  }

  function keyFromName( {namespace,kind,name} = {} ) {
    const key = datastore.key({namespace,path:[kind,name]});
    return key;
  }

  function newKey( {namespace,kind} = {} ) {
    if ( ! kind || ! namespace ) {
      throw new TypeError("Supply kind and namespace");
    }
    const randName = newRandom();
    const key = datastore.key({namespace, path:[kind, randName]});
    return key;
  }

  async function query( {namespace, kind, q} = {} ) {
    const { lines, cursor } = typeof q == "string" ? JSON.parse(q) : q; 
    let query = datastore.createQuery( namespace, kind );
    while( lines.length ) {
      const nextLine = lines.shift();
      switch( nextLine.type ) {
        case "order":
          query = query.order(nextLine.prop, nextLine.dir);
          break;
        case "filter":
          query = query.filter(nextLine.prop, nextLine.op, nextLine.val);
          break;
        case "groupBy":
          query = query.groupBy(nextLine.prop);
          break;
        case "select":
          query = query.select(nextLine.prop || nextLine.propArray);
          break;
        case "limit":
          query = query.limit(nextLine.limit);
          break;
        case "default":
          throw new TypeError(`Invalid query line type ${nextLine}`);
          break;
      }
    }
    if ( !! cursor ) {
      query = query.start(cursor);
    }
    const result = await datastore.runQuery(query);
    return result;
  }

  async function save( {namespace, kind, excludeFromIndexes: excludeFromIndexes = [], data} = {} ) {
    const key = newKey({namespace,kind});
    const keyName = key.name;
    data.keyName = keyName;
    const entity = { key, data, excludeFromIndexes };
    const resp = await datastore.insert(entity);
    return {resp,keyName};
  }

  async function del( {namespace, kind, keyName} = {} ) {
    const key = datastore.key({namespace,path:[kind,keyName]});
    const result = await datastore.delete(key);
    return result;
  }


  async function update( {namespace,kind,data} = {} ) {
    const key = datastore.key({namespace,path:[kind,data.keyName]});
    remove_undefined_keys(data);
    const entity = { key, data };
    const resp = await datastore.upsert(entity);
    return {resp,keyName:data.keyName};
  }

  function test() {
    // The kind for the new entity
    const kind = 'Task';
    const namespace = 'test1';
    const data = {
      description: 'Buy milk',
    };

    // Saves the entity
    return save({namespace,kind,data});
  }

  function remove_undefined_keys(o) {
    const keys = Object.keys(o);
    const to_remove = [];
    for( const k of keys ) {
      if ( o[k] == undefined || o[k] == null || o[k] == '' ) {
        to_remove.push(k);
      }
    }
    to_remove.forEach( k => o[k] = ' ' );
  }
}
