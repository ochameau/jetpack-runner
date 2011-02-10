const { Ci, Cc, Cu } = require("chrome");

Cc["@mozilla.org/observer-service;1"]
          .getService(Ci.nsIObserverService)
          .notifyObservers(null, "package-test", "ok");

console.log("package-test:main.js OK");

// native dump() doesn't work :x
// so we use one from the top window
let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
  getService(Ci.nsIWindowMediator);
let win = wm.getMostRecentWindow(null).QueryInterface(Ci.nsIDOMJSWindow);
win.dump("package-test:main.js OK\n");
