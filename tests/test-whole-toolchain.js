const pi = require("packages-inspector");
const URL = require("url");
const self = require("self");
const AddonOptions = require("addon-options");
const path = require("path");
const fs = require("fs");
const XpiBuilder = require("xpi-builder");
const AddonRunner = require("addon-runner");
const { Ci, Cc } = require("chrome");

const APIUTILS_EXPECTED_FILES = [
  "api-utils.js",
  "byte-streams.js",
  "cuddlefish.js",
  "file.js",
  "memory.js",
  "plain-text-console.js",
  "securable-module.js",
  "self-maker.js",
  "shims.js",
  "text-streams.js",
  "traceback.js",
  "unload.js",
  "url.js"
];

// Disable cache in order to speedup this test
const prefManager = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefBranch);
prefManager.setBoolPref("extensions.getAddons.cache.enabled", false);


function getPackages(file) {
  let url = self.data.url("tests/toolchain/"+file);
  let path = URL.toFilename(url);
  let packages = {};
  let errors = pi.getPackages(path, packages);
  if (errors.length > 0)
    throw new Error("Got errors while registering packages from " + path + "\n" 
                    + errors.join("\n"));
  return packages;
}

function includeApiUtils(packages) {
  let pathToApiUtils = path.join(URL.toFilename(self.data.url("")),"..","..","api-utils");
  pi.getPackages(pathToApiUtils, packages);
}

function getXpiPath() {
  let p = require("temp").path("test-toolchain.xpi");
  if (path.existsSync(p))
    fs.unlinkSync(p);
  return p;
}

function runWithinAndCheck(test, xpiPath, jetpackID) {
  let success = false;
  
  let p = AddonRunner.runWithin({
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

function runTest(test, input) {
  test.waitUntilDone(30000);
  
  // Read packages folders and package.json files
  let packages = getPackages(input.packagesPath);
  
  // Checkpoint: verify packages-inspector results
  if (typeof input.checkPackages == "function")
    input.checkPackages(packages);
  
  // Load api-utils package
  includeApiUtils(packages);
  
  // Build manifest
  let options = AddonOptions.buildForRun({
      packages: packages,
      mainPackageName : input.mainPackageName,
    });
  
  // Checkpoint: verify addon-options result
  if (typeof input.checkManifest == "function")
    input.checkManifest(options);
  
  // Build XPI file
  let xpiPath = getXpiPath();
  let newOptions = XpiBuilder.build(options, input.mainPackageName, xpiPath);
  
  // Checkpoint: verify xpi-builder result
  if (typeof input.checkXPI == "function") {
    let zip = new (require("zip").ZipReader)(xpiPath);
    // function either do its custom tests using ZipReader instance
    // or return a hash of packages files that have to be shipped in the xpi:
    let expected = input.checkXPI(zip);
    if (expected) {
      // We need to ensure minimal api-utils modules set is in the expected list
      if (expected["api-utils"]) {
        for each (let module in APIUTILS_EXPECTED_FILES) {
          if (expected["api-utils"].lib.indexOf(module) === -1)
            expected["api-utils"].lib.push(module);
        }
      }
      else {
        expected["api-utils"] = {lib: APIUTILS_EXPECTED_FILES};
      }
      assertShip(test, zip, newOptions.jetpackID, expected, "XPI contains expected files");
    }
    zip.close();
  }
  
  // Run it in same Firefox instance
  // and ensure that we get "Test OK" from STDOUT
  runWithinAndCheck(test, xpiPath, newOptions.jetpackID);
}

function assertRequire(test, options, packageName, section, module, requires, message) {
  let url = options.uriPrefix + packageName + "-" + section + "/" + module;
  let manifest = options.manifest[url];
  test.assertEqual(Object.keys(manifest.requirements).sort().join(", "),
                   requires.sort().join(", "),
                   message);
}

function assertShip(test, zr, id, expected, message) {
  let prefix = id.replace(/@/, "-at-");
  let expectedList = [];
  for (let packageName in expected) {
    let s = expected[packageName];
    for (let section in s) {
      for each (let module in s[section])
        expectedList.push(prefix + "-" + packageName + "-" + section + "/" +module);
    }
  }
  let list = zr.ls("resources/*");
  for (let i = list.length - 1; i >= 0; i--) {
    let f = list[i];
    if (f[f.length - 1] == '/') {
      // Remove directory entries
      list.splice(i, 1);
    }
    else {
      list[i] = f.replace(/resources\//, "");
      if (expectedList.indexOf(list[i]) === -1)
        test.fail("Unepected file in XPI file: `"+list[i]+"`");
    }
  }
  test.assertEqual(list.sort().join(", "), expectedList.sort().join(", "), message);
}


exports.testManifestLibFirstPriority = function (test) {
  let name = "lib-first-priority";
  runTest(test, {
    packagesPath: "folders/folder-priorities/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].lib.length, 1, "We got only one module folder registered");
      test.assertEqual(packages[name].lib[0], "manifest-lib", "`lib` attribute in package.json is the first priority for specifying modules folder");
    },
    checkManifest: function (options) {
      test.assert(name in options.metadata, "options.metadata is correct");
    }
  });
}

exports.testManifestDirectoriesSecondPriority = function (test) {
  let name = "directories-second-priority";
  runTest(test, {
    packagesPath: "folders/folder-priorities/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].lib[0], "directories-lib", "When no `lib` attribute is specified, `directories.lib` attribute become the next priority for specifying modules folder");
    },
    checkManifest: function (options) {
      
    }
  });
}

exports.testRootLastPriority = function (test) {
  let name = "root-last-priority";
  runTest(test, {
    packagesPath: "folders/folder-priorities/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].lib[0], ".", "When no `lib`, nor `directories.lib` attributes are specified, root folder is used as modules folder");
    },
    checkManifest: function (options) {
      
    }
  });
}

exports.testRelativeFolder = function (test) {
  let name = "relative-lib";
  runTest(test, {
    packagesPath: "folders/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].lib[0], "./relative-lib", "We can pass a relative path for the lib folder");
    },
    checkManifest: function (options) {
      
    }
  });
}

exports.testManifestWithoutMain = function (test) {
  let name = "main-default";
  runTest(test, {
    packagesPath: "main/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].main, "./main", "When `main` attributes is ommitted and main.js exists, this module is used as the main entry point.");
    },
    checkManifest: function (options) {
      test.assertEqual(options.main, name + "/main",
        "Manifest `main` is correct, i.e. absolute path to main module.");
    }
  });
}

exports.testManifestWithMain = function (test) {
  let name = "main-specified";
  runTest(test, {
    packagesPath: "main/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].main, "./specified", "When `main` attributes is set, the specified module is used as the main entry point. And the attribute is normalized");
    },
    checkManifest: function (options) {
      test.assertEqual(options.main, name + "/specified",
        "Manifest `main` is correct, i.e. absolute path to main module.");
    }
  });
}

exports.testManifestWithMainSameAsPackage = function (test) {
  // main module has same name than package
  let name = "main-with-package-name";
  runTest(test, {
    packagesPath: "main/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].main, "./main-with-package-name", "When `main` attributes is set, the specified module is used as the main entry point. And the attribute is normalized");
    },
    checkManifest: function (options) {
      test.assertEqual(options.main, name + "/" + name,
        "Manifest `main` is correct, i.e. absolute path to main module.");
    }
  });
}

exports.testManifestWithMainInLibDir = function (test) {
  // We give relative path from package folder, to a main module that lives
  // in a lib folder
  let name = "main-in-lib";
  runTest(test, {
    packagesPath: "main/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].main, "lib/main-in-lib", "When `main` attributes is set, the specified module is used as the main entry point. And the attribute is normalized");
    },
    checkManifest: function (options) {
      test.assertEqual(options.main, name + "/main-in-lib",
        "Manifest `main` is correct, i.e. absolute path to main module.");
    }
  });
}

exports.testManifestWithMainRelativeToLibDir = function (test) {
  // We give relative path from the lib folder to the main module
  let name = "main-relative-to-lib";
  runTest(test, {
    packagesPath: "main/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].main, "lib/main-in-lib", "When `main` attributes is set, the specified module is used as the main entry point. And the attribute is normalized");
    },
    checkManifest: function (options) {
      test.assertEqual(options.main, name + "/main-in-lib",
        "Manifest `main` is correct, i.e. absolute path to main module.");
    }
  });
}

exports.testDataFolder = function (test) {
  let name = "main-package-data";
  runTest(test, {
    packagesPath: "data-folder/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].data.length, 1, "We got only one data folder registered");
      test.assertEqual(packages[name].data[0], "data", "When nothing is specified in package.json about data folder, folder `data` is taken as default.");
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["self"],
                    "`main` requires `self`");
    },
    checkXPI: function (zr) {
      return {
        "main-package-data": {
          data: [
            "data.txt"
          ],
          lib: [
            "main.js"
          ]
        }
      };
      return expected;
    }
  });
}

exports.testDataFolderInDependency = function (test) {
  let name = "main-package";
  let dependency = "dependency";
  runTest(test, {
    packagesPath: "data-folder/dependency-data",
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].data.length, 0, "We don't have data folder in main package");
      test.assertEqual(packages[dependency].data.length, 1, "We have one data folder in the dependency package");
      test.assertEqual(packages[dependency].data[0], "data", "When nothing is specified in package.json about data folder, folder `data` is taken as default.");
    },
    checkManifest: function (options) {
      assertRequire(test, options, dependency, "lib", "main.js", ["self"],
                    "`main` requires `self`");
    }
  });
}

exports.testPackageModuleRequire = function (test) {
  let name = "main";
  runTest(test, {
    packagesPath: "require/package-module",
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(Object.keys(packages).sort().join(", "), 
                       ["dependency", name].join(", "), 
                       "We have our two packages");
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["dependency/module"],
                    "`main` requires another module's package");
    }
  });
}

exports.testPackageMainRequire = function (test) {
  let name = "main";
  runTest(test, {
    packagesPath: "require/package-main",
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(Object.keys(packages).sort().join(", "), 
                       ["dependency", name].join(", "), 
                       "We have our two packages");
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["dependency"],
                    "`main` requires another module's main");
    }
  });
}

exports.testPackageMainRequireWithSameName = function (test) {
  let name = "main";
  runTest(test, {
    packagesPath: "require/package-main-with-same-name",
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(Object.keys(packages).sort().join(", "), 
                       ["dependency", name].join(", "), 
                       "We have our two packages");
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["dependency"],
                    "`main` requires another module's main");
    }
  });
}

exports.testRelativeRequire = function (test) {
  let name = "relative";
  runTest(test, {
    packagesPath: "require/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["./same-directory"],
                    "`main` requires a module in same directory");
      assertRequire(test, options, name, "lib", "same-directory.js", ["./sub-folder/module"],
                    "`same-directory` requires a module in a sub-folder");
    }
  });
}

exports.testMagicRelativeRequire = function (test) {
  let name = "magic-relative";
  runTest(test, {
    packagesPath: "require/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      
    },
    checkManifest: function (options) {
      assertRequire(test, options, name, "lib", "main.js", ["same-directory"],
                    "`main` requires a module in same directory");
      assertRequire(test, options, name, "lib", "same-directory.js", ["sub-folder/module"],
                    "`same-directory` requires a module in a sub-folder");
    }
  });
}

exports.testJIDWithoutPackageId = function (test) {
  let name = "no-package-id";
  runTest(test, {
    packagesPath: "jid/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      
    },
    checkManifest: function (options) {
      let jid = options.jetpackID;
      test.assert(jid.match(/jid0-\d+@jetpack/), "Jetpack ID is a generated one");
    }
  });
}

exports.testJIDWithPackageId = function (test) {
  let name = "with-package-id";
  runTest(test, {
    packagesPath: "jid/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      test.assertEqual(packages[name].id, "package-id", "We have a package id.");
    },
    checkManifest: function (options) {
      let jid = options.jetpackID;
      test.assertEqual(jid, "package-id@jetpack", "Jetpack ID is built on top of package id");
    }
  });
}

exports.testDoNotShipWhenModuleIsUnused = function (test) {
  let name = "do-not-ship-unused";
  let id = "dns";
  runTest(test, {
    packagesPath: "require/" + name,
    mainPackageName: name,
    
    checkPackages: function (packages) {
      
    },
    checkManifest: function (options) {
      
    },
    checkXPI: function (zr) {
      return {
        "do-not-ship-unused": {
          lib: [
            "main.js"
          ]
        }
      };
    }
  });
}
