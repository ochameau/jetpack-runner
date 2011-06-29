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

exports.buildGeneric = function (input) { //packages, mainPackageName, includes) {
  let packages = input.packages;
  
  // Retrieve additional data from packages, mainly read lib, data and tests folders
  for each (let p in packages)
    p.extra = require("packages-inspector").getExtraInfo(p);
  
  let targetPackage = packages[input.mainPackageName];
  
  // jid and prefix generation is taken from:
  // https://github.com/mozilla/addon-sdk/blob/master/python-lib/cuddlefish/__init__.py#L600
  let jid = targetPackage.id ? targetPackage.id : 
    ("jid0-" + new Date().getTime());
  
  if (jid.indexOf("@") == -1 && jid.indexOf("{") != 0) {
    jid += "@jetpack";
  }
  
  let prefix = jid.toLowerCase();
  prefix = prefix.replace("@", "-at-");
  prefix = prefix.replace(".", "-dot-");
  
  let options = {
    jetpackID: jid,
    
    // bundleID seems useless now as it is equal to jetpackID
    bundleID: jid,
    
    // Give information to load main XPCOM component
    bootstrap: {
      classID: guid(),
      contractID: "@mozilla.org/harness-service;1?id=" + jid
    },
    
    // Used by harness.js and given to securable module:
    uriPrefix: "resource://" + prefix + "-",
    name: input.mainPackageName,
    
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
  
  function searchInSection(p, section, requireArg, debug) {
    let folder = null;
    if (section === "lib")
      folder = p.extra.libs;
    else if (section === "tests")
      folder = p.extra.tests;
    else
      throw new Error("Unknown section: '" + section + "'");
    for (let directoryPath in folder) {
      let directory = folder[directoryPath];
      for each (let module in directory) {
        if (debug)
          console.log(module.path+" / "+requireArg);
        if (module.path == requireArg)
          return {
            package: p,
            directory: directoryPath,
            section: section,
            module: module
          };
      }
    }
  }
  
  // package.json's `main` attribute is special.
  // it doesn't take `lib` or `directories.lib` attributes into account,
  // so `path` is the absolute path of the main module in the package directory.
  function searchMain(p, path) {
    let folder = p.extra.libs;
    for (let directoryPath in folder) {
      let directory = folder[directoryPath];
      for each (let module in directory) {
        // if directoryPath = "." -> indexOf=0, else indexOf=2
        // as `path` is everytime prefixed by "./"
        if (path.indexOf(directoryPath + "/" + module.path) <=2)
          return {
            package: p,
            directory: directoryPath,
            section: "lib",
            module: module
          };
      }
    }
  }
  
  function searchModule(packageName, requireArg, requiredFrom, isTest) {
    
    // Relative path starting with `./` or `../`
    let m;
    if (m = requireArg.match(/^(\.\.?)\//)) {
      let fromPath = requiredFrom.split('/');
      fromPath.pop();
      if (m[1] == ".") {
        requireArg = fromPath.concat([requireArg.substr(2)]).join('/');
      }
      else if (m[1] == "..") {
        fromPath.pop();
        requireArg = fromPath.concat([requireArg.substr(3)]).join('/');
      }
      else {
        throw new Error("Invalid require. Can't load '"+requireArg+"'");
      }
      
    }
    
    // Absolute path, starting with package name, then absolute path to the 
    // module in this package
    if (requireArg.indexOf("/") !== -1) {
      let bits = requireArg.split("/");
      let packageName = bits.splice(0, 1)[0];
      let path = bits.join("/");
      let p = packages[packageName];
      if (p) {
        let module = searchInSection(p, "lib", path);
        if (module)
          return module;
      }
    } 
    // Consider path to be only a pagkage name, search for such package
    // and use its main module
    else {
      let p = packages[requireArg];
      if (p && p.main)
        return searchMain(p, p.main);
    }
    
    // First search in the current package:
    let p = packages[packageName];
    if (!p)
      throw new Error("Unable to found package `" + packageName + "`" + 
                      (requiredFrom?" (required from " + requiredFrom + ")":""));
    
    if (isTest) {
      let module = searchInSection(p, "tests", requireArg) || 
                   searchInSection(p, "lib", requireArg);
      if (module) 
        return module;
    }
    else {
      let module = searchInSection(p, "lib", requireArg);
      if (module)
        return module;
    }
    
    let packageOrder = Object.keys(packages).sort();
    
    // Search in other packages
    for each (let name in packageOrder) {
      let p = packages[name];
      let module = searchInSection(p, "lib", requireArg);
      if (module)
        return module;
    }
    throw new Error("Unable to found module `" + requireArg + "`" +
                    (requiredFrom?" (required from " + requiredFrom + ")":""));
  }
  
  function registerSectionDirectory(package, section, directory) {
    let resourceId = prefix + "-" + package.name + "-" + section;
    let resourceURL = "resource://" + resourceId;
    if (!options.resources[resourceId]) {
      options.resources[resourceId] = path.join(package.root_dir, directory);
      options.resourcePackages[resourceId] = package.name;
      if (section === "lib" || section === "tests")
        options.rootPaths.push(resourceURL);
      else if (section === "data")
        options.packageData[package.name] = resourceURL + "/";
    }
    return resourceURL;
  }
  
  function includeModule(packageName, modulePath, requiredFrom, isTest) {
    let { package, directory, module, section } = 
      searchModule(packageName, modulePath, requiredFrom, isTest);
    
    let sectionResourceURL = registerSectionDirectory(package, section, directory);
    let resourcePath = sectionResourceURL + "/" + module.path + ".js";
    
    if (resourcePath in options.manifest)
      return resourcePath;
    
    //console.log("Register module : " + package.name + "/" + modulePath);
    
    if (!options.metadata[package.name]) {
      // Register metadata for the module's package
      options.metadata[package.name] = {
        name: package.name,
        fullName: package.fullName,
        license: package.license,
        author: package.author,
        version: package.version,
        contributors: package.contributors,
        keywords: package.keywords,
        description: package.description,
        homepage: package.homepage
      };
    }
    
    let requires = requireParser.scanFile(module.fullFilePath);
    //console.log(modulePath+" requires : "+requires.toSource());
    let requirements = {};
    
    // Set manifest before recursing into requirements (avoid infinite loop
    // on cyclic dependencies)
    options.manifest[resourcePath] = {
      "docsSHA256": "", //TODO: compute it when we use it somewhere
      "jsSHA256": "", //TODO: compute it when we use it somewhere
      "moduleName": module.path,
      "packageName": package.name,
      "requirements": requirements,
      "sectionName": section
    };
    
    for (let reqname in requires) {
      if (["chrome", "parent-loader", "loader", "manifest"].indexOf(reqname) != 
          -1) {
        requirements[reqname] = {};
      }
      else if (reqname == "self") {
        let directory = package.data[0];
        let sectionResourceURL = registerSectionDirectory(package, "data", directory);
        requirements["self"] = {
          "mapSHA256": "", //TODO: compute it when we use it somewhere
          "mapName": package.name + "-data",
          "dataURIPrefix": sectionResourceURL + "/",
        };
      }
      else if (!(reqname in requirements)) {
        //console.log(modulePath+" require "+reqname);
        let resourcePath = includeModule(package.name, reqname, module.path, isTest);
        requirements[reqname] = { uri: resourcePath };
      }
    }
    
    return resourcePath;
  }
  
  // Force api-utils inclusion, at least for loader/cuddlefish.js
  includeModule("api-utils", "cuddlefish", null);
  includeModule("api-utils", "securable-module", null);  
  
  if (input.customMain) {
    // When we pass a custom main module, we can include any module we want
    // and path should be a relative path *NOT* starting with "./"
    options.main = input.customMain.packageName + "/" + input.customMain.path;
    includeModule(input.customMain.packageName, options.main, null, null);
  }
  else {
    // We use a regular main module with specific search behavior that
    // doesn't take lib or directories.lib manifest attributes into account
    let module = searchMain(targetPackage, targetPackage.main);
    if (!module)
      throw new Error("Unable to found main module '" + targetPackage.main + "'" +
                      "in '" + targetPackage.name + "' package");
    options.main = module.package.name + "/" + module.module.path;
    includeModule(module.package.name, options.main, null, null);
  }
  
  if (input.includes) {
    for(let i=0; i<input.includes.length; i++) {
      let include = input.includes[i];
      includeModule(include[0], include[1], null, include[2]);
    }
  }
  
  
  return options;
}


exports.buildForTest = function (input) {
  let requires = [];
  
  if (input.testName) {
    // Run only one test:
    requires.push([input.mainPackageName, input.testName, true]);
  }
  else {
    // Run all tests:
    let p = input.packages[input.mainPackageName];
    let folder = require("packages-inspector").getExtraInfo(p).tests;
    for (let directoryPath in folder) {
      let directory = folder[directoryPath];
      for each (let module in directory) {
        if (module.name.match(/test-/))
          requires.push([p.name, module.path, true]);
      }
    }
  }
  
  let options = exports.buildGeneric({
    packages: input.packages, 
    mainPackage: input.mainPackageName,
    customMain: {
      packageName: "test-harness", 
      path: "run-tests"
    },
    requires: requires
  });
  
  if (input.testName)
    options.filter = input.testName;
  
  options.iterations = 1;
  options.verbose = true;
  
  //options.logFile = require("temp").path("harness_log");
  // If there is no resultFile
  // harness.js won't try to kill firefox at end of tests!
  //options.resultFile = require("temp").path("harness_result-" + 
  //  Math.round(Math.random()*100+1));
  
  return options;
}

exports.buildForRun = function (input) {
  let mainPackage = input.packages[input.mainPackageName];
  let mainModule = mainPackage.main;
  if (!mainModule)
    throw new Error("Target package should have a main module");
  
  let options = exports.buildGeneric({
    packages: input.packages, 
    mainPackageName: input.mainPackageName
  });
  
  options.verbose = true;
  
  return options;
}
