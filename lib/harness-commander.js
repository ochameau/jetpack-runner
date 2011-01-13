const {components,Cc,Ci} = require("chrome");
const fs = require("fs");
const path = require("path");
const subprocess = require("subprocess");
const process = require("process");

function buildHarnessOptions(packagesPath, selectedPackageName, includeTestHarness) {
  
  let jid = "jid0-k60wfE2Xuwso9RsQpqdbOXw8ZWI";
  let options = {
    jetpackID: jid,
    verbose: true,
    logFile: path.join(require("url").toFilename(require("self").data.url()),"..","workdir","harness_log"),
    bootstrap: {
      classID: "{6724fc1b-3ec4-40e2-8583-8061088b3185}",
      contractID: "@mozilla.org/harness-service;1?id="+jid
    },
    
    metadata: {/*
      "addon-kit": {
        name: "addon-kit",
        license: "MPL 1.1/GPL 2.0/LGPL 2.1",
        "author": "Atul Varma (http://toolness.com/) <atul@mozilla.com>",
        "contributors": [
          "Myk Melez (http://melez.com/) ",
          "Daniel Aquino "
        ],
        "keywords": [
          "javascript",
          "engine",
          "platform",
          "xulrunner"
        ],
        "description": "Add-on development made easy."
      },*/
      /*
      api-utils
      test-harness
      jetinspector
      */
    },
    loader: "resource://"+selectedPackageName+"-api-utils-lib/cuddlefish.js",
    resourcePackages: {},
    packageData: {},
    resultFile: path.join(require("url").toFilename(require("self").data.url()),"..","workdir","harness_result"),
    rootPaths: [],
    enable_e10s: false,
    profileMemory: 0,
    manifest: {},
    bundleID: "6724fc1b-3ec4-40e2-8583-8061088b3185",
    resources: {},
    staticArgs: {}
  };
  
  function declareOneModule(pack,dir,module) {
    var name = module.name.replace(/\.js$/,"");
    var resourcePath = "resource://"+selectedPackageName+"-"+pack+"-"+dir+"/"+module.path.join("/")+(module.path.length>0?"/":"")+module.name;
    console.log(pack+" - "+dir+" - "+module.name);
    
    options.manifest[resourcePath] = {
      "e10s-adapter": null,
      "hash": "cb48bee8c6d7c545b73f0b05115e70f41417352131fc49634fe18051bba47b99",
      "name": name,
      "sectionName": dir,
      "chrome": true,
      "packageName": pack,
      "zipname": resourcePath.replace(/:\//,""),
      "requires": {/*
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
  
  let packages = require("packages-inspector").getPackages(packagesPath);
  let includedPackages = {};
  function includePackage(name) {
    let p = packages[name];
    if (!p)
      throw new Error("Unable to found package with name : "+name);
    if (includedPackages[p.name]) return;
    includedPackages[p.name]=true;
    
    if (p.dependencies) {
      for(let j=0; j<p.dependencies.length; j++) {
        includePackage(p.dependencies[j]);
      }
    }
    
    console.log("Register package : "+p.name);
    var extra = require("packages-inspector").getExtraInfo(p);
    
    function registerOneResourcesDir(dir, dirType) {
      var resourceId = selectedPackageName+"-"+p.name+"-"+dir;
      var resourcePath = "resource://"+resourceId;
      options.resources[resourceId] = path.join(packagesPath,p.name,dir);
      options.resourcePackages[resourceId] = p.name;
      options.rootPaths.push(resourcePath);
      if (dirType=="data")
        options.packageData[p.name] = resourcePath+"/";
    }
    
    function readCommonJSDirectories(modulesByDir, dirType) {
      for(var dir in modulesByDir) {
        for each(var module in modulesByDir[dir]) {
          declareOneModule(p.name,dir,module);
        }
        registerOneResourcesDir(dir,dirType);
      }
    }
    
    readCommonJSDirectories(extra.libs,"libs");
    if (p.name == selectedPackageName)
      readCommonJSDirectories(extra.tests,"tests");
    
    for(let i=0; i<p.data.length; i++) {
      let dir = p.data[i];
      registerOneResourcesDir(dir,"data");
    }
  }
  
  // Force api-utils inclusion, at least for loader/cuddlefish.js
  includePackage("api-utils");
  
  includePackage(selectedPackageName);
  
  if (includeTestHarness)
    includePackage("test-harness");
  
  return options;
}

function setHarnessOptions(options) {
  var environ = Cc["@mozilla.org/process/environment;1"]
                .getService(Ci.nsIEnvironment);
  //console.log(JSON.stringify(options));
  
  environ.set("HARNESS_OPTIONS","");
  
  let filePath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com/harness-options.json"));
  fs.writeFileSync(filePath, JSON.stringify(options));
}

function runMozilla(binaryPath, runAsApp) {
  let command = binaryPath;
  
  let profile = path.join(require("url").toFilename(require("self").data.url()),"..","workdir","profile");
  let args = ["-jsconsole","-profile",profile];
  
  if (runAsApp) {
    // We want to run it as xulrunner application, not an extension.
    let app = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com/application.ini"));
    args = ["-app",app].concat(args);
  } else {
    let extensionLink = path.join(profile,"extensions","addon-runner@mozilla.com");
    let extensionPath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com"));
    // Create extension folder, in case it doesn't already exists
    try {
      fs.mkdir(path.join(profile,"extensions"));
    } catch(e) {}
    fs.writeFileSync(extensionLink, extensionPath);
    
    // Override some prefs by using user.js in profile directory
    let userpref = path.join(profile, "user.js");
    fs.writeFileSync(userpref, 'pref("browser.shell.checkDefaultBrowser", false);');
  }
  
  // Specific windows case
  // We have to launch mozilla binary via cmd.exe
  if (process.env.ComSpec) {
    command = process.env.ComSpec; // Retrieve cmd.exe path
    args = ['/C',binaryPath].concat(args);
  }
  
  var p = subprocess.call({
    command:     command,
    arguments:   args,
    environment: [],
    //workdir: 'c:\\',
    stdin: subprocess.WritablePipe(function() {
      
    }),
    stdout: subprocess.ReadablePipe(function(data) {
      console.log("got data on stdout:" +data+"\n");
    }),
    stderr: subprocess.ReadablePipe(function(data) {
      console.log("got data on stderr:" +data+"\n");
    }),
    onFinished: subprocess.Terminate(function() {
      console.log("process terminated with " +this.exitCode + "\n");
    }),
    mergeStderr: true
  });
}

exports.launchTest = function (binaryPath, packagesPath, runAsApp, package, dirName, testName) {
  let options = buildHarnessOptions(packagesPath, package.name, true);
  
  if (testName)
    options.filter = testName;
  options.iterations = 1;
  options.main  = "run-tests";
  
  setHarnessOptions(options);
  runMozilla(binaryPath, runAsApp);
}

exports.launchMain = function (binaryPath, packagesPath, runAsApp, package) {
  let options = buildHarnessOptions(packagesPath, package.name, false);
  
  options.main  = "main";
  options.verbose = true;

  setHarnessOptions(options);
  runMozilla(binaryPath, runAsApp);
}

