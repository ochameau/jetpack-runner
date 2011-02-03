const { Ci, Cc, Cu } = require("chrome");

Cc["@mozilla.org/observer-service;1"]
          .getService(Ci.nsIObserverService)
          .notifyObservers(null, "package-test", "ok");

console.log("package-test:main.js OK!");
