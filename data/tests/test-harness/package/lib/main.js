const { Ci, Cc, Cu } = require("chrome");

// Send an event for tests when we install addon in test process!
Cc["@mozilla.org/observer-service;1"]
          .getService(Ci.nsIObserverService)
          .notifyObservers(null, "package-test", "ok");

console.log("package-test:main.js OK");

// For akward reason, native dump() doesn't end up in stdout
// So we use dump from a window, and use hidden one so it works on
// window-less application too!
let win = Cc["@mozilla.org/appshell/appShellService;1"]
         .getService(Ci.nsIAppShellService)
         .hiddenDOMWindow;
win.dump("package-test:main.js OK\n");
