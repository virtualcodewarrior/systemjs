/*
 * SystemJS v0.18.14
 */
(function() {
function bootstrap() {(function(__global) {

  var isWorker = typeof window == 'undefined' && typeof self != 'undefined' && typeof importScripts != 'undefined';
  var isBrowser = typeof window != 'undefined' && typeof document != 'undefined';
  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  if (!__global.console)
    __global.console = { assert: function() {} };

  // IE8 support
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, thisLen = this.length; i < thisLen; i++) {
      if (this[i] === item) {
        return i;
      }
    }
    return -1;
  };
  
  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function addToError(err, msg) {
    var newErr;
    if (err instanceof Error) {
      var newErr = new Error(err.message, err.fileName, err.lineNumber);
      if (isBrowser) {
        newErr.message = err.message + '\n\t' + msg;
        newErr.stack = err.stack;
      }
      else {
        // node errors only look correct with the stack modified
        newErr.message = err.message;
        newErr.stack = err.stack + '\n\t' + msg;
      }
    }
    else {
      newErr = err + '\n\t' + msg;
    }
      
    return newErr;
  }

  function __eval(source, debugName, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + debugName);
    }
  }

  var baseURI;
  // environent baseURI detection
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    baseURI = document.baseURI;

    if (!baseURI) {
      var bases = document.getElementsByTagName('base');
      baseURI = bases[0] && bases[0].href || window.location.href;
    }

    // sanitize out the hash and querystring
    baseURI = baseURI.split('#')[0].split('?')[0];
    baseURI = baseURI.substr(0, baseURI.lastIndexOf('/') + 1);
  }
  else if (typeof process != 'undefined' && process.cwd) {
    baseURI = 'file://' + (isWindows ? '/' : '') + process.cwd() + '/';
    if (isWindows)
      baseURI = baseURI.replace(/\\/g, '/');
  }
  else if (typeof location != 'undefined') {
    baseURI = __global.location.href;
  }
  else {
    throw new TypeError('No environment baseURI');
  }

  var URL = __global.URLPolyfill || __global.URL;
/*
*********************************************************************************************

  Dynamic Module Loader Polyfill

    - Implemented exactly to the former 2014-08-24 ES6 Specification Draft Rev 27, Section 15
      http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27

    - Functions are commented with their spec numbers, with spec differences commented.

    - Spec bugs are commented in this code with links.

    - Abstract functions have been combined where possible, and their associated functions
      commented.

    - Realm implementation is entirely omitted.

*********************************************************************************************
*/

function Module() {}
// http://www.ecma-international.org/ecma-262/6.0/#sec-@@tostringtag
defineProperty(Module.prototype, 'toString', {
  value: function() {
    return 'Module';
  }
});
function Loader(options) {
  this._loader = {
    loaderObj: this,
    loads: [],
    modules: {},
    importPromises: {},
    moduleRecords: {}
  };

  // 26.3.3.6
  defineProperty(this, 'global', {
    get: function() {
      return __global;
    }
  });

  // 26.3.3.13 realm not implemented
}

(function() {

// Some Helpers

// logs a linkset snapshot for debugging
/* function snapshot(loader) {
  console.log('---Snapshot---');
  for (var i = 0; i < loader.loads.length; i++) {
    var load = loader.loads[i];
    var linkSetLog = '  ' + load.name + ' (' + load.status + '): ';

    for (var j = 0; j < load.linkSets.length; j++) {
      linkSetLog += '{' + logloads(load.linkSets[j].loads) + '} ';
    }
    console.log(linkSetLog);
  }
  console.log('');
}
function logloads(loads) {
  var log = '';
  for (var k = 0; k < loads.length; k++)
    log += loads[k].name + (k != loads.length - 1 ? ' ' : '');
  return log;
} */


/* function checkInvariants() {
  // see https://bugs.ecmascript.org/show_bug.cgi?id=2603#c1

  var loads = System._loader.loads;
  var linkSets = [];

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    console.assert(load.status == 'loading' || load.status == 'loaded', 'Each load is loading or loaded');

    for (var j = 0; j < load.linkSets.length; j++) {
      var linkSet = load.linkSets[j];

      for (var k = 0; k < linkSet.loads.length; k++)
        console.assert(loads.indexOf(linkSet.loads[k]) != -1, 'linkSet loads are a subset of loader loads');

      if (linkSets.indexOf(linkSet) == -1)
        linkSets.push(linkSet);
    }
  }

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    for (var j = 0; j < linkSets.length; j++) {
      var linkSet = linkSets[j];

      if (linkSet.loads.indexOf(load) != -1)
        console.assert(load.linkSets.indexOf(linkSet) != -1, 'linkSet contains load -> load contains linkSet');

      if (load.linkSets.indexOf(linkSet) != -1)
        console.assert(linkSet.loads.indexOf(load) != -1, 'load contains linkSet -> linkSet contains load');
    }
  }

  for (var i = 0; i < linkSets.length; i++) {
    var linkSet = linkSets[i];
    for (var j = 0; j < linkSet.loads.length; j++) {
      var load = linkSet.loads[j];

      for (var k = 0; k < load.dependencies.length; k++) {
        var depName = load.dependencies[k].value;
        var depLoad;
        for (var l = 0; l < loads.length; l++) {
          if (loads[l].name != depName)
            continue;
          depLoad = loads[l];
          break;
        }

        // loading records are allowed not to have their dependencies yet
        // if (load.status != 'loading')
        //  console.assert(depLoad, 'depLoad found');

        // console.assert(linkSet.loads.indexOf(depLoad) != -1, 'linkset contains all dependencies');
      }
    }
  }
} */

  // 15.2.3 - Runtime Semantics: Loader State

  // 15.2.3.11
  function createLoaderLoad(object) {
    return {
      // modules is an object for ES5 implementation
      modules: {},
      loads: [],
      loaderObj: object
    };
  }

  // 15.2.3.2 Load Records and LoadRequest Objects

  // 15.2.3.2.1
  function createLoad(name) {
    return {
      status: 'loading',
      name: name,
      linkSets: [],
      dependencies: [],
      metadata: {}
    };
  }

  // 15.2.3.2.2 createLoadRequestObject, absorbed into calling functions

  // 15.2.4

  // 15.2.4.1
  function loadModule(loader, name, options) {
    return new Promise(asyncStartLoadPartwayThrough({
      step: options.address ? 'fetch' : 'locate',
      loader: loader,
      moduleName: name,
      // allow metadata for import https://bugs.ecmascript.org/show_bug.cgi?id=3091
      moduleMetadata: options && options.metadata || {},
      moduleSource: options.source,
      moduleAddress: options.address
    }));
  }

  // 15.2.4.2
  function requestLoad(loader, request, refererName, refererAddress) {
    // 15.2.4.2.1 CallNormalize
    return new Promise(function(resolve, reject) {
      resolve(loader.loaderObj.normalize(request, refererName, refererAddress));
    })
    // 15.2.4.2.2 GetOrCreateLoad
    .then(function(name) {
      var load;
      if (loader.modules[name]) {
        load = createLoad(name);
        load.status = 'linked';
        // https://bugs.ecmascript.org/show_bug.cgi?id=2795
        load.module = loader.modules[name];
        return load;
      }

      for (var i = 0, l = loader.loads.length; i < l; i++) {
        load = loader.loads[i];
        if (load.name != name)
          continue;
        console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded');
        return load;
      }

      load = createLoad(name);
      loader.loads.push(load);

      proceedToLocate(loader, load);

      return load;
    });
  }

  // 15.2.4.3
  function proceedToLocate(loader, load) {
    proceedToFetch(loader, load,
      Promise.resolve()
      // 15.2.4.3.1 CallLocate
      .then(function() {
        return loader.loaderObj.locate({ name: load.name, metadata: load.metadata });
      })
    );
  }

  // 15.2.4.4
  function proceedToFetch(loader, load, p) {
    proceedToTranslate(loader, load,
      p
      // 15.2.4.4.1 CallFetch
      .then(function(address) {
        // adjusted, see https://bugs.ecmascript.org/show_bug.cgi?id=2602
        if (load.status != 'loading')
          return;
        load.address = address;

        return loader.loaderObj.fetch({ name: load.name, metadata: load.metadata, address: address });
      })
    );
  }

  var anonCnt = 0;

  // 15.2.4.5
  function proceedToTranslate(loader, load, p) {
    p
    // 15.2.4.5.1 CallTranslate
    .then(function(source) {
      if (load.status != 'loading')
        return;

      return Promise.resolve(loader.loaderObj.translate({ name: load.name, metadata: load.metadata, address: load.address, source: source }))

      // 15.2.4.5.2 CallInstantiate
      .then(function(source) {
        load.source = source;
        return loader.loaderObj.instantiate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // 15.2.4.5.3 InstantiateSucceeded
      .then(function(instantiateResult) {
        if (instantiateResult === undefined) {
          load.address = load.address || '<Anonymous Module ' + ++anonCnt + '>';

          // instead of load.kind, use load.isDeclarative
          load.isDeclarative = true;
          return transpile.call(loader.loaderObj, load)
          .then(function(transpiled) {
            // Hijack System.register to set declare function
            var curSystem = __global.System;
            var curRegister = curSystem.register;
            curSystem.register = function(name, deps, declare) {
              if (typeof name != 'string') {
                declare = deps;
                deps = name;
              }
              // store the registered declaration as load.declare
              // store the deps as load.deps
              load.declare = declare;
              load.depsList = deps;
            }
            // empty {} context is closest to undefined 'this' we can get
            __eval(transpiled, load.address, {});
            curSystem.register = curRegister;
          });
        }
        else if (typeof instantiateResult == 'object') {
          load.depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.isDeclarative = false;
        }
        else
          throw TypeError('Invalid instantiate return value');
      })
      // 15.2.4.6 ProcessLoadDependencies
      .then(function() {
        load.dependencies = [];
        var depsList = load.depsList;

        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request, index) {
          loadPromises.push(
            requestLoad(loader, request, load.name, load.address)

            // 15.2.4.6.1 AddDependencyLoad (load is parentLoad)
            .then(function(depLoad) {

              // adjusted from spec to maintain dependency order
              // this is due to the System.register internal implementation needs
              load.dependencies[index] = {
                key: request,
                value: depLoad.name
              };

              if (depLoad.status != 'linked') {
                var linkSets = load.linkSets.concat([]);
                for (var i = 0, l = linkSets.length; i < l; i++)
                  addLoadToLinkSet(linkSets[i], depLoad);
              }

              // console.log('AddDependencyLoad ' + depLoad.name + ' for ' + load.name);
              // snapshot(loader);
            })
          );
        })(depsList[i], i);

        return Promise.all(loadPromises);
      })

      // 15.2.4.6.2 LoadSucceeded
      .then(function() {
        // console.log('LoadSucceeded ' + load.name);
        // snapshot(loader);

        console.assert(load.status == 'loading', 'is loading');

        load.status = 'loaded';

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      });
    })
    // 15.2.4.5.4 LoadFailed
    ['catch'](function(exc) {
      load.status = 'failed';
      load.exception = exc;

      var linkSets = load.linkSets.concat([]);
      for (var i = 0, l = linkSets.length; i < l; i++) {
        linkSetFailed(linkSets[i], load, exc);
      }

      console.assert(load.linkSets.length == 0, 'linkSets not removed');
    });
  }

  // 15.2.4.7 PromiseOfStartLoadPartwayThrough absorbed into calling functions

  // 15.2.4.7.1
  function asyncStartLoadPartwayThrough(stepState) {
    return function(resolve, reject) {
      var loader = stepState.loader;
      var name = stepState.moduleName;
      var step = stepState.step;

      if (loader.modules[name])
        throw new TypeError('"' + name + '" already exists in the module table');

      // adjusted to pick up existing loads
      var existingLoad;
      for (var i = 0, l = loader.loads.length; i < l; i++) {
        if (loader.loads[i].name == name) {
          existingLoad = loader.loads[i];

          if(step == 'translate' && !existingLoad.source) {
            existingLoad.address = stepState.moduleAddress;
            proceedToTranslate(loader, existingLoad, Promise.resolve(stepState.moduleSource));
          }

          // a primary load -> use that existing linkset
          if (existingLoad.linkSets.length)
            return existingLoad.linkSets[0].done.then(function() {
              resolve(existingLoad);
            });
        }
      }

      var load = existingLoad || createLoad(name);

      load.metadata = stepState.moduleMetadata;

      var linkSet = createLinkSet(loader, load);

      loader.loads.push(load);

      resolve(linkSet.done);

      if (step == 'locate')
        proceedToLocate(loader, load);

      else if (step == 'fetch')
        proceedToFetch(loader, load, Promise.resolve(stepState.moduleAddress));

      else {
        console.assert(step == 'translate', 'translate step');
        load.address = stepState.moduleAddress;
        proceedToTranslate(loader, load, Promise.resolve(stepState.moduleSource));
      }
    }
  }

  // Declarative linking functions run through alternative implementation:
  // 15.2.5.1.1 CreateModuleLinkageRecord not implemented
  // 15.2.5.1.2 LookupExport not implemented
  // 15.2.5.1.3 LookupModuleDependency not implemented

  // 15.2.5.2.1
  function createLinkSet(loader, startingLoad) {
    var linkSet = {
      loader: loader,
      loads: [],
      startingLoad: startingLoad, // added see spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
      loadingCount: 0
    };
    linkSet.done = new Promise(function(resolve, reject) {
      linkSet.resolve = resolve;
      linkSet.reject = reject;
    });
    addLoadToLinkSet(linkSet, startingLoad);
    return linkSet;
  }
  // 15.2.5.2.2
  function addLoadToLinkSet(linkSet, load) {
    if (load.status == 'failed')
      return;

    console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded on link set');

    for (var i = 0, l = linkSet.loads.length; i < l; i++)
      if (linkSet.loads[i] == load)
        return;

    linkSet.loads.push(load);
    load.linkSets.push(linkSet);

    // adjustment, see https://bugs.ecmascript.org/show_bug.cgi?id=2603
    if (load.status != 'loaded') {
      linkSet.loadingCount++;
    }

    var loader = linkSet.loader;

    for (var i = 0, l = load.dependencies.length; i < l; i++) {
      if (!load.dependencies[i])
        continue;

      var name = load.dependencies[i].value;

      if (loader.modules[name])
        continue;

      for (var j = 0, d = loader.loads.length; j < d; j++) {
        if (loader.loads[j].name != name)
          continue;

        addLoadToLinkSet(linkSet, loader.loads[j]);
        break;
      }
    }
    // console.log('add to linkset ' + load.name);
    // snapshot(linkSet.loader);
  }

  // linking errors can be generic or load-specific
  // this is necessary for debugging info
  function doLink(linkSet) {
    var error = false;
    try {
      link(linkSet, function(load, exc) {
        linkSetFailed(linkSet, load, exc);
        error = true;
      });
    }
    catch(e) {
      linkSetFailed(linkSet, null, e);
      error = true;
    }
    return error;
  }

  // 15.2.5.2.3
  function updateLinkSetOnLoad(linkSet, load) {
    // console.log('update linkset on load ' + load.name);
    // snapshot(linkSet.loader);

    console.assert(load.status == 'loaded' || load.status == 'linked', 'loaded or linked');

    linkSet.loadingCount--;

    if (linkSet.loadingCount > 0)
      return;

    // adjusted for spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
    var startingLoad = linkSet.startingLoad;

    // non-executing link variation for loader tracing
    // on the server. Not in spec.
    /***/
    if (linkSet.loader.loaderObj.execute === false) {
      var loads = [].concat(linkSet.loads);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];
        load.module = !load.isDeclarative ? {
          module: _newModule({})
        } : {
          name: load.name,
          module: _newModule({}),
          evaluated: true
        };
        load.status = 'linked';
        finishLoad(linkSet.loader, load);
      }
      return linkSet.resolve(startingLoad);
    }
    /***/

    var abrupt = doLink(linkSet);

    if (abrupt)
      return;

    console.assert(linkSet.loads.length == 0, 'loads cleared');

    linkSet.resolve(startingLoad);
  }

  // 15.2.5.2.4
  function linkSetFailed(linkSet, load, exc) {
    var loader = linkSet.loader;
    var requests;

    checkError: 
    if (load) {
      if (linkSet.loads[0].name == load.name) {
        exc = addToError(exc, 'Error loading ' + load.name);
      }
      else {
        for (var i = 0; i < linkSet.loads.length; i++) {
          var pLoad = linkSet.loads[i];
          for (var j = 0; j < pLoad.dependencies.length; j++) {
            var dep = pLoad.dependencies[j];
            if (dep.value == load.name) {
              exc = addToError(exc, 'Error loading ' + load.name + ' as "' + dep.key + '" from ' + pLoad.name);
              break checkError;
            }
          }
        }
        exc = addToError(exc, 'Error loading ' + load.name + ' from ' + linkSet.loads[0].name);
      }
    }
    else {
      exc = addToError(exc, 'Error linking ' + linkSet.loads[0].name);
    }


    var loads = linkSet.loads.concat([]);
    for (var i = 0, l = loads.length; i < l; i++) {
      var load = loads[i];

      // store all failed load records
      loader.loaderObj.failed = loader.loaderObj.failed || [];
      if (indexOf.call(loader.loaderObj.failed, load) == -1)
        loader.loaderObj.failed.push(load);

      var linkIndex = indexOf.call(load.linkSets, linkSet);
      console.assert(linkIndex != -1, 'link not present');
      load.linkSets.splice(linkIndex, 1);
      if (load.linkSets.length == 0) {
        var globalLoadsIndex = indexOf.call(linkSet.loader.loads, load);
        if (globalLoadsIndex != -1)
          linkSet.loader.loads.splice(globalLoadsIndex, 1);
      }
    }
    linkSet.reject(exc);
  }

  // 15.2.5.2.5
  function finishLoad(loader, load) {
    // add to global trace if tracing
    if (loader.loaderObj.trace) {
      if (!loader.loaderObj.loads)
        loader.loaderObj.loads = {};
      var depMap = {};
      load.dependencies.forEach(function(dep) {
        depMap[dep.key] = dep.value;
      });
      loader.loaderObj.loads[load.name] = {
        name: load.name,
        deps: load.dependencies.map(function(dep){ return dep.key }),
        depMap: depMap,
        address: load.address,
        metadata: load.metadata,
        source: load.source,
        kind: load.isDeclarative ? 'declarative' : 'dynamic'
      };
    }
    // if not anonymous, add to the module table
    if (load.name) {
      console.assert(!loader.modules[load.name], 'load not in module table');
      loader.modules[load.name] = load.module;
    }
    var loadIndex = indexOf.call(loader.loads, load);
    if (loadIndex != -1)
      loader.loads.splice(loadIndex, 1);
    for (var i = 0, l = load.linkSets.length; i < l; i++) {
      loadIndex = indexOf.call(load.linkSets[i].loads, load);
      if (loadIndex != -1)
        load.linkSets[i].loads.splice(loadIndex, 1);
    }
    load.linkSets.splice(0, load.linkSets.length);
  }

  function doDynamicExecute(linkSet, load, linkError) {
    try {
      var module = load.execute();
    }
    catch(e) {
      linkError(load, e);
      return;
    }
    if (!module || !(module instanceof Module))
      linkError(load, new TypeError('Execution must define a Module instance'));
    else
      return module;
  }

  // 26.3 Loader

  // 26.3.1.1
  // defined at top

  // importPromises adds ability to import a module twice without error - https://bugs.ecmascript.org/show_bug.cgi?id=2601
  function createImportPromise(loader, name, promise) {
    var importPromises = loader._loader.importPromises;
    return importPromises[name] = promise.then(function(m) {
      importPromises[name] = undefined;
      return m;
    }, function(e) {
      importPromises[name] = undefined;
      throw e;
    });
  }

  Loader.prototype = {
    // 26.3.3.1
    constructor: Loader,
    // 26.3.3.2
    define: function(name, source, options) {
      // check if already defined
      if (this._loader.importPromises[name])
        throw new TypeError('Module is already loading.');
      return createImportPromise(this, name, new Promise(asyncStartLoadPartwayThrough({
        step: 'translate',
        loader: this._loader,
        moduleName: name,
        moduleMetadata: options && options.metadata || {},
        moduleSource: source,
        moduleAddress: options && options.address
      })));
    },
    // 26.3.3.3
    'delete': function(name) {
      var loader = this._loader;
      delete loader.importPromises[name];
      delete loader.moduleRecords[name];
      return loader.modules[name] ? delete loader.modules[name] : false;
    },
    // 26.3.3.4 entries not implemented
    // 26.3.3.5
    get: function(key) {
      if (!this._loader.modules[key])
        return;
      doEnsureEvaluated(this._loader.modules[key], [], this);
      return this._loader.modules[key].module;
    },
    // 26.3.3.7
    has: function(name) {
      return !!this._loader.modules[name];
    },
    // 26.3.3.8
    'import': function(name, parentName, parentAddress) {
      if (typeof parentName == 'object')
        parentName = parentName.name;

      // run normalize first
      var loaderObj = this;

      // added, see https://bugs.ecmascript.org/show_bug.cgi?id=2659
      return Promise.resolve(loaderObj.normalize(name, parentName))
      .then(function(name) {
        var loader = loaderObj._loader;

        if (loader.modules[name]) {
          doEnsureEvaluated(loader.modules[name], [], loader._loader);
          return loader.modules[name].module;
        }

        return loader.importPromises[name] || createImportPromise(loaderObj, name,
          loadModule(loader, name, {})
          .then(function(load) {
            delete loader.importPromises[name];
            return evaluateLoadedModule(loader, load);
          }));
      });
    },
    // 26.3.3.9 keys not implemented
    // 26.3.3.10
    load: function(name, options) {
      var loader = this._loader;
      if (loader.modules[name]) {
        doEnsureEvaluated(loader.modules[name], [], loader);
        return Promise.resolve(loader.modules[name].module);
      }
      return loader.importPromises[name] || createImportPromise(this, name,
        loadModule(loader, name, {})
        .then(function(load) {
          delete loader.importPromises[name];
          return evaluateLoadedModule(loader, load);
        }));
    },
    // 26.3.3.11
    module: function(source, options) {
      var load = createLoad();
      load.address = options && options.address;
      var linkSet = createLinkSet(this._loader, load);
      var sourcePromise = Promise.resolve(source);
      var loader = this._loader;
      var p = linkSet.done.then(function() {
        return evaluateLoadedModule(loader, load);
      });
      proceedToTranslate(loader, load, sourcePromise);
      return p;
    },
    // 26.3.3.12
    newModule: function (obj) {
      if (typeof obj != 'object')
        throw new TypeError('Expected object');

      // we do this to be able to tell if a module is a module privately in ES5
      // by doing m instanceof Module
      var m = new Module();

      var pNames;
      if (Object.getOwnPropertyNames && obj != null) {
        pNames = Object.getOwnPropertyNames(obj);
      }
      else {
        pNames = [];
        for (var key in obj)
          pNames.push(key);
      }

      for (var i = 0; i < pNames.length; i++) (function(key) {
        defineProperty(m, key, {
          configurable: false,
          enumerable: true,
          get: function () {
            return obj[key];
          }
        });
      })(pNames[i]);

      if (Object.preventExtensions)
        Object.preventExtensions(m);

      return m;
    },
    // 26.3.3.14
    set: function(name, module) {
      if (!(module instanceof Module))
        throw new TypeError('Loader.set(' + name + ', module) must be a module');
      this._loader.modules[name] = {
        module: module
      };
    },
    // 26.3.3.15 values not implemented
    // 26.3.3.16 @@iterator not implemented
    // 26.3.3.17 @@toStringTag not implemented

    // 26.3.3.18.1
    normalize: function(name, referrerName, referrerAddress) {
      return name;
    },
    // 26.3.3.18.2
    locate: function(load) {
      return load.name;
    },
    // 26.3.3.18.3
    fetch: function(load) {
    },
    // 26.3.3.18.4
    translate: function(load) {
      return load.source;
    },
    // 26.3.3.18.5
    instantiate: function(load) {
    }
  };

  var _newModule = Loader.prototype.newModule;
/*
 * ES6 Module Declarative Linking Code - Dev Build Only
 */
  function link(linkSet, linkError) {

    var loader = linkSet.loader;

    if (!linkSet.loads.length)
      return;

    var loads = linkSet.loads.concat([]);

    for (var i = 0; i < loads.length; i++) {
      var load = loads[i];

      var module = doDynamicExecute(linkSet, load, linkError);
      if (!module)
        return;
      load.module = {
        name: load.name,
        module: module
      };
      load.status = 'linked';

      finishLoad(loader, load);
    }
  }

  function evaluateLoadedModule(loader, load) {
    console.assert(load.status == 'linked', 'is linked ' + load.name);
    return load.module.module;
  }

  function doEnsureEvaluated() {}

  function transpile() {
    throw new TypeError('ES6 transpilation is only provided in the dev module loader build.');
  }
})();/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

    - <script type="module"> supported

*********************************************************************************************
*/

var System;

function SystemLoader() {
  Loader.call(this);
  this.paths = {};
}

// NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25
function applyPaths(paths, name) {
  // most specific (most number of slashes in path) match wins
  var pathMatch = '', wildcard, maxSlashCount = 0;

  // check to see if we have a paths entry
  for (var p in paths) {
    var pathParts = p.split('*');
    if (pathParts.length > 2)
      throw new TypeError('Only one wildcard in a path is permitted');

    // exact path match
    if (pathParts.length == 1) {
      if (name == p) {
        pathMatch = p;
        break;
      }
    }
    // wildcard path match
    else {
      var slashCount = p.split('/').length;
      if (slashCount >= maxSlashCount &&
          name.substr(0, pathParts[0].length) == pathParts[0] &&
          name.substr(name.length - pathParts[1].length) == pathParts[1]) {
            maxSlashCount = slashCount;
            pathMatch = p;
            wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
          }
    }
  }

  var outPath = paths[pathMatch] || name;
  if (wildcard)
    outPath = outPath.replace('*', wildcard);

  return outPath;
}

// inline Object.create-style class extension
function LoaderProto() {}
LoaderProto.prototype = Loader.prototype;
SystemLoader.prototype = new LoaderProto();
// SystemJS Loader Class and Extension helpers

function SystemJSLoader() {
  SystemLoader.call(this);

  systemJSConstructor.call(this);
}

// inline Object.create-style class extension
function SystemProto() {};
SystemProto.prototype = SystemLoader.prototype;
SystemJSLoader.prototype = new SystemProto();

var systemJSConstructor;

function hook(name, hook) {
  SystemJSLoader.prototype[name] = hook(SystemJSLoader.prototype[name]);
}
function hookConstructor(hook) {
  systemJSConstructor = hook(systemJSConstructor || function() {});
}

function dedupe(deps) {
  var newDeps = [];
  for (var i = 0, l = deps.length; i < l; i++)
    if (indexOf.call(newDeps, deps[i]) == -1)
      newDeps.push(deps[i])
  return newDeps;
}

function group(deps) {
  var names = [];
  var indices = [];
  for (var i = 0, l = deps.length; i < l; i++) {
    var index = indexOf.call(names, deps[i]);
    if (index === -1) {
      names.push(deps[i]);
      indices.push([i]);
    }
    else {
      indices[index].push(i);
    }
  }
  return { names: names, indices: indices };
}

var getOwnPropertyDescriptor = true;
try {
  Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
}
catch(e) {
  getOwnPropertyDescriptor = false;
}

// converts any module.exports object into an object ready for System.newModule
function getESModule(exports) {
  var esModule = {};
  // don't trigger getters/setters in environments that support them
  if (typeof exports == 'object' || typeof exports == 'function') {
    if (getOwnPropertyDescriptor) {
      var d;
      for (var p in exports)
        if (d = Object.getOwnPropertyDescriptor(exports, p))
          defineProperty(esModule, p, d);
    }
    else {
      var hasOwnProperty = exports && exports.hasOwnProperty;
      for (var p in exports) {
        if (!hasOwnProperty || exports.hasOwnProperty(p))
          esModule[p] = exports[p];
      }
    }
  }
  esModule['default'] = exports;
  defineProperty(esModule, '__useDefault', {
    value: true
  });
  return esModule;
}

function extend(a, b, prepend) {
  for (var p in b) {
    if (!prepend || !(p in a))
      a[p] = b[p];
  }
  return a;
}

// meta first-level extends where:
// array + array appends
// object + object extends
// other properties replace
function extendMeta(a, b, prepend) {
  for (var p in b) {
    var val = b[p];
    if (!(p in a))
      a[p] = val;
    else if (val instanceof Array && a[p] instanceof Array)
      a[p] = [].concat(prepend ? val : a[p]).concat(prepend ? a[p] : val);
    else if (typeof val == 'object' && typeof a[p] == 'object')
      a[p] = extend(extend({}, a[p]), val, prepend);
    else if (!prepend)
      a[p] = val;
  }
}var absURLRegEx = /^[^\/]+:\/\//;

function readMemberExpression(p, value) {
  var pParts = p.split('.');
  while (pParts.length)
    value = value[pParts.shift()];
  return value;
}

var baseURLCache = {};
function getBaseURLObj() {
  if (baseURLCache[this.baseURL])
    return baseURLCache[this.baseURL];

  // normalize baseURL if not already
  if (this.baseURL[this.baseURL.length - 1] != '/')
    this.baseURL += '/';

  var baseURL = new URL(this.baseURL, baseURI);

  this.baseURL = baseURL.href;

  return (baseURLCache[this.baseURL] = baseURL);
}

var baseURIObj = new URL(baseURI);

(function() {

hookConstructor(function(constructor) {
  return function() {
    constructor.call(this);

    // support baseURL
    this.baseURL = baseURI.substr(0, baseURI.lastIndexOf('/') + 1);

    // support the empty module, as a concept
    this.set('@empty', this.newModule({}));
  };
});

/*
  Normalization

  If a name is relative, we apply URL normalization to the page
  If a name is an absolute URL, we leave it as-is

  Plain names (neither of the above) run through the map and package
  normalization phases (applying before and after this one).

  The paths normalization phase applies last (paths extension), which
  defines the `normalizeSync` function and normalizes everything into
  a URL.

  The final normalization 
 */
hook('normalize', function() {
  return function(name, parentName) {
    // relative URL-normalization
    if (name[0] == '.' || name[0] == '/')
      return new URL(name, parentName || baseURIObj).href;
    return name;
  };
});

/*
  __useDefault
  
  When a module object looks like:
  newModule(
    __useDefault: true,
    default: 'some-module'
  })

  Then importing that module provides the 'some-module'
  result directly instead of the full module.

  Useful for eg module.exports = function() {}
*/
hook('import', function(systemImport) {
  return function(name, parentName, parentAddress) {
    return systemImport.call(this, name, parentName, parentAddress).then(function(module) {
      return module.__useDefault ? module['default'] : module;
    });
  };
});

/*
 Extend config merging one deep only

  loader.config({
    some: 'random',
    config: 'here',
    deep: {
      config: { too: 'too' }
    }
  });

  <=>

  loader.some = 'random';
  loader.config = 'here'
  loader.deep = loader.deep || {};
  loader.deep.config = { too: 'too' };


  Normalizes meta and package configs allowing for:

  System.config({
    meta: {
      './index.js': {}
    }
  });

  To become

  System.meta['https://thissite.com/index.js'] = {};

  For easy normalization canonicalization with latest URL support.

*/
var packageProperties = ['main', 'format', 'defaultExtension', 'meta', 'map'];
SystemJSLoader.prototype.config = function(cfg) {

  // always configure baseURL first
  if (cfg.baseURL) {
    var hasConfig = false;
    function checkHasConfig(obj) {
      for (var p in obj)
        return true;
    }
    if (checkHasConfig(this.packages) || checkHasConfig(this.meta) || checkHasConfig(this.depCache) || checkHasConfig(this.bundles))
      throw new TypeError('baseURL should only be configured once and must be configured first.');

    this.baseURL = cfg.baseURL;

    // sanitize baseURL
    getBaseURLObj.call(this);
  }

  if (cfg.defaultJSExtensions)
    this.defaultJSExtensions = cfg.defaultJSExtensions;

  if (cfg.pluginFirst)
    this.pluginFirst = cfg.pluginFirst;

  if (cfg.paths) {
    for (var p in cfg.paths)
      this.paths[p] = cfg.paths[p];
  }

  if (cfg.map) {
    for (var p in cfg.map) {
      var v = cfg.map[p];

      // object map backwards-compat into packages configuration
      if (typeof v !== 'string') {
        var normalized = this.normalizeSync(p);

        // if doing default js extensions, undo to get package name
        if (this.defaultJSExtensions && p.substr(p.length - 3, 3) != '.js')
          normalized = normalized.substr(0, normalized.length - 3);

        // if a package main, revert it
        var pkgMatch = '';
        for (var pkg in this.packages) {
          if (normalized.substr(0, pkg.length) == pkg 
              && (!normalized[pkg.length] || normalized[pkg.length] == '/') 
              && pkgMatch.split('/').length < pkg.split('/').length)
            pkgMatch = pkg;
        }
        if (pkgMatch && this.packages[pkgMatch].main)
          normalized = normalized.substr(0, normalized.length - this.packages[pkgMatch].main.length - 1);

        var pkg = this.packages[normalized] = this.packages[normalized] || {};
        pkg.map = v;
      }
      else {
        this.map[p] = v;
      }
    }
  }

  if (cfg.packagePaths) {
    for (var i = 0; i < cfg.packagePaths.length; i++) {
      var path = cfg.packagePaths[i];
      var normalized = this.normalizeSync(path);
      if (this.defaultJSExtensions && path.substr(path.length - 3, 3) != '.js')
        normalized = normalized.substr(0, normalized.length - 3);
      cfg.packagePaths[i] = normalized;
    }
  }

  if (cfg.packages) {
    for (var p in cfg.packages) {
      // request with trailing "/" to get package name exactly
      var prop = this.normalizeSync(p + '/');
      prop = prop.substr(0, prop.length - 1);

      // if doing default js extensions, undo to get package name
      if (this.defaultJSExtensions && p.substr(p.length - 3, 3) != '.js')
        prop = prop.substr(0, prop.length - 3);

      this.packages[prop]= this.packages[prop] || {};
      for (var q in cfg.packages[p])
        if (indexOf.call(packageProperties, q) == -1 && typeof console != 'undefined' && console.warn)
          console.warn('"' + q + '" is not a valid package configuration option in package ' + p);

      extendMeta(this.packages[prop], cfg.packages[p]);
    }
  }

  if (cfg.bundles) {
    for (var p in cfg.bundles) {
      var bundle = [];
      for (var i = 0; i < cfg.bundles[p].length; i++)
        bundle.push(this.normalizeSync(cfg.bundles[p][i]));
      this.bundles[p] = bundle;
    }
  }

  for (var c in cfg) {
    var v = cfg[c];
    var normalizeProp = false, normalizeValArray = false;

    if (c == 'baseURL' || c == 'map' || c == 'packages' || c == 'bundles' || c == 'paths')
      continue;

    if (typeof v != 'object' || v instanceof Array) {
      this[c] = v;
    }
    else {
      this[c] = this[c] || {};

      if (c == 'meta' || c == 'depCache')
        normalizeProp = true;

      for (var p in v) {
        if (c == 'meta' && p[0] == '*')
          this[c][p] = v[p];
        else if (normalizeProp)
          this[c][this.normalizeSync(p)] = v[p];
        else
          this[c][p] = v[p];
      }
    }
  }
};

})();/*
 * Script tag fetch
 *
 * When load.metadata.scriptLoad is true, we load via script tag injection.
 */
(function() {

  if (typeof document != 'undefined')
    var head = document.getElementsByTagName('head')[0];

  // call this functione everytime a wrapper executes
  var curSystem;
  // System clobbering protection for Traceur
  SystemJSLoader.prototype.onScriptLoad = function() {
    __global.System = curSystem;
  };

  function webWorkerImport(loader, load) {
    return new Promise(function(resolve, reject) {
      if (load.metadata.integrity)
        reject(new Error('Subresource integrity checking is not supported in web workers.'));

      try {
        importScripts(load.address);
      }
      catch(e) {
        reject(e);
      }

      loader.onScriptLoad(load);
      // if nothing registered, then something went wrong
      if (!load.metadata.registered)
        reject(load.address + ' did not call System.register or AMD define');

      resolve('');
    });
  }

  // override fetch to use script injection
  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;

      if (!load.metadata.scriptLoad || (!isBrowser && !isWorker))
        return fetch.call(this, load);

      if (isWorker)
        return webWorkerImport(loader, load);

      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.async = true;

        function complete(evt) {
          if (s.readyState && s.readyState != 'loaded' && s.readyState != 'complete')
            return;
          cleanup();

          // this runs synchronously after execution
          // we now need to tell the wrapper handlers that
          // this load record has just executed
          loader.onScriptLoad(load);

          // if nothing registered, then something went wrong
          if (!load.metadata.registered)
            reject(load.address + ' did not call System.register or AMD define');

          resolve('');
        }

        function error(evt) {
          cleanup();
          reject(new Error('Unable to load script ' + load.address));
        }

        if (s.attachEvent) {
          s.attachEvent('onreadystatechange', complete);
        }
        else {
          s.addEventListener('load', complete, false);
          s.addEventListener('error', error, false);
        }

        curSystem = __global.System;
        __global.System = loader;
        s.src = load.address;

        if (load.metadata.integrity)
          s.setAttribute('integrity', load.metadata.integrity);

        head.appendChild(s);

        function cleanup() {
          if (s.detachEvent)
            s.detachEvent('onreadystatechange', complete);
          else {
            s.removeEventListener('load', complete, false);
            s.removeEventListener('error', error, false);
          }
          head.removeChild(s);
        }
      });
    };
  });
})();
/*
 * Script-only addition used for production loader
 *
 */
hook('fetch', function(fetch) {
  return function(load) {
    load.metadata.scriptLoad = true;
    // prepare amd define
    if (this.has('@@amd-helpers'))
      this.get('@@amd-helpers').createDefine(this);
    return fetch.call(this, load);
  };
});

// AMD support
// script injection mode calls this function synchronously on load
hook('onScriptLoad', function(onScriptLoad) {
  return function(load) {
    onScriptLoad.call(this, load);

    if (this.has('@@amd-helpers')) {
      var lastModule = this.get('@@amd-helpers').lastModule;
      if (lastModule.anonDefine || lastModule.isBundle) {
        load.metadata.format = 'defined';
        load.metadata.registered = true;
        lastModule.isBundle = false;
      }

      if (lastModule.anonDefine) {
        load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(lastModule.anonDefine.deps) : lastModule.anonDefine.deps;
        load.metadata.execute = lastModule.anonDefine.execute;
        lastModule.anonDefine = null;
      }
    }
  };
});/*
 * Instantiate registry extension
 *
 * Supports Traceur System.register 'instantiate' output for loading ES6 as ES5.
 *
 * - Creates the loader.register function
 * - Also supports metadata.format = 'register' in instantiate for anonymous register modules
 * - Also supports metadata.deps, metadata.execute and metadata.executingRequire
 *     for handling dynamic modules alongside register-transformed ES6 modules
 *
 *
 * The code here replicates the ES6 linking groups algorithm to ensure that
 * circular ES6 compiled into System.register can work alongside circular AMD 
 * and CommonJS, identically to the actual ES6 loader.
 *
 */
(function() {

  /*
   * There are two variations of System.register:
   * 1. System.register for ES6 conversion (2-3 params) - System.register([name, ]deps, declare)
   *    see https://github.com/ModuleLoader/es6-module-loader/wiki/System.register-Explained
   *
   * 2. System.registerDynamic for dynamic modules (3-4 params) - System.registerDynamic([name, ]deps, executingRequire, execute)
   * the true or false statement 
   *
   * this extension implements the linking algorithm for the two variations identical to the spec
   * allowing compiled ES6 circular references to work alongside AMD and CJS circular references.
   *
   */
  var anonRegister;
  var calledRegister = false;
  function doRegister(loader, name, register) {
    calledRegister = true;

    // named register
    if (name) {
      // ideally wouldn't apply map config to bundle names but 
      // dependencies go through map regardless so we can't restrict
      // could reconsider in shift to new spec
      name = (loader.normalizeSync || loader.normalize).call(loader, name);
      register.name = name;
      if (!(name in loader.defined))
        loader.defined[name] = register; 
    }
    // anonymous register
    else {
      if (anonRegister)
        throw new TypeError('Invalid anonymous System.register module load. If loading a single module, ensure anonymous System.register is loaded via System.import. If loading a bundle, ensure all the System.register calls are named.');
      anonRegister = register;
    }
  }
  SystemJSLoader.prototype.register = function(name, deps, declare) {
    if (typeof name != 'string') {
      declare = deps;
      deps = name;
      name = null;
    }

    // dynamic backwards-compatibility
    // can be deprecated eventually
    if (typeof declare == 'boolean')
      return this.registerDynamic.apply(this, arguments);

    doRegister(this, name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  };
  SystemJSLoader.prototype.registerDynamic = function(name, deps, declare, execute) {
    if (typeof name != 'string') {
      execute = declare;
      declare = deps;
      deps = name;
      name = null;
    }

    // dynamic
    doRegister(this, name, {
      declarative: false,
      deps: deps,
      execute: execute,
      executingRequire: declare
    });
  };
  /*
   * Registry side table - loader.defined
   * Registry Entry Contains:
   *    - name
   *    - deps 
   *    - declare for declarative modules
   *    - execute for dynamic modules, different to declarative execute on module
   *    - executingRequire indicates require drives execution for circularity of dynamic modules
   *    - declarative optional boolean indicating which of the above
   *
   * Can preload modules directly on System.defined['my/module'] = { deps, execute, executingRequire }
   *
   * Then the entry gets populated with derived information during processing:
   *    - normalizedDeps derived from deps, created in instantiate
   *    - groupIndex used by group linking algorithm
   *    - evaluated indicating whether evaluation has happend
   *    - module the module record object, containing:
   *      - exports actual module exports
   *
   *    For dynamic we track the es module with:
   *    - esModule actual es module value
   *      
   *    Then for declarative only we track dynamic bindings with the 'module' records:
   *      - name
   *      - exports
   *      - setters declarative setter functions
   *      - dependencies, module records of dependencies
   *      - importers, module records of dependents
   *
   * After linked and evaluated, entries are removed, declarative module records remain in separate
   * module binding table
   *
   */
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);

      this.defined = {};
      this._loader.moduleRecords = {};
    };
  });

  // script injection mode calls this function synchronously on load
  hook('onScriptLoad', function(onScriptLoad) {
    return function(load) {
      onScriptLoad.call(this, load);

      if (calledRegister) {
        // anonymous define
        if (anonRegister)
          load.metadata.entry = anonRegister;

        load.metadata.format = load.metadata.format || 'defined';
        load.metadata.registered = true;
        calledRegister = false;
        anonRegister = null;
      }
    };
  });

  function buildGroups(entry, loader, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      
      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;
      
      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {
        
        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, loader, groups);
    }
  }

  function link(name, loader) {
    var startEntry = loader.defined[name];

    // skip if already linked
    if (startEntry.module)
      return;

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, loader, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry, loader);
        else
          linkDynamicModule(entry, loader);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  function Module() {}
  defineProperty(Module, 'toString', {
    value: function() {
      return 'Module';
    }
  });

  function getOrCreateModuleRecord(name, moduleRecords) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: new Module(), // start from an empty module and extend
      importers: []
    });
  }

  function linkDeclarativeModule(entry, loader) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var moduleRecords = loader._loader.moduleRecords;
    var module = entry.module = getOrCreateModuleRecord(entry.name, moduleRecords);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(__global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });
    
    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute) {
      throw new TypeError('Invalid System.register form for ' + entry.name);
    }

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      // dynamic, already linked in our registry
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the loader registry
      else if (!depEntry) {
        depExports = loader.get(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry, loader);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else {
        module.dependencies.push(null);
      }
      
      // run setters for all entries with the matching dependency name
      var originalIndices = entry.originalIndices[i];
      for (var j = 0, len = originalIndices.length; j < len; ++j) {
        var index = originalIndices[j];
        if (module.setters[index]) {
          module.setters[index](depExports);
        }
      }
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name, loader) {
    var exports;
    var entry = loader.defined[name];

    if (!entry) {
      exports = loader.get(name);
      if (!exports)
        throw new Error('Unable to load dependency ' + name + '.');
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, [], loader);
    
      else if (!entry.evaluated)
        linkDynamicModule(entry, loader);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];
    
    return exports;
  }

  function linkDynamicModule(entry, loader) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        // we know we only need to link dynamic due to linking algorithm
        var depEntry = loader.defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry, loader);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(__global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i], loader);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);
    
    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;

    if (exports && exports.__esModule)
      entry.esModule = exports;
    else
      entry.esModule = getESModule(exports);
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen, loader) {
    var entry = loader.defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!loader.defined[depName])
          loader.get(depName);
        else
          ensureEvaluated(depName, seen, loader);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(__global);
  }

  // override the delete method to also clear the register caches
  hook('delete', function(del) {
    return function(name) {
      delete this._loader.moduleRecords[name];
      delete this.defined[name];
      return del.call(this, name);
    };
  });

  var registerRegEx = /^\s*(\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)*\s*System\.register(Dynamic)?\s*\(/;

  hook('fetch', function(fetch) {
    return function(load) {
      if (this.defined[load.name]) {
        load.metadata.format = 'defined';
        return '';
      }
      
      // this is the synchronous chain for onScriptLoad
      anonRegister = null;
      calledRegister = false;
      
      if (load.metadata.format == 'register')
        load.metadata.scriptLoad = true;

      // NB remove when "deps " is deprecated
      load.metadata.deps = load.metadata.deps || [];
      
      return fetch.call(this, load);
    };
  });

  hook('translate', function(translate) {
    // we run the meta detection here (register is after meta)
    return function(load) {
      return Promise.resolve(translate.call(this, load)).then(function(source) {

        if (typeof load.metadata.deps === 'string')
          load.metadata.deps = load.metadata.deps.split(',');
        load.metadata.deps = load.metadata.deps || [];

        // run detection for register format
        if (load.metadata.format == 'register' || load.metadata.bundle || !load.metadata.format && load.source.match(registerRegEx))
          load.metadata.format = 'register';
        return source;
      });
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;

      var entry;

      // first we check if this module has already been defined in the registry
      if (loader.defined[load.name]) {
        entry = loader.defined[load.name];
        entry.deps = entry.deps.concat(load.metadata.deps);
      }

      // picked up already by a script injection
      else if (load.metadata.entry)
        entry = load.metadata.entry;

      // otherwise check if it is dynamic
      else if (load.metadata.execute) {
        entry = {
          declarative: false,
          deps: load.metadata.deps || [],
          execute: load.metadata.execute,
          executingRequire: load.metadata.executingRequire // NodeJS-style requires or not
        };
      }

      // Contains System.register calls
      else if (load.metadata.format == 'register' || load.metadata.format == 'esm' || load.metadata.format == 'es6') {
        anonRegister = null;
        calledRegister = false;

        if (typeof __exec != 'undefined')
          __exec.call(loader, load);

        if (!calledRegister && !load.metadata.registered)
          throw new TypeError(load.name + ' detected as System.register but didn\'t execute.');

        if (anonRegister)
          entry = anonRegister;
        else
          load.metadata.bundle = true;

        if (!entry && loader.defined[load.name])
          entry = loader.defined[load.name];

        anonRegister = null;
        calledRegister = false;
      }

      // named bundles are just an empty module
      if (!entry)
        entry = {
          declarative: false,
          deps: load.metadata.deps,
          execute: function() {
            return loader.newModule({});
          }
        };

      // place this module onto defined for circular references
      loader.defined[load.name] = entry;
      
      var grouped = group(entry.deps);
      
      entry.deps = grouped.names;
      entry.originalIndices = grouped.indices;
      entry.name = load.name;

      // first, normalize all dependencies
      var normalizePromises = [];
      for (var i = 0, l = entry.deps.length; i < l; i++)
        normalizePromises.push(Promise.resolve(loader.normalize(entry.deps[i], load.name)));

      return Promise.all(normalizePromises).then(function(normalizedDeps) {

        entry.normalizedDeps = normalizedDeps;

        return {
          deps: entry.deps,
          execute: function() {
            // recursively ensure that the module and all its 
            // dependencies are linked (with dependency group handling)
            link(load.name, loader);

            // now handle dependency execution in correct order
            ensureEvaluated(load.name, [], loader);

            // remove from the registry
            loader.defined[load.name] = undefined;

            // return the defined module object
            return loader.newModule(entry.declarative ? entry.module.exports : entry.esModule);
          }
        };
      });
    };
  });
})();
hookConstructor(function(constructor) {
  return function() {
    var loader = this;
    constructor.call(loader);

    var hasOwnProperty = Object.prototype.hasOwnProperty;

    // bare minimum ignores for IE8
    var ignoredGlobalProps = ['_g', 'sessionStorage', 'localStorage', 'clipboardData', 'frames', 'external', 'mozAnimationStartTime', 'webkitStorageInfo', 'webkitIndexedDB'];

    var globalSnapshot;

    function forEachGlobal(callback) {
      if (Object.keys)
        Object.keys(__global).forEach(callback);
      else
        for (var g in __global) {
          if (!hasOwnProperty.call(__global, g))
            continue;
          callback(g);
        }
    }

    function forEachGlobalValue(callback) {
      forEachGlobal(function(globalName) {
        if (indexOf.call(ignoredGlobalProps, globalName) != -1)
          return;
        try {
          var value = __global[globalName];
        }
        catch (e) {
          ignoredGlobalProps.push(globalName);
        }
        callback(globalName, value);
      });
    }

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: function(moduleName, exportName, globals) {
        // disable module detection
        var curDefine = __global.define;
        
        __global.define = undefined;
        __global.exports = undefined;
        if (__global.module && __global.module.exports)
          __global.module = undefined;

        // set globals
        var oldGlobals;
        if (globals) {
          oldGlobals = {};
          for (var g in globals) {
            oldGlobals[g] = globals[g];
            __global[g] = globals[g];
          }
        }

        // store a complete copy of the global object in order to detect changes
        if (!exportName) {
          globalSnapshot = {};

          forEachGlobalValue(function(name, value) {
            globalSnapshot[name] = value;
          });
        }

        // return function to retrieve global
        return function() {
          var globalValue;

          if (exportName) {
            globalValue = readMemberExpression(exportName, __global);
          }
          else {
            var singleGlobal;
            var multipleExports;
            var exports = {};

            forEachGlobalValue(function(name, value) {
              if (globalSnapshot[name] === value)
                return;
              if (typeof value == 'undefined')
                return;
              exports[name] = value;

              if (typeof singleGlobal != 'undefined') {
                if (!multipleExports && singleGlobal !== value)
                  multipleExports = true;
              }
              else {
                singleGlobal = value;
              }
            });
            globalValue = multipleExports ? exports : singleGlobal;
          }

          // revert globals
          if (oldGlobals) {
            for (var g in oldGlobals)
              __global[g] = oldGlobals[g];
          }
          __global.define = curDefine;

          return globalValue;
        };
      }
    }));
  };
});
/*
 * AMD Helper function module
 * Separated into its own file as this is the part needed for full AMD support in SFX builds
 *
 */
hookConstructor(function(constructor) {
  return function() {
    var loader = this;
    constructor.call(this);

    var commentRegEx = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
    var cjsRequirePre = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])";
    var cjsRequirePost = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)";
    var fnBracketRegEx = /\(([^\)]*)\)/;
    var wsRegEx = /^\s+|\s+$/g;
    
    var requireRegExs = {};

    function getCJSDeps(source, requireIndex) {

      // remove comments
      source = source.replace(commentRegEx, '');

      // determine the require alias
      var params = source.match(fnBracketRegEx);
      var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

      // find or generate the regex for this requireAlias
      var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

      requireRegEx.lastIndex = 0;

      var deps = [];

      var match;
      while (match = requireRegEx.exec(source))
        deps.push(match[2] || match[3]);

      return deps;
    }

    /*
      AMD-compatible require
      To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
    */
    function require(names, callback, errback, referer) {
      // in amd, first arg can be a config object... we just ignore
      if (typeof names == 'object' && !(names instanceof Array))
        return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

      // amd require
      if (typeof names == 'string' && typeof callback == 'function')
        names = [names];
      if (names instanceof Array) {
        var dynamicRequires = [];
        for (var i = 0; i < names.length; i++)
          dynamicRequires.push(loader['import'](names[i], referer));
        Promise.all(dynamicRequires).then(function(modules) {
          if (callback)
            callback.apply(null, modules);
        }, errback);
      }

      // commonjs require
      else if (typeof names == 'string') {
        var module = loader.get(loader.normalizeSync(names, referer));
        if (!module)
          throw new Error('Module not already loaded loading "' + names + '" from "' + referer + '".');
        return module.__useDefault ? module['default'] : module;
      }

      else
        throw new TypeError('Invalid require');
    }

    function define(name, deps, factory) {
      if (typeof name != 'string') {
        factory = deps;
        deps = name;
        name = null;
      }
      if (!(deps instanceof Array)) {
        factory = deps;
        deps = ['require', 'exports', 'module'].splice(0, factory.length);
      }

      if (typeof factory != 'function')
        factory = (function(factory) {
          return function() { return factory; }
        })(factory);

      // in IE8, a trailing comma becomes a trailing undefined entry
      if (deps[deps.length - 1] === undefined)
        deps.pop();

      // remove system dependencies
      var requireIndex, exportsIndex, moduleIndex;
      
      if ((requireIndex = indexOf.call(deps, 'require')) != -1) {
        
        deps.splice(requireIndex, 1);

        // only trace cjs requires for non-named
        // named defines assume the trace has already been done
        if (!name)
          deps = deps.concat(getCJSDeps(factory.toString(), requireIndex));
      }

      if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
        deps.splice(exportsIndex, 1);
      
      if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
        deps.splice(moduleIndex, 1);

      var define = {
        name: name,
        deps: deps,
        execute: function(req, exports, module) {

          var depValues = [];
          for (var i = 0; i < deps.length; i++)
            depValues.push(req(deps[i]));

          module.uri = module.id;

          module.config = function() {};

          // add back in system dependencies
          if (moduleIndex != -1)
            depValues.splice(moduleIndex, 0, module);
          
          if (exportsIndex != -1)
            depValues.splice(exportsIndex, 0, exports);
          
          if (requireIndex != -1) {
            function contextualRequire(names, callback, errback) {
              if (typeof names == 'string' && typeof callback != 'function')
                return req(names);
              return require.call(loader, names, callback, errback, module.id);
            }
            contextualRequire.toUrl = function(name) {
              // normalize without defaultJSExtensions
              var defaultJSExtension = loader.defaultJSExtensions && name.substr(name.length - 3, 3) != '.js';
              var url = loader.normalizeSync(name, module.id);
              if (defaultJSExtension && url.substr(url.length - 3, 3) == '.js')
                url = url.substr(0, url.length - 3);
              return url;
            };
            depValues.splice(requireIndex, 0, contextualRequire);
          }

          // set global require to AMD require
          var curRequire = __global.require;
          __global.require = require;

          var output = factory.apply(exportsIndex == -1 ? __global : exports, depValues);

          __global.require = curRequire;

          if (typeof output == 'undefined' && module)
            output = module.exports;

          if (typeof output != 'undefined')
            return output;
        }
      };

      // anonymous define
      if (!name) {
        // already defined anonymously -> throw
        if (lastModule.anonDefine)
          throw new TypeError('Multiple defines for anonymous module');
        lastModule.anonDefine = define;
      }
      // named define
      else {
        // if we don't have any other defines, 
        // then let this be an anonymous define
        // this is just to support single modules of the form:
        // define('jquery')
        // still loading anonymously
        // because it is done widely enough to be useful
        if (!lastModule.anonDefine && !lastModule.isBundle) {
          lastModule.anonDefine = define;
        }
        // otherwise its a bundle only
        else {
          // if there is an anonDefine already (we thought it could have had a single named define)
          // then we define it now
          // this is to avoid defining named defines when they are actually anonymous
          if (lastModule.anonDefine && lastModule.anonDefine.name)
            loader.registerDynamic(lastModule.anonDefine.name, lastModule.anonDefine.deps, false, lastModule.anonDefine.execute);

          lastModule.anonDefine = null;
        }

        // note this is now a bundle
        lastModule.isBundle = true;

        // define the module through the register registry
        loader.registerDynamic(name, define.deps, false, define.execute);
      }
    }
    define.amd = {};

    // adds define as a global (potentially just temporarily)
    function createDefine(loader) {
      lastModule.anonDefine = null;
      lastModule.isBundle = false;

      // ensure no NodeJS environment detection
      var oldModule = __global.module;
      var oldExports = __global.exports;
      var oldDefine = __global.define;

      __global.module = undefined;
      __global.exports = undefined;
      __global.define = define;

      return function() {
        __global.define = oldDefine;
        __global.module = oldModule;
        __global.exports = oldExports;
      };
    }

    var lastModule = {
      isBundle: false,
      anonDefine: null
    };

    loader.set('@@amd-helpers', loader.newModule({
      createDefine: createDefine,
      require: require,
      define: define,
      lastModule: lastModule
    }));
    loader.amdDefine = define;
    loader.amdRequire = require;
  };
});/*
  SystemJS map support
  
  Provides map configuration through
    System.map['jquery'] = 'some/module/map'

  Note that this applies for subpaths, just like RequireJS:

  jquery      -> 'some/module/map'
  jquery/path -> 'some/module/map/path'
  bootstrap   -> 'bootstrap'

  The most specific map is always taken, as longest path length
*/
hookConstructor(function(constructor) {
  return function() {
    constructor.call(this);
    this.map = {};
  };
});

hook('normalize', function(normalize) {
  return function(name, parentName, parentAddress) {
    if (name.substr(0, 1) != '.' && name.substr(0, 1) != '/' && !name.match(absURLRegEx)) {
      var bestMatch, bestMatchLength = 0;

      // now do the global map
      for (var p in this.map) {
        if (name.substr(0, p.length) == p && (name.length == p.length || name[p.length] == '/')) {
          var curMatchLength = p.split('/').length;
          if (curMatchLength <= bestMatchLength)
            continue;
          bestMatch = p;
          bestMatchLength = curMatchLength;
        }
      }

      if (bestMatch)
        name = this.map[bestMatch] + name.substr(bestMatch.length);
    }
    
    return normalize.call(this, name, parentName, parentAddress);
  };
});
/*
 * Paths extension
 * 
 * Applies paths and normalizes to a full URL
 */
hook('normalize', function(normalize) {

  return function(name, parentName) {
    var normalized = normalize.call(this, name, parentName);

    // if the module is in the registry already, use that
    if (this.has(normalized))
      return normalized;

    // percent encode just '#' in urls
    if (isBrowser)
      normalized = normalized.replace(/#/g, '%23');

    if (normalized.match(absURLRegEx)) {
      // defaultJSExtensions backwards compatibility
      if (this.defaultJSExtensions && normalized.substr(normalized.length - 3, 3) != '.js')
        normalized += '.js';
      return normalized;
    }

    // applyPaths implementation provided from ModuleLoader system.js source
    normalized = applyPaths(this.paths, normalized) || normalized;

    // defaultJSExtensions backwards compatibility
    if (this.defaultJSExtensions && normalized.substr(normalized.length - 3, 3) != '.js')
      normalized += '.js';

    // ./x, /x -> page-relative
    if (normalized[0] == '.' || normalized[0] == '/')
      return new URL(normalized, baseURIObj).href;
    // x -> baseURL-relative
    else
      return new URL(normalized, getBaseURLObj.call(this)).href;
  };
});/*
 * Package Configuration Extension
 *
 * Example:
 *
 * System.packages = {
 *   jquery: {
 *     basePath: 'lib', // optionally only use a subdirectory within the package
 *     main: 'index.js', // when not set, package name is requested directly
 *     format: 'amd',
 *     defaultExtension: 'js',
 *     meta: {
 *       '*.ts': {
 *         loader: 'typescript'
 *       },
 *       'vendor/sizzle.js': {
 *         format: 'global'
 *       }
 *     },
 *     map: {
 *        // map internal require('sizzle') to local require('./vendor/sizzle')
 *        sizzle: './vendor/sizzle.js',
 *        // map any internal or external require of 'jquery/vendor/another' to 'another/index.js'
 *        './vendor/another.js': './another/index.js',
 *        // test.js / test -> lib/test.js
 *        './test.js': './lib/test.js',
 *
 *        // environment-specific map configurations
 *        './index.js': {
 *          '~browser': './index-node.js'
 *        }
 *     }
 *   }
 * };
 *
 * Then:
 *   import 'jquery'                       -> jquery/index.js
 *   import 'jquery/submodule'             -> jquery/submodule.js
 *   import 'jquery/submodule.ts'          -> jquery/submodule.ts loaded as typescript
 *   import 'jquery/vendor/another'        -> another/index.js
 *
 * Detailed Behaviours
 * - main is the only property where a leading "./" can be added optionally
 * - map and defaultExtension are applied to the main
 * - defaultExtension adds the extension only if no other extension is present
 * - defaultJSExtensions applies after map when defaultExtension is not set
 * - if a meta value is available for a module, map and defaultExtension are skipped
 * - like global map, package map also applies to subpaths (sizzle/x, ./vendor/another/sub)
 * - condition module map is '@env' module in package or '@system-env' globally
 *
 * In addition, the following meta properties will be allowed to be package
 * -relative as well in the package meta config:
 *   
 *   - loader
 *   - alias
 *
 *
 * Package Configuration Loading
 * 
 * Not all packages may already have their configuration present in the System config
 * For these cases, a list of packagePaths can be provided, which when matched against
 * a request, will first request a ".json" file by the package name to derive the package
 * configuration from. This allows dynamic loading of non-predetermined code, a key use
 * case in SystemJS.
 *
 * Example:
 * 
 *   System.packagePaths = ['packages/*'];
 *
 *   // will first request 'packages/new-package.json' for the package config
 *   // before completing the package request to 'packages/new-package/path'
 *   System.import('packages/new-package/path');
 *
 * When a package matches packagePaths, it will always send a config request for
 * the package configuration.
 * Any existing package configurations for the package will deeply merge with the 
 * package config, with the existing package configurations taking preference.
 * To opt-out of the package configuration request for a package that matches
 * packagePaths, use the { loadConfig: false } package config option.
 * 
 */
(function() {

  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.packages = {};
      this.packagePaths = {};
    };
  });

  function getPackage(name) {
    for (var p in this.packages) {
      if (name.substr(0, p.length) === p && (name.length === p.length || name[p.length] === '/'))
        return p;
    }
  }

  function applyMap(map, name) {
    var bestMatch, bestMatchLength = 0;
    
    for (var p in map) {
      if (name.substr(0, p.length) == p && (name.length == p.length || name[p.length] == '/')) {
        var curMatchLength = p.split('/').length;
        if (curMatchLength <= bestMatchLength)
          continue;
        bestMatch = p;
        bestMatchLength = curMatchLength;
      }
    }

    return bestMatch;
  }

  function envMap(loader, pkgName, pkgMap, name) {
    var map = applyMap(pkgMap, name);
    var mapped = pkgMap[map];

    // conditional package map
    if (mapped) {
      if (typeof mapped == 'object') {
        return loader['import'](pkgMap['@env'] || '@system-env', pkgName)
        .then(function(env) {
          // first map condition to match is used
          for (var e in mapped) {
            var negate = e[0] == '~';

            var value = readMemberExpression(negate ? e.substr(1) : e, env);

            if (!negate && value || negate && !value)
              return mapped[e] + name.substr(map.length);
          }
        });
      }
      // normal map
      else {
        return mapped + name.substr(map.length);
      }
    }
  }

  function getBasePath(pkg) {
    // sanitize basePath
    var basePath = pkg.basePath && pkg.basePath != '.' ? pkg.basePath : '';
    if (basePath) {
      if (basePath.substr(0, 2) == './')
        basePath = basePath.substr(2);
      if (basePath[basePath.length - 1] != '/')
        basePath += '/';
    }
    return basePath;
  }

  function applyPackageConfig(normalized, pkgName, sync, defaultJSExtension) {
    var loader = this;
    var pkg = loader.packages[pkgName];

    var basePath = getBasePath(pkg);

    // main
    if (pkgName === normalized && pkg.main)
      normalized += '/' + (pkg.main.substr(0, 2) == './' ? pkg.main.substr(2) : pkg.main);

    // allow for direct package name normalization with trailling "/" (no main)
    if (normalized.length == pkgName.length + 1 && normalized[pkgName.length] == '/')
      return normalized + (defaultJSExtension && normalized.substr(normalized.length - 3, 3) != '.js' ? '.js' : '');

    // defaultExtension & defaultJSExtension
    // if we have meta for this package, don't do defaultExtensions
    var defaultExtension = '';
    if (!pkg.meta || !(pkg.meta[normalized.substr(pkgName.length + 1)] || pkg.meta['./' + normalized.substr(pkgName.length + 1)])) {
      // apply defaultExtension

      if ('defaultExtension' in pkg && pkgName !== normalized) {
        if (pkg.defaultExtension !== false && (normalized.split('/').pop().lastIndexOf('.') == -1))
          defaultExtension = '.' + pkg.defaultExtension;
      }
      // apply defaultJSExtensions if defaultExtension not set
      else if (defaultJSExtension) {
        defaultExtension = '.js';
      }
    }

    // no submap if name is package itself
    if (normalized.length == pkgName.length)
      return normalized + defaultExtension;

    // sync normalize does not apply package map
    if (sync || !pkg.map)
      return pkgName + '/' + basePath + normalized.substr(pkgName.length + 1) + defaultExtension;

    var subPath = '.' + normalized.substr(pkgName.length);

    // apply submap checking without then with defaultExtension
    return Promise.resolve(envMap(loader, pkgName, pkg.map, subPath))
    .then(function(mapped) {
      if (mapped)
        return mapped;

      if (defaultExtension)
        return envMap(loader, pkgName, pkg.map, subPath + defaultExtension);
    })
    .then(function(mapped) {
      if (mapped) {
        // '.' as a target is the package itself (with package main check)
        if (mapped == '.')
          normalized = loader.normalizeSync(pkgName);
        // internal package map
        else if (mapped.substr(0, 2) == './')
          normalized = pkgName + '/' + basePath + mapped.substr(2);
        // global package map
        else
          normalized = normalize.call(loader, mapped); 
      }
      else
        normalized = pkgName + '/' + basePath + normalized.substr(pkgName.length + 1) + defaultExtension;
      return normalized;
    });
  }

  var packagePathsRegExps = {};
  var pkgConfigPromises = {};
  function createPackageNormalize(normalize, sync) {
    return function(name, parentName) {
      // apply contextual package map first
      if (parentName) {
        var parentPackage = getPackage.call(this, parentName) || 
            this.defaultJSExtensions && parentName.substr(parentName.length - 3, 3) == '.js' && 
            getPackage.call(this, parentName.substr(0, parentName.length - 3));
      }

      if (parentPackage && name[0] !== '.') {
        var parentMap = this.packages[parentPackage].map;
        if (parentMap) {
          var map = applyMap(parentMap, name);

          if (map) {
            name = parentMap[map] + name.substr(map.length);

            // relative maps are package-relative
            if (name[0] === '.')
              parentName = parentPackage + '/';
          }
        }
      }

      var defaultJSExtension = this.defaultJSExtensions && name.substr(name.length - 3, 3) != '.js';

      // apply global map, relative normalization
      var normalized = normalize.call(this, name, parentName);

      // undo defaultJSExtension
      if (normalized.substr(normalized.length - 3, 3) != '.js')
        defaultJSExtension = false;
      if (defaultJSExtension)
        normalized = normalized.substr(0, normalized.length - 3);

      // check if we are inside a package
      var pkgName = getPackage.call(this, normalized);

      var loader = this;
      
      // check if we match a packagePaths
      if (!sync) {
        var pkgPath;
        for (var i = 0; i < this.packagePaths.length; i++) {
          var match = normalized.match(packagePathsRegExps[this.packagePaths[i]] || 
              (packagePathsRegExps[this.packagePaths[i]] = new RegExp('^' + this.packagePaths[i].replace(/\*/g, '[^\\/]+'))));
          if (match) {
            pkgPath = match[0];
            break;
          }
        }

        if (pkgPath && (!pkgName || pkgName != pkgPath || loader.packages[pkgName].loadConfig !== false)) {
          return (pkgConfigPromises[pkgPath] || 
            (pkgConfigPromises[pkgPath] = 
              loader['fetch']({ name: pkgPath + '.json', address: pkgPath + '.json', metadata: {} })
              .then(function(source) {
                try {
                  return JSON.parse(source);
                }
                catch(e) {
                  throw new Error('Invalid JSON in package configuration file ' + pkgPath);
                }
              })
              .then(function(cfg) {
                // deeply-merge (to first level) config with any existing package config
                if (pkgName && pkgName == pkgPath)
                  extendMeta(cfg, loader.packages[pkgPath]);

                loader.packages[pkgPath] = cfg;
              })
            )
          )
          .then(function() {
            // finally apply the package config we just created to the current request
            return applyPackageConfig.call(loader, normalized, pkgPath, sync, defaultJSExtension);
          });
        }
      }

      if (pkgName)
        return applyPackageConfig.call(loader, normalized, pkgName, sync, defaultJSExtension);
      
      // add back defaultJSExtension if not a package
      if (defaultJSExtension)
        normalized += '.js';

      return normalized;
    };
  }

  SystemJSLoader.prototype.normalizeSync = SystemJSLoader.prototype.normalize;

  hook('normalizeSync', function(normalize) {
    return createPackageNormalize(normalize, true);
  });

  hook('normalize', function(normalize) {
    return createPackageNormalize(normalize, false);
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;
      return Promise.resolve(locate.call(this, load))
      .then(function(address) {
        var pkgName = getPackage.call(loader, load.name);
        if (pkgName) {
          var pkg = loader.packages[pkgName];

          var basePath = getBasePath(pkg);
          
          // format
          if (pkg.format)
            load.metadata.format = load.metadata.format || pkg.format;

          // loader
          if (pkg.loader)
            load.metadata.loader = load.metadata.loader || pkg.loader;

          if (pkg.meta) {
            // wildcard meta
            var meta = {};
            var bestDepth = 0;
            var wildcardIndex;
            for (var module in pkg.meta) {
              // allow meta to start with ./ for flexibility
              var dotRel = module.substr(0, 2) == './' ? './' : '';
              if (dotRel)
                module = module.substr(2);

              wildcardIndex = module.indexOf('*');
              if (wildcardIndex === -1)
                continue;

              if (basePath + module.substr(0, wildcardIndex) === load.name.substr(pkgName.length + 1, wildcardIndex + basePath.length)
                  && module.substr(wildcardIndex + 1) === load.name.substr(load.name.length - module.length + wildcardIndex + 1)) {
                var depth = module.split('/').length;
                if (depth > bestDepth)
                  bestDetph = depth;
                extendMeta(meta, pkg.meta[dotRel + module], bestDepth != depth);
              }
            }
            // exact meta
            var metaName = load.name.substr(pkgName.length + basePath.length + 1);
            var exactMeta = pkg.meta[metaName] || pkg.meta['./' + metaName];
            if (exactMeta && load.name.substr(pkgName.length + 1, basePath.length) == basePath)
              extendMeta(meta, exactMeta);

            // allow alias and loader to be package-relative
            if (meta.alias && meta.alias.substr(0, 2) == './')
              meta.alias = pkgName + meta.alias.substr(1);
            if (meta.loader && meta.loader.substr(0, 2) == './')
              meta.loader = pkgName + meta.loader.substr(1);
            
            extendMeta(load.metadata, meta);
          }
        }

        return address;
      });
    };
  });

})();/*
  SystemJS Loader Plugin Support

  Supports plugin loader syntax with "!", or via metadata.loader

  The plugin name is loaded as a module itself, and can override standard loader hooks
  for the plugin resource. See the plugin section of the systemjs readme.
*/
(function() {

  // sync or async plugin normalize function
  function normalizePlugin(normalize, name, parentName, sync) {
    var loader = this;
    // if parent is a plugin, normalize against the parent plugin argument only
    if (parentName) {
      var parentPluginIndex;
      if (loader.pluginFirst) {
        if ((parentPluginIndex = parentName.lastIndexOf('!')) != -1)
          parentName = parentName.substr(parentPluginIndex + 1);
      }
      else {
        if ((parentPluginIndex = parentName.indexOf('!')) != -1)
          parentName = parentName.substr(0, parentPluginIndex);
      }
    }

    // if this is a plugin, normalize the plugin name and the argument
    var pluginIndex = name.lastIndexOf('!');
    if (pluginIndex != -1) {
      var argumentName;
      var pluginName;

      if (loader.pluginFirst) {
        argumentName = name.substr(pluginIndex + 1);
        pluginName = name.substr(0, pluginIndex);
      }
      else {
        argumentName = name.substr(0, pluginIndex);
        pluginName = name.substr(pluginIndex + 1) || argumentName.substr(argumentName.lastIndexOf('.') + 1);
      }

      // note if normalize will add a default js extension
      // if so, remove for backwards compat
      // this is strange and sucks, but will be deprecated
      var defaultExtension = loader.defaultJSExtensions && argumentName.substr(argumentName.length - 3, 3) != '.js';

      // put name back together after parts have been normalized
      function normalizePluginParts(argumentName, pluginName) {
        if (defaultExtension && argumentName.substr(argumentName.length - 3, 3) == '.js')
          argumentName = argumentName.substr(0, argumentName.length - 3);

        if (loader.pluginFirst) {
          return pluginName + '!' + argumentName;
        }
        else {
          return argumentName + '!' + pluginName;
        }
      }

      if (sync) {
        argumentName = loader.normalizeSync(argumentName, parentName);
        pluginName = loader.normalizeSync(pluginName, parentName);

        return normalizePluginParts(argumentName, pluginName);
      }
      else {
        return Promise.all([
          loader.normalize(argumentName, parentName),
          loader.normalize(pluginName, parentName)
        ])
        .then(function(normalized) {
          return normalizePluginParts(normalized[0], normalized[1]);
        });
      }
    }
    else {
      return normalize.call(loader, name, parentName);
    }
  }

  // async plugin normalize
  hook('normalize', function(normalize) {
    return function(name, parentName) {
      return normalizePlugin.call(this, normalize, name, parentName, false);
    };
  });

  hook('normalizeSync', function(normalizeSync) {
    return function(name, parentName) {
      return normalizePlugin.call(this, normalizeSync, name, parentName, true);
    };
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;

      var name = load.name;

      // plugin syntax
      var pluginSyntaxIndex;
      if (loader.pluginFirst) {
        if ((pluginSyntaxIndex = name.indexOf('!')) != -1) {
          load.metadata.loader = name.substr(0, pluginSyntaxIndex);
          load.name = name.substr(pluginSyntaxIndex + 1);
        }
      }
      else {
        if ((pluginSyntaxIndex = name.lastIndexOf('!')) != -1) {
          load.metadata.loader = name.substr(pluginSyntaxIndex + 1);
          load.name = name.substr(0, pluginSyntaxIndex);
        }
      }

      return locate.call(loader, load)
      .then(function(address) {
        var plugin = load.metadata.loader;

        if (!plugin)
          return address;

        // only fetch the plugin itself if this name isn't defined
        if (loader.defined && loader.defined[name])
          return address;

        var pluginLoader = loader.pluginLoader || loader;

        // load the plugin module and run standard locate
        return pluginLoader['import'](plugin)
        .then(function(loaderModule) {
          // store the plugin module itself on the metadata
          load.metadata.loaderModule = loaderModule;

          load.address = address;
          if (loaderModule.locate)
            return loaderModule.locate.call(loader, load);

          return address;
        });
      });
    };
  });

  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;
      if (load.metadata.loaderModule && load.metadata.loaderModule.fetch) {
        load.metadata.scriptLoad = false;
        return load.metadata.loaderModule.fetch.call(loader, load, function(load) {
          return fetch.call(loader, load);
        });
      }
      else {
        return fetch.call(loader, load);
      }
    };
  });

  hook('translate', function(translate) {
    return function(load) {
      var loader = this;
      if (load.metadata.loaderModule && load.metadata.loaderModule.translate)
        return Promise.resolve(load.metadata.loaderModule.translate.call(loader, load)).then(function(result) {
          if (typeof result == 'string')
            load.source = result;
          return translate.call(loader, load);
        });
      else
        return translate.call(loader, load);
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;

      /*
       * Source map sanitization for load.metadata.sourceMap
       * Used to set browser and build-level source maps for
       * translated sources in a general way.
       */
      var sourceMap = load.metadata.sourceMap;

      // if an object not a JSON string do sanitizing
      if (sourceMap && typeof sourceMap == 'object') {
        var originalName = load.name.split('!')[0];

        // force set the filename of the original file
        sourceMap.file = originalName + '!transpiled';

        // force set the sources list if only one source
        if (!sourceMap.sources || sourceMap.sources.length == 1)
          sourceMap.sources = [originalName];
        load.metadata.sourceMap = JSON.stringify(sourceMap);
      }

      if (load.metadata.loaderModule && load.metadata.loaderModule.instantiate)
        return Promise.resolve(load.metadata.loaderModule.instantiate.call(loader, load)).then(function(result) {
          load.metadata.format = 'defined';
          load.metadata.execute = function() {
            return result;
          };
          return instantiate.call(loader, load);
        });
      else
        return instantiate.call(loader, load);
    };
  });

})();
/*
 * Alias Extension
 *
 * Allows a module to be a plain copy of another module by module name
 *
 * System.meta['mybootstrapalias'] = { alias: 'bootstrap' };
 *
 */
(function() {
  // aliases
  hook('fetch', function(fetch) {
    return function(load) {
      var alias = load.metadata.alias;
      var aliasDeps = load.metadata.deps || [];
      if (alias) {
        load.metadata.format = 'defined';
        this.defined[load.name] = {
          declarative: true,
          deps: aliasDeps.concat([alias]),
          declare: function(_export) {
            return {
              setters: [function(module) {
                for (var p in module)
                  _export(p, module[p]);
              }],
              execute: function() {}
            };
          }
        };
        return '';
      }

      return fetch.call(this, load);
    };
  });
})();/*
 * Meta Extension
 *
 * Sets default metadata on a load record (load.metadata) from
 * loader.metadata via System.meta function.
 *
 *
 * Also provides an inline meta syntax for module meta in source.
 *
 * Eg:
 *
 * loader.meta({
 *   'my/module': { deps: ['jquery'] }
 *   'my/*': { format: 'amd' }
 * });
 * 
 * Which in turn populates loader.metadata.
 *
 * load.metadata.deps and load.metadata.format will then be set
 * for 'my/module'
 *
 * The same meta could be set with a my/module.js file containing:
 * 
 * my/module.js
 *   "format amd"; 
 *   "deps[] jquery";
 *   "globals.some value"
 *   console.log('this is my/module');
 *
 * Configuration meta always takes preference to inline meta.
 *
 * Multiple matches in wildcards are supported and ammend the meta.
 *
 *
 * The benefits of the function form is that paths are URL-normalized
 * supporting say
 *
 * loader.meta({ './app': { format: 'cjs' } });
 *
 * Instead of needing to set against the absolute URL (https://site.com/app.js)
 * 
 */

(function() {

  hookConstructor(function(constructor) {
    return function() {
      this.meta = {};
      constructor.call(this);
    };
  });

  hook('locate', function(locate) {
    return function(load) {
      var meta = this.meta;
      var name = load.name;

      // NB for perf, maybe introduce a fast-path wildcard lookup cache here
      // which is checked first

      // apply wildcard metas
      var bestDepth = 0;
      var wildcardIndex;
      for (var module in meta) {
        wildcardIndex = module.indexOf('*');
        if (wildcardIndex === -1)
          continue;
        if (module.substr(0, wildcardIndex) === name.substr(0, wildcardIndex)
            && module.substr(wildcardIndex + 1) === name.substr(name.length - module.length + wildcardIndex + 1)) {
          var depth = module.split('/').length;
          if (depth > bestDepth)
            bestDetph = depth;
          extendMeta(load.metadata, meta[module], bestDepth != depth);
        }
      }

      // apply exact meta
      if (meta[name])
        extendMeta(load.metadata, meta[name]);

      return locate.call(this, load);
    };
  });

  // detect any meta header syntax
  // only set if not already set
  var metaRegEx = /^(\s*\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/;
  var metaPartRegEx = /\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;

  function setMetaProperty(target, p, value) {
    var pParts = p.split('.');
    var curPart;
    while (pParts.length > 1) {
      curPart = pParts.shift();
      target = target[curPart] = target[curPart] || {};
    }
    curPart = pParts.shift();
    if (!(curPart in target))
      target[curPart] = value;
  }

  hook('translate', function(translate) {
    return function(load) {
      // NB meta will be post-translate pending transpiler conversion to plugins
      var meta = load.source.match(metaRegEx);
      if (meta) {
        var metaParts = meta[0].match(metaPartRegEx);

        for (var i = 0; i < metaParts.length; i++) {
          var curPart = metaParts[i];
          var len = curPart.length;

          var firstChar = curPart.substr(0, 1);
          if (curPart.substr(len - 1, 1) == ';')
            len--;
        
          if (firstChar != '"' && firstChar != "'")
            continue;

          var metaString = curPart.substr(1, curPart.length - 3);
          var metaName = metaString.substr(0, metaString.indexOf(' '));

          if (metaName) {
            var metaValue = metaString.substr(metaName.length + 1, metaString.length - metaName.length - 1);

            if (metaName.substr(metaName.length - 2, 2) == '[]') {
              metaName = metaName.substr(0, metaName.length - 2);
              load.metadata[metaName] = load.metadata[metaName] || [];
            }

            // temporary backwards compat for previous "deps" syntax
            if (load.metadata[metaName] instanceof Array)
              load.metadata[metaName].push(metaValue);
            else
              setMetaProperty(load.metadata, metaName, metaValue);
          }
          else {
            load.metadata[metaString] = true;
          }
        }
      }
      
      return translate.call(this, load);
    };
  });
})();/*
  System bundles

  Allows a bundle module to be specified which will be dynamically 
  loaded before trying to load a given module.

  For example:
  System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']

  Will result in a load to "mybundle" whenever a load to "jquery"
  or "bootstrap/js/bootstrap" is made.

  In this way, the bundle becomes the request that provides the module
*/

(function() {
  // bundles support (just like RequireJS)
  // bundle name is module name of bundle itself
  // bundle is array of modules defined by the bundle
  // when a module in the bundle is requested, the bundle is loaded instead
  // of the form System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.bundles = {};
      this.loadedBundles_ = {};
    };
  });

  function loadFromBundle(loader, bundle) {
    return Promise.resolve(loader.normalize(bundle))
    .then(function(normalized) {
      loader.loadedBundles_[normalized] = true;
      loader.bundles[normalized] = loader.bundles[normalized] || loader.bundles[bundle];
      return loader.load(normalized);
    })
    .then(function() {
      return '';
    });
  }

  // assign bundle metadata for bundle loads
  hook('locate', function(locate) {
    return function(load) {
      if (load.name in this.loadedBundles_ || load.name in this.bundles)
        load.metadata.bundle = true;

      return locate.call(this, load);
    };
  });

  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;
      if (loader.trace || loader.builder)
        return fetch.call(loader, load);
      
      // if already defined, no need to load a bundle
      if (load.name in loader.defined)
        return '';

      // check if it is in an already-loaded bundle
      for (var b in loader.loadedBundles_) {
        if (indexOf.call(loader.bundles[b], load.name) != -1)
          return loadFromBundle(loader, b);
      }

      // check if it is a new bundle
      for (var b in loader.bundles) {
        if (indexOf.call(loader.bundles[b], load.name) != -1)
          return loadFromBundle(loader, b);
      }

      return fetch.call(loader, load);
    };
  });
})();
/*
 * Dependency Tree Cache
 * 
 * Allows a build to pre-populate a dependency trace tree on the loader of 
 * the expected dependency tree, to be loaded upfront when requesting the
 * module, avoinding the n round trips latency of module loading, where 
 * n is the dependency tree depth.
 *
 * eg:
 * System.depCache = {
 *  'app': ['normalized', 'deps'],
 *  'normalized': ['another'],
 *  'deps': ['tree']
 * };
 * 
 * System.import('app') 
 * // simultaneously starts loading all of:
 * // 'normalized', 'deps', 'another', 'tree'
 * // before "app" source is even loaded
 */

(function() {
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.depCache = {};
    }
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;
      // load direct deps, in turn will pick up their trace trees
      var deps = loader.depCache[load.name];
      if (deps)
        for (var i = 0; i < deps.length; i++)
          loader['import'](deps[i]);

      return locate.call(loader, load);
    };
  });
})();
  
/*
 * Conditions Extension
 *
 *   Allows a condition module to alter the resolution of an import via syntax:
 *
 *     import $ from 'jquery/#{browser}';
 *
 *   Will first load the module 'browser' via `System.import('browser')` and 
 *   take the default export of that module.
 *   If the default export is not a string, an error is thrown.
 * 
 *   We then substitute the string into the require to get the conditional resolution
 *   enabling environment-specific variations like:
 * 
 *     import $ from 'jquery/ie'
 *     import $ from 'jquery/firefox'
 *     import $ from 'jquery/chrome'
 *     import $ from 'jquery/safari'
 *
 *   It can be useful for a condition module to define multiple conditions.
 *   This can be done via the `.` modifier to specify a member expression:
 *
 *     import 'jquery/#{browser.grade}'
 *
 *   Where the `grade` export of the `browser` module is taken for substitution.
 *
 *   Note that `/` and a leading `.` are not permitted within conditional modules
 *   so that this syntax can be well-defined.
 *
 *
 * Boolean Conditionals
 *
 *   For polyfill modules, that are used as imports but have no module value,
 *   a binary conditional allows a module not to be loaded at all if not needed:
 *
 *     import 'es5-shim#?conditions.needs-es5shim'
 *
 */
(function() {

  var conditionalRegEx = /#\{[^\}]+\}|#\?.+$/;

  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);

      // standard environment module, starting small as backwards-compat matters!
      this.set('@system-env', this.newModule({
        browser: isBrowser,
        node: !!this._nodeRequire
      }));
    };
  });

  hook('normalize', function(normalize) {
    return function(name, parentName, parentAddress) {
      var loader = this;
      var conditionalMatch = name.match(conditionalRegEx);
      if (conditionalMatch) {
        var substitution = conditionalMatch[0][1] != '?';
        
        var conditionModule = substitution ? conditionalMatch[0].substr(2, conditionalMatch[0].length - 3) : conditionalMatch[0].substr(2);

        if (conditionModule[0] == '.' || conditionModule.indexOf('/') != -1)
          throw new TypeError('Invalid condition ' + conditionalMatch[0] + '\n\tCondition modules cannot contain . or / in the name.');

        var conditionExport;
        var conditionExportIndex = conditionModule.indexOf('.');
        if (conditionExportIndex != -1) {
          conditionExport = conditionModule.substr(conditionExportIndex + 1);
          conditionModule = conditionModule.substr(0, conditionExportIndex);
        }

        var booleanNegation = !substitution && conditionModule[0] == '~';
        if (booleanNegation)
          conditionModule = conditionModule.substr(1);

        var pluginLoader = loader.pluginLoader || loader;
        
        return pluginLoader['import'](conditionModule, parentName, parentAddress)
        .then(function(m) {
          if (conditionExport === undefined) {
            // CommonJS case
            if (typeof m == 'string')
              return m;
            else
              return m['default'];
          }
          
          return readMemberExpression(conditionExport, m);
        })
        .then(function(conditionValue) {
          if (substitution) {
            if (typeof conditionValue !== 'string')
              throw new TypeError('The condition value for ' + conditionModule + ' doesn\'t resolve to a string.');
            name = name.replace(conditionalRegEx, conditionValue);
          }
          else {
            if (typeof conditionValue !== 'boolean')
              throw new TypeError('The condition value for ' + conditionModule + ' isn\'t resolving to a boolean.');
            if (booleanNegation)
              conditionValue = !conditionValue;
            if (!conditionValue)
              name = '@empty';
            else
              name = name.replace(conditionalRegEx, '');
          }
          return normalize.call(loader, name, parentName, parentAddress);
        });
      }

      return Promise.resolve(normalize.call(loader, name, parentName, parentAddress));
    };
  });

})();System = new SystemJSLoader();
System.constructor = SystemJSLoader;  // -- exporting --

  if (typeof exports === 'object')
    module.exports = Loader;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;
  __global.Reflect.global = __global.Reflect.global || __global;
  __global.LoaderPolyfill = Loader;

  if (!System) {
    System = new SystemLoader();
    System.constructor = SystemLoader;
  }

  if (typeof exports === 'object')
    module.exports = System;

  __global.System = System;

})(typeof self != 'undefined' ? self : global);}

// auto-load Promise and URL polyfills if needed in the browser
try {
  var hasURL = typeof URLPolyfill != 'undefined' || new URL('test:///').protocol == 'test:';
}
catch(e) {}

if (typeof Promise === 'undefined' || !hasURL) {
  // document.write
  if (typeof document !== 'undefined') {
    var scripts = document.getElementsByTagName('script');
    $__curScript = scripts[scripts.length - 1];
    var curPath = $__curScript.src;
    var basePath = curPath.substr(0, curPath.lastIndexOf('/') + 1);
    window.systemJSBootstrap = bootstrap;
    document.write(
      '<' + 'script type="text/javascript" src="' + basePath + 'system-polyfills.js">' + '<' + '/script>'
    );
  }
  // importScripts
  else if (typeof importScripts !== 'undefined') {
    var basePath = '';
    try {
      throw new Error('_');
    } catch (e) {
      e.stack.replace(/(?:at|@).*(http.+):[\d]+:[\d]+/, function(m, url) {
        basePath = url.replace(/\/[^\/]*$/, '/');
      });
    }
    importScripts(basePath + 'system-polyfills.js');
    bootstrap();
  }
  else {
    bootstrap();
  }
}
else {
  bootstrap();
}


})();