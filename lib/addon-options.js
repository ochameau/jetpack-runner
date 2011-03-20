const path = require("path");
const SELF = require("self");
const URL = require("url");

function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

exports.buildGeneric = function (packages, mainPackageName, additionalPackagesToInclude) {  
  let targetPackage = packages[mainPackageName];
  
  let jid = targetPackage.id ? targetPackage.id : 
    ("jid0-" + new Date().getTime());
  let prefix = jid.toLowerCase();
  
  let options = {
    jetpackID: jid,
    bundleID: jid + "@jetpack",
    
    // Give information to load main XPCOM component
    bootstrap: {
      classID: guid(),
      contractID: "@mozilla.org/harness-service;1?id="+jid
    },
    // That XPCOM component is going to use this loader to load all others
    loader: "resource://" + prefix + "-api-utils-lib/cuddlefish.js",
    
    // Then the loader will use all these data to find modules
    resourcePackages: {}, // map all resources id (resource "domain name")
                          //   to package name
    packageData: {},      // map all package name of packages with data folder,
                          //   with related resource url
    rootPaths: [],        // list of all resources urls
    resources: {},        // map of all resource url with absolute path of them
    manifest: {},         // bunch of data for each modules file
    
    // Extra data, may be used by packaging tools
    metadata: {},
    
    // Run options
    verbose: true,
    enable_e10s: false,
    profileMemory: 0,
    staticArgs: {} // Seems to be used by main.js, as main.js:main function
                   // receive options object as first argument,
                   // it has access to this staticArgs ...
  };
  
  function includeOneModule(packageName, dir, module) {
    let name = module.name.replace(/\.js$/,"");
    let resourceId = prefix + "-" + packageName + "-" + dir;
    let resourcePath = "resource://" + resourceId + "/" + module.path.join("/") 
       + (module.path.length>0?"/":"") + module.name;    
    
    options.manifest[resourcePath] = {
      "e10s-adapter": null,
      "hash": "cb48bee8c6d7c545b73f0b05115e70f41417352131fc49634fe18051bba47b99",
      "name": name,
      "sectionName": dir,
      "chrome": true,
      "packageName": packageName,
      "zipname": resourcePath,
      "requires": {/* TODO
        "unload": object{
          "url": string"resource://jetinspector-api-utils-lib/unload.js"
        },
        "observer-service": object{
          "url": string"resource://jetinspector-api-utils-lib/observer-service.js"
        },
        "timer": object{
          "url": string"resource://jetinspector-api-utils-lib/timer.js"
        },
        "xul-app": object{
          "url": string"resource://jetinspector-api-utils-lib/xul-app.js"
        },
        "events": object{
          "url": string"resource://jetinspector-api-utils-lib/events.js"
        }*/
      }
    };
  }
  

  let includedPackages = {};
  function includePackage(name, requiredBy) {
    let p = packages[name];
    if (!p)
      throw new Error("Unable to found package with name : " + name + 
        (requiredBy?" (required by " + requiredBy + ")":""));
    if (includedPackages[p.name]) return;
    includedPackages[p.name]=true;
    
    if (p.dependencies) {
      for(let j=0; j<p.dependencies.length; j++) {
        includePackage(p.dependencies[j], p.name);
      }
    }
    
    //console.log("Register package : "+p.name);
    let extra = require("packages-inspector").getExtraInfo(p);
    
    function registerOneResourcesDir(dir, dirType) {
      let resourceId = prefix + "-" + p.name + "-" + dir;
      let resourcePath = "resource://" + resourceId;
      options.resources[resourceId] = path.join(p.root_dir, dir);
      options.resourcePackages[resourceId] = p.name;
      options.rootPaths.push(resourcePath);
      if (dirType == "data")
        options.packageData[p.name] = resourcePath+"/";
    }
    
    function readCommonJSDirectories(modulesByDir, dirType) {
      for(let dir in modulesByDir) {
        for each(let module in modulesByDir[dir]) {
          includeOneModule(p.name, dir, module);
        }
        registerOneResourcesDir(dir, dirType);
      }
    }
    
    readCommonJSDirectories(extra.libs, "libs");
    if (p.name == mainPackageName)
      readCommonJSDirectories(extra.tests, "tests");
    
    for(let i=0; i<p.data.length; i++) {
      let dir = p.data[i];
      registerOneResourcesDir(dir, "data");
    }
    
    options.metadata[p.name] = {
      name: p.name,
      fullName: p.fullName,
      license: p.license,
      author: p.author,
      version: p.version,
      contributors: p.contributors,
      keywords: p.keywords,
      description: p.description,
      homepage: p.homepage
    }
  }
  
  // Force api-utils inclusion, at least for loader/cuddlefish.js
  includePackage("api-utils");
  
  includePackage(mainPackageName);
  
  if (additionalPackagesToInclude) {
    for(let i=0; i<additionalPackagesToInclude.length; i++)
      includePackage(additionalPackagesToInclude[i]);
  }
  
  return options;
}


exports.buildForTest = function (input) {
  let options = exports.buildGeneric(
    input.packages, 
    input.mainPackageName, 
    ["test-harness"]);
  
  if (input.testName)
    options.filter = input.testName;
  
  options.iterations = 1;
  options.main  = "run-tests";
  options.verbose = true;
  
  //options.logFile = require("temp").path("harness_log");
  // If there is no resultFile
  // harness.js won't try to kill firefox at end of tests!
  //options.resultFile = require("temp").path("harness_result-" + 
  //  Math.round(Math.random()*100+1));
  
  return options;
}

exports.buildForRun = function (input) {
  let options = exports.buildGeneric(
    input.packages, 
    input.mainPackageName);
  
  options.main  = "main";
  options.verbose = true;
  
  return options;
}
