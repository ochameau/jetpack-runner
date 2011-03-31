
let {Cc,Ci,Cu} = require("chrome");

let args = require("argsparser").parse();

if (args["cfx"]) {
  
  let packagePath = require("process").cwd();
  let package = require("packages-inspector").getPackage(packagePath);
  
  require("harness-commander").launchTest(require("path").join(packagesPath,".."), package, "test", null);
  
} else {
  
  // Need to pass throught a custom protocol in order to have chrome 
  // privileages in the opened window!
  let protocol = require("directory-protocol").register("jetpack", require("self").data.url("/gui/"), "system", "jetinspector.html");
  
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
