let {Cc,Ci,Cu} = require("chrome");

//let args = require("argsparser").parse();

let argv = require("process").argv;
let actionRun = argv.indexOf("run") !== -1;
let actionTest = argv.indexOf("test") !== -1;

if (actionRun || actionTest) {
  try {
  let packagePath = require("process").cwd();
  
  let packageFolderPaths = [packagePath.replace(/\\[^\\]+$/, "")];
  
  let packages = {};
  let inspector = require("packages-inspector");
  for each (let path in packageFolderPaths) {
    let errors = inspector.getPackages(path, packages);
    if (errors)
      dump("Unable to load one package from registered directory '" + path + 
           "': \n" + errors.join('\n') + "\n");
  }
  let p = null;
  try {
    p = inspector.getPackage(packagePath);
  }
  catch(e) {
    dump("Unable to found a valid package in current directory: \n"+e+"\n");
  }
  if (!p) {
    dump("There is no package in current directory");
  } else {
    dump("Registered packages: " + Object.keys(packages).join(', ') + "\n");
    
    let options = null;
    if (actionRun) {
      dump("Running package: " + p.name + "\n");
      options = require("addon-options").buildForRun({
        packages: packages,
        mainPackageName : p.name
      });
    }
    else {
      let idx = argv.indexOf("-f");
      let test = idx !== -1 && argv.length > idx + 1 ? argv[idx + 1] : null;
      if (test)
        dump("Running test `" + test + "` from package: " + p.name + "\n");
      else
        dump("Running all tests for package: " + p.name + "\n");
      options = require("addon-options").buildForTest({
          packages: packages,
          mainPackageName: p.name,
          testName: test
        });
    }
    
    let xpiPath = require("temp").path("jr-cmd-line.xpi");    
    let newOptions = require("xpi-builder").build(options, p.name, xpiPath);
    let process = require("addon-runner").runRemote({
      binary: require("moz-bin-search").getBestBinary(),
      xpiPath: xpiPath,
      xpiID: newOptions.bundleID,
      
      runAsApp: false,
      
      stdout: function(data) {
        dump(">>"+data);
        //p.kill();
      },
      quit: function (data) {
        dump(">>quit");
        //if (path.existsSync(xpiPath))
        //  fs.unlinkSync(xpiPath);
      }
    });
  }
  
  } catch(e) {
    dump(e);
  }
  
  
  
} else {
  // Trick linker in order to link these modules:
  // (Used by jetinspector.js, that lives in data folder and it is not parsed
  //  by the linker)
  require("self");
  require("subprocess/subprocess");
  require("preferences-service");
  require("path");
  require("fs");
  require("process");
  require("addon-runner");
  require("online-sdk");
  
  
  // Need to pass throught a custom protocol in order to have chrome 
  // privileages in the opened window!
  let url = "resource://jetpack-runner-at-jetpack-jetpack-runner-data/gui/";
  let protocol = require("directory-protocol").register("jetpack", url, "system", "jetinspector.html");
  
  let id = require("xul-app").ID;
  if (id == "addon-runner@mozilla.com") {
    // Open a window if we are launched as a xulrunner app
    let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                  getService(Ci.nsIWindowWatcher);
    let window = windowWatcher.openWindow(null,
                    "jetpack:",
                    null, 
                    "chrome,width=500,height=500,resizable=yes,scrollbars=yes", 
                    null);
    
    // Due to a bug recently introduced in FF4 betas,
    // We need to do this hack in order to be able to see that window!
    require("timer").setTimeout(function () {
      window.focus();
    }, 500);
    
  } else {
    // On firefox, we open jetpack runner page on startup
    exports.main = function (options, callbacks) {
      if (options.loadReason == "install")
        require("tabs").open("jetpack:");
    }
  }
  
}
