const pi = require("packages-inspector");
const URL = require("url");
const self = require("self");
const AddonOptions = require("addon-options");
const path = require("path");
const fs = require("fs");
const XpiBuilder = require("xpi-builder");
const AddpnRunner = require("addon-runner");

function getPackages(file) {
  let url = self.data.url("tests/toolchain/"+file);
  let path = URL.toFilename(url);
  return pi.getPackages(path);
}

function includeApiUtils(packages) {
  let pathToApiUtils = path.join(URL.toFilename(self.data.url("")),"..","..","api-utils");
  return pi.getPackages(pathToApiUtils, packages);
}

function getXpiPath() {
  let p = require("temp").path("test-toolchain.xpi");
  if (path.existsSync(p))
    fs.unlinkSync(p);
  return p;
}

function runWithinAndCheck(test, xpiPath, jetpackID) {
  test.waitUntilDone(30000);
  let success = false;
  
  let p = AddpnRunner.runWithin({
    binary: require("moz-bin-search").getBestBinary(),
    xpiPath: xpiPath,
    jetpackID: jetpackID,
    
    stdout: function(data) {
      if (data.indexOf("info: Test OK") !== -1) {
        test.pass("Got dump from extension in stdout");
        success = true;
        p.kill();
      } else
        console.log("Got data : >>"+data+"<<");
    },
    quit: function (data) {
      console.log(">>>>>>>>>>>>>>>>>>>> QUIT WITHIN");
      if (path.existsSync(xpiPath))
        fs.unlinkSync(xpiPath);
      if (!success)
        test.fail("Didn't get validation output from stdout");
      test.done();
    }
  });
  
  require("unload").when(function () {
    p.kill();
  });
}

exports.testManifestLibFirstPriority = function (test) {
  var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
  prefManager.setBoolPref("extensions.getAddons.cache.enabled", false);
  
  
  let name = "lib-first-priority";
  let packages = getPackages("folder-priorities/" + name);
  test.assertEqual(packages[name].lib.length, 1, "We got only one module folder registered");
  test.assertEqual(packages[name].lib[0], "manifest-lib", "`lib` attribute in package.json is the first priority for specifying modules folder");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  test.assert(name in options.metadata, "options.metadata is correct");
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testManifestDirectoriesSecondPriority = function (test) {
  let name = "directories-second-priority";
  let packages = getPackages("folder-priorities/" + name);
  test.assertEqual(packages[name].lib[0], "directories-lib", "When no `lib` attribute is specified, `directories.lib` attribute become the next priority for specifying modules folder");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testRootLastPriority = function (test) {
  let name = "root-last-priority";
  let packages = getPackages("folder-priorities/" + name);
  test.assertEqual(packages[name].lib[0], ".", "When no `lib`, nor `directories.lib` attributes are specified, root folder is used as modules folder");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testManifestWithoutMain = function (test) {
  let name = "main-default";
  let packages = getPackages("main/" + name);
  test.assertEqual(packages[name].main, "main", "When `main` attributes is ommitted and main.js exists, this module is used as the main entry point.");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testManifestWithMain = function (test) {
  let name = "main-specified";
  let packages = getPackages("main/" + name);
  test.assertEqual(packages[name].main, "specified", "When `main` attributes is set, the specified module is used as the main entry point.");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testDataFolder = function (test) {
  let name = "main-package-data";
  let packages = getPackages("data-folder/" + name);
  test.assertEqual(packages[name].data.length, 1, "We got only one data folder registered");
  test.assertEqual(packages[name].data[0], "data", "When nothing is specified in package.json about data folder, folder `data` is taken as default.");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testDataFolderInDependency = function (test) {
  let name = "main-package";
  let dependency = "dependency";
  let packages = getPackages("data-folder/dependency-data");
  test.assertEqual(packages[name].data.length, 0, "We don't have data folder in main package");
  test.assertEqual(packages[dependency].data.length, 1, "We have one data folder in the dependency package");
  test.assertEqual(packages[dependency].data[0], "data", "When nothing is specified in package.json about data folder, folder `data` is taken as default.");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testPackageModuleRequire = function (test) {
  let name = "main";
  let packages = getPackages("require/package-module");
  test.assertEqual(Object.keys(packages).sort().join(", "), 
    ["dependency", name].join(", "), 
    "We have our two packages");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testPackageMainRequire = function (test) {
  let name = "main";
  let packages = getPackages("require/package-main");
  test.assertEqual(Object.keys(packages).sort().join(", "), 
    ["dependency", name].join(", "), 
    "We have our two packages");
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testRelativeRequire = function (test) {
  let name = "relative";
  let packages = getPackages("require/" + name);
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testMagicRelativeRequire = function (test) {
  let name = "magic-relative";
  let packages = getPackages("require/" + name);
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testJIDWithoutPackageId = function (test) {
  let name = "no-package-id";
  let packages = getPackages("jid/" + name);
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

exports.testJIDWithPackageId = function (test) {
  let name = "with-package-id";
  let packages = getPackages("jid/" + name);
  
  packages = includeApiUtils(packages);
  
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : name,
    });
  
  let xpiPath = getXpiPath();
  
  let newOptions = XpiBuilder.build(options, name, xpiPath);
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}
