const path = require("path");
const SELF = require("self");
const URL = require("url");
const requireParser = require("require-parser");

function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

exports.buildGeneric = function (packages, mainPackageName, additionalPackagesToInclude) {
  // Retrieve additional data from packages, mainly read lib, data and tests folders
  for each (let p in packages)
    p.extra = require("packages-inspector").getExtraInfo(p);
  
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
    
    sdkVersion: "1.0b5pre",
    
    // Run options
    verbose: true,
    enable_e10s: false,
    profileMemory: 0,
    staticArgs: {} // Seems to be used by main.js, as main.js:main function
                   // receive options object as first argument,
                   // it has access to this staticArgs ...
  };
  
  
  function searchModule(packageName, moduleName, requiredFrom, forcePackage) {
    if (packageName) {
      let p = packages[packageName];
      if (!p)
        throw new Error("Unable to found package `" + packageName + "`" + 
                        (requiredFrom?" (required from " + requiredFrom + ")":""));
      
      for each (let directory in p.extra.libs) {
        for each (let module in directory) {
          if (module.name == moduleName)
            return {
              package: p,
              module: module
            };
        }
      }
      if (forcePackage)
        throw new Error("Unable to found module `" + moduleName + "` from package `" +
                      packageName + "`" +
                      (requiredFrom?" (required from " + requiredFrom + ")":""));
    }
    for each (let p in packages) {
      for each (let module in p.extra.libs) {
        if (module.name == moduleName)
          return {
            package: p,
            module: module
          };
      }
    }
    throw new Error("Unable to found module `" + moduleName + "`" +
                    (requiredFrom?" (required from " + requiredFrom + ")":""));
  }
  
  let includedPackages = {};
  function includeModule(packageName, moduleName, requiredFrom, forcePackage) {
    let { package, module } = searchModule(packageName, moduleName, requiredFrom, forcePackage);
    includedPackages[packageName]=true;
    
    
    console.log("Register module : " + packageName + "/" + moduleName);
    let resourceId = prefix + "-" + packageName + "-lib";
    let resourcePath = "resource://" + resourceId + "/" + module.path.join("/") 
                       + (module.path.length>0?"/":"") + module.name + ".js";
    
    if (!options.resources[resourceId]) {
      options.resources[resourceId] = path.join(package.root_dir, "lib");
      options.resourcePackages[resourceId] = package.name;
      let packageResourcePath = "resource://" + resourceId;
      options.rootPaths.push(packageResourcePath);
      
    }
    
    let requires = requireParser.scanFile(module.fullFilePath);
    
    let requirements = {};
    for (let reqname in requires) {
      if (["chrome", "parent-loader", "loader", "manifest"].indexOf(reqname) != 
          -1) {
        requirements[reqname] = {};
      }
      else if (reqname == "self") {
        requirements["self"] = {
          "mapSHA256": "", //TODO: compute it when we use it somewhere
          "mapName": package.name + "-data",
          "dataURIPrefix": prefix + "-" + packageName + "-data/",
        };
        if (!options.packageData[ppackage.name])
          options.packageData[ppackage.name] = packageResourcePath+"/";
      }
      else {
        let resourcePath = includeModule(packageName, reqname, moduleName);
        requirements[reqname] = { uri: resourcePath };
      }
    }
    
    options.manifest[resourcePath] = {
      "docsSHA256": "", //TODO: compute it when we use it somewhere
      "jsSHA256": "", //TODO: compute it when we use it somewhere
      "moduleName": moduleName,
      "packageName": packageName,
      "requirements": requirements,
      "sectionName": "lib",
      "buildInfo": {
        localPath: module.fullFilePath,
        resouceId: resourceId,
        modulePath: module.path
      }
    };
    
    return resourcePath;
  }
  /*
    function registerOneResourcesDir(dir, dirType) {
      let resourceId = prefix + "-" + p.name + "-" + dir;
      let resourcePath = "resource://" + resourceId;
      options.resources[resourceId] = path.join(p.root_dir, dir);
      options.resourcePackages[resourceId] = p.name;
      if (dirType != "data")
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
    
    readCommonJSDirectories(p.extra.libs, "libs");
    if (p.name == mainPackageName)
      readCommonJSDirectories(p.extra.tests, "tests");
      
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
  */
  
  // Force api-utils inclusion, at least for loader/cuddlefish.js
  includeModule("api-utils", "cuddlefish", null, true);
  includeModule("api-utils", "securable-module", null, true);
  
  includeModule(mainPackageName, "main", null, true);
  /*
  if (additionalPackagesToInclude) {
    for(let i=0; i<additionalPackagesToInclude.length; i++)
      includePackage(additionalPackagesToInclude[i]);
  }
  */
  
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
