const harness = require("harness-commander");
const self = require("self");
const path = require("path");
const fs = require("fs");
const { Cc, Ci, Cu } = require("chrome");

const AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;

function getDataFilePath(file) {
  return require("url").toFilename(self.data.url("tests/"+file));
}
const xpiPath = getDataFilePath("test-harness/test.xpi");

exports.testXPI = function (test) {
  let apiutilsPackagePath = path.join(require("url").toFilename(self.data.url()),"..","..","api-utils");
  let apiutils = require("packages-inspector").getPackage(apiutilsPackagePath);
  
  let packagePath = getDataFilePath("test-harness/package/");
  let package = require("packages-inspector").getPackage(packagePath);
  
  
  harness.buildXPI({"api-utils":apiutils,"package-test":package}, package, xpiPath);
  
  //test.assertEqual(fs.statSync(xpiPath).size, 138821, "xpi file size is the expected one");
  test.pass();
}

exports.testLaunch = function (test) {
  // Remove HARNESS_OPTIONS or it will be used by harness.js:503->getDefaults()
  let environ = Cc["@mozilla.org/process/environment;1"]
                  .getService(Ci.nsIEnvironment);
  environ.set("HARNESS_OPTIONS","");
  
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(xpiPath);
  
  AddonManager.getInstallForFile(file, function(install) {
    test.assertEqual(install.state, AddonManager.STATE_DOWNLOADED);
    test.assertEqual(install.type, "extension");
    test.assertEqual(install.version, "0.1");
    test.assertEqual(install.name, "package-test");
    
    AddonManager.addInstallListener({
      onInstallEnded: function(aAddon, aStatus) {
        test.assertEqual(aAddon, install);
        gotInstalledEvent = true;
      }
    });
    
    let observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
    let observer = {
      observe: function(subject, topic, data) {
        test.assertEqual(data, "ok");
        observerService.removeObserver(observer, "package-test");
        
        fs.unlinkSync(xpiPath);
        test.done();
      }
    };
    observerService.addObserver(observer, "package-test", false);
    
    // Launch addon installation!
    install.install();
  });
  
  test.waitUntilDone();
}
