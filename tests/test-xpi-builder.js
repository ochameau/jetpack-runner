const { Cc, Ci, Cu } = require("chrome");

const self = require("self");
const path = require("path");
const fs = require("fs");

const AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;

function getDataFilePath(file) {
  return require("url").toFilename(self.data.url("tests/"+file));
}
const xpiPath = getDataFilePath("test-harness/test.xpi");

exports.testBuildXPI = function (test) {
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url()),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  let mainPackage = require("packages-inspector").getPackage(packagePath);  
  let packages = {"api-utils" : apiutils, "package-test" : mainPackage};
  
  let options = require("addon-options").buildForRun({
    packages: packages, 
    mainPackageName: mainPackage.name
  });
  
  let newOptions = require("xpi-builder").build(options, mainPackage, xpiPath);
  
  require("unload").when(function () {
    fs.unlinkSync(xpiPath);  
  });
  //test.assertEqual(fs.statSync(xpiPath).size, 138821, "xpi file size is the expected one");
  test.pass("XPI built");
}

exports.testCurrentProcessInstall = function (test) {
  
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
