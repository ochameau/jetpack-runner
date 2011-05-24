const { Cc, Ci, Cu } = require("chrome");

const runner = require("addon-runner");

const self = require("self");
const path = require("path");
const fs = require("fs");
const process = require("process");

const subprocess = require("subprocess");

const zip = require("zip");

function getDataFilePath(file) {
  let url = self.data.url("tests/"+file);
  let file = require("url").toFilename(url);
  return file;
}


let options = null;
let mainPackage = null;
let xpiPath = null;

exports.prepateOptions = function (test) {
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url("")),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  mainPackage = require("packages-inspector").getPackage(packagePath);
  let packages = {"api-utils" : apiutils, "package-test" : mainPackage};
  
  options = require("addon-options").buildForRun({
      packages: packages,
      mainPackageName : mainPackage.name,
    });
  
  let workdir = path.join(require("url").toFilename(require("self").data.url("")), "..", "workdir");
  xpiPath = path.join(workdir, "test.xpi");
  if (path.existsSync(xpiPath))
    fs.unlinkSync(xpiPath);
  
  test.pass("Options ready");
}

function runRemoteAndCheck(test, xpiPath, addonID, runAsApp) {
  test.waitUntilDone(100000);
  
  let p = runner.runRemote({
    binary: require("moz-bin-search").getBestBinary(),
    xpiPath: xpiPath,
    xpiID: addonID,
    
    runAsApp: runAsApp,
    
    stdout: function(data) {
      if (data.indexOf("package-test:main.js OK")==0) {
        test.pass("Got dump from extension in stdout");
        p.kill();
      } else
        console.log("Got data : "+data);
    },
    quit: function (data) {
      console.log(">>>>>>>>>>>>>>>>>>>> QUIT REMOTE");
      if (path.existsSync(xpiPath))
        fs.unlinkSync(xpiPath);
      test.done();
    }
  });
  
  require("unload").when(function () {
    p.kill();
  });
  
}

function runWithinAndCheck(test, xpiPath, jetpackID) {
  test.waitUntilDone(100000);
  
  let p = runner.runWithin({
    binary: require("moz-bin-search").getBestBinary(),
    xpiPath: xpiPath,
    jetpackID: jetpackID,
    
    stdout: function(data) {
      if (data.indexOf("package-test:main.js OK")!=1) {
        test.pass("Got dump from extension in stdout");
        p.kill();
      } else
        console.log("Got data : "+data);
    },
    quit: function (data) {
      console.log(">>>>>>>>>>>>>>>>>>>> QUIT WITHIN");
      if (path.existsSync(xpiPath))
        fs.unlinkSync(xpiPath);
      test.done();
    }
  });
  
  require("unload").when(function () {
    p.kill();
  });
  
}

exports.testWithinLightXPI = function (test) {
  
  let newOptions = require("xpi-builder").build(options, mainPackage, xpiPath, true);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
  
}

exports.testWithinXPI = function (test) {
  
  let newOptions = require("xpi-builder").build(options, mainPackage, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
  
}

exports.testRemoteLightXPI = function (test) {
  
  let newOptions = require("xpi-builder").build(options, mainPackage, xpiPath, true);
  runRemoteAndCheck(test, xpiPath, options.bundleID);
  
}

exports.testRemoteXPI = function (test) {
  
  let newOptions = require("xpi-builder").build(options, mainPackage, xpiPath);
  runRemoteAndCheck(test, xpiPath, newOptions.bundleID);
  
}

exports.testRemoteLightApplication = function (test) {
  
  let newOptions = require("application-builder").build(options, mainPackage, xpiPath, true);
  runRemoteAndCheck(test, xpiPath, newOptions.bundleID, true);
  
}

exports.testRemoteApplication = function (test) {
  
  let newOptions = require("application-builder").build(options, mainPackage, xpiPath);
  runRemoteAndCheck(test, xpiPath, newOptions.bundleID, true);
  
}
