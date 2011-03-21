
let {Cc,Ci,Cu} = require("chrome");

let args = require("argsparser").parse();

if (args["cfx"]) {
  let packagePath = require("process").cwd();
  let package = require("packages-inspector").getPackage(packagePath);
  
  require("harness-commander").launchTest(require("path").join(packagesPath,".."), package, "test", null);
} else {
  // This resource url won't have chrome privileages :(
  //let url = require("self").data.url("jetinspector.html"); 
  let url = "jetrunner://gui/jetinspector.html";
  
  // Need to pass throught a custom protocol in order to have chrome 
  // privileages in the opened window!
  let protocol = require("directory-protocol").register("jetpack", require("self").data.url("/gui/"), "system", "jetinspector.html");
  
  let id = require("xul-app").ID;
  if (id == "addon-runner@mozilla.com") {
    // Open a window if we are launched as a xulrunner app
    let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                  getService(Ci.nsIWindowWatcher);
    let window = windowWatcher.openWindow(null,
                    url,
                    null, 
                    "chrome,width=500,height=500,resizable=yes,scrollbars=yes", 
                    null);
  }
  
}
