const harness = require("harness-commander");
const self = require("self");
const path = require("path");
const fs = require("fs");
const { Cc, Ci, Cu } = require("chrome");
const process = require("process");
const subprocess = require("subprocess");
const zip = require("zip");

const AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;

function getDataFilePath(file) {
  return require("url").toFilename(self.data.url("tests/"+file));
}
const xpiPath = getDataFilePath("test-harness/test.xpi");

let options = null;

require("unload").when(function () {
  fs.unlinkSync(xpiPath);  
});

exports.testXPI = function (test) {
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url()),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  let package = require("packages-inspector").getPackage(packagePath);
  
  
  options = harness.buildXPI({"api-utils":apiutils,"package-test":package}, package, xpiPath);
  
  //test.assertEqual(fs.statSync(xpiPath).size, 138821, "xpi file size is the expected one");
  test.pass("XPI built");
}


exports.testLocalLaunch = function (test) {
  // Remove HARNESS_OPTIONS or it will be used by harness.js:503->getDefaults()
  let environ = Cc["@mozilla.org/process/environment;1"]
                  .getService(Ci.nsIEnvironment);
  environ.set("HARNESS_OPTIONS","");
  
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(xpiPath);
  
  // Get a install object from our xpi
  AddonManager.getInstallForFile(file, function(install) {
    // Check meta data
    test.assertEqual(install.state, AddonManager.STATE_DOWNLOADED);
    test.assertEqual(install.type, "extension");
    test.assertEqual(install.version, "0.1");
    test.assertEqual(install.name, "package-test");
    
    // Watch for install event
    AddonManager.addInstallListener({
      onInstallEnded: function(aAddon, aStatus) {
        test.assertEqual(aAddon, install, "install objects are equals");
        gotInstalledEvent = true;
      }
    });
    
    // Watch for an event dispatched by our jetpack example
    // which prove that the addon works!
    let observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
    let observer = {
      observe: function(subject, topic, data) {
        test.assertEqual(data, "ok");
        observerService.removeObserver(observer, "package-test");
        
        test.done();
      }
    };
    observerService.addObserver(observer, "package-test", false);
    
    // Launch addon installation!
    install.install();
  });
  
  test.waitUntilDone();
}


exports.testRemoteLinkLaunch = function (test) {
  test.waitUntilDone(10000);
  
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url()),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  let package = require("packages-inspector").getPackage(packagePath);
  
  var p = harness.launchMain({
    packages: {"api-utils":apiutils,"package-test":package}, 
    package: package,
    binary: require("moz-bin-search").getCurrentProcessBinary(),
    stdout: function(data) {
      if (data.indexOf("package-test:main.js OK")==0) {
        test.pass("Got dump from extension in stdout");
        p.kill();
      }
    },
    quit: function (data) {
      test.done();
    }
  });
  require("unload").when(function () {
    p.kill();
  });
}

exports.testRemoteXPILaunch = function (test) {
  test.waitUntilDone(10000);
  
  // Remove HARNESS_OPTIONS or it will be used by harness.js:503->getDefaults()
  let environ = Cc["@mozilla.org/process/environment;1"]
                  .getService(Ci.nsIEnvironment);
  environ.set("HARNESS_OPTIONS", "");
  
  let profile = path.join(require("url").toFilename(self.data.url()),
    "..", "workdir", "profile");
  
  let extensionFolder = path.join(profile, "extensions", options.bundleID);
  // Create extension folder, in case it doesn't already exists
  try {
    fs.mkdir(path.join(profile, "extensions"));
  } catch(e) {}
    
  // Extract xpi in extensions profile folder
  let xpi = new zip.ZipReader(xpiPath);
  xpi.extractAll(extensionFolder);
  xpi.close();
  
  // Override some prefs by using user.js in profile directory
  let userpref = path.join(profile, "user.js");
  fs.writeFileSync(userpref, 'user_pref("browser.shell.checkDefaultBrowser", false);\n' +
    'user_pref("browser.dom.window.dump.enabled", true);');
  
  let p = require("moz-launcher").launch({
    binary: require("moz-bin-search").getCurrentProcessBinary(),
    args: ["-profile", profile],
    stdout: function (data) {
      if (data.indexOf("package-test:main.js OK")==0) {
        test.pass("Got dump from extension in stdout");
        p.kill();
      }
    },
    stderr: function (data) {
      
    },
    quit: function () {
      test.pass("Extension seems to be working and firefox has been killed");
      // Wait a litle bit before removing files
      // because process may still block them
      require("timer").setTimeout(function () {
        require("rm-rec").rm(profile, function(err) {
          test.pass("Profile cleaned");
          test.done();
        });
      }, 1000);
    }
  });
}


exports.testRemoteLaunchAsApplication = function (test) {
  const applicationZipPath = getDataFilePath("test-harness/application.zip");
  
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url()),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  let package = require("packages-inspector").getPackage(packagePath);
  
  options = harness.buildStandaloneApplication({"api-utils":apiutils,"package-test":package}, package, applicationZipPath);
  
  require("unload").when(function () {
    fs.unlinkSync(applicationZipPath);
  });
  test.pass("Application built");
  
  test.waitUntilDone(10000);
  
  // Remove HARNESS_OPTIONS or it will be used by harness.js:503->getDefaults()
  let environ = Cc["@mozilla.org/process/environment;1"]
                  .getService(Ci.nsIEnvironment);
  environ.set("HARNESS_OPTIONS", "");
  
  let workdir = path.join(require("url").toFilename(self.data.url()),
    "..", "workdir");
  let profile = path.join(workdir, "profile");
  let applicationPath = path.join(workdir, "application");
  let applicationIniPath = path.join(applicationPath, "application.ini");
  
  // Extract xpi in extensions profile folder
  let xpi = new zip.ZipReader(applicationZipPath);
  xpi.extractAll(applicationPath);
  xpi.close();
  
  // Override some prefs by using user.js in profile directory
  try {
    fs.mkdir(profile);
  } catch(e) {}
  let userpref = path.join(profile, "user.js");
  fs.writeFileSync(userpref, 'user_pref("browser.dom.window.dump.enabled", true);');
  
  console.log(applicationIniPath);
  
  let p = require("moz-launcher").launch({
    binary: require("moz-bin-search").getCurrentProcessBinary(),
    args: ["-app", applicationIniPath, "-profile", profile, ],
    stdout: function (data) {
      if (data.indexOf("package-test:main.js OK")==0) {
        test.pass("Got dump from extension in stdout");
        p.kill();
      }
    },
    stderr: function (data) {
      
    },
    quit: function () {
      test.pass("Extension seems to be working and firefox has been killed");
      // Wait a litle bit before removing files
      // because process may still block them
      require("timer").setTimeout(function () {
        require("rm-rec").rm(profile, function(err) {
          test.pass("Profile cleaned");
          require("rm-rec").rm(applicationPath, function(err) {
            test.pass("Application cleaned");
            test.done();
          });
        });
      }, 1000);
    }
  });
}
