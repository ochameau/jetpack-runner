const { Cc, Ci, Cu } = require("chrome");
const fs = require("fs");
const path = require("path");
const subprocess = require("subprocess");
const process = require("process");
const addonOptions = require("addon-options");
const timer = require("timer");
const zip = require("zip");
const environ = Cc["@mozilla.org/process/environment;1"]
                .getService(Ci.nsIEnvironment);
const AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;


exports.runRemote = function runRemote(options) {
  
  let profile = require("temp").mkdirSync("jr-profile");
  
  let temporaryXPIFolder = null;
  
  let args = ["-jsconsole", "-no-remote", "-profile", profile];
  
  if (!fs.statSync(options.xpiPath).isDirectory()) {
    // Extract xpi in extensions profile folder
    let xpi = new zip.ZipReader(options.xpiPath);
    temporaryXPIFolder = require("temp").mkdirSync("jr-unzipped-xpi");
    xpi.extractAll(temporaryXPIFolder);
    xpi.close();
    options.xpiPath = temporaryXPIFolder;
  }
  
  if (options.runAsApp) {
    // We want to run it as xulrunner application, not an extension.
    let app = path.join(options.xpiPath, "application.ini");
    args = ["-app",app].concat(args);
     // Override some prefs by using user.js in profile directory
    let userpref = path.join(profile, "prefs.js");
    fs.writeFileSync(userpref, 
      'pref("browser.dom.window.dump.enabled", true);');
  } else {
    let extensionLink = path.join(profile, "extensions", options.xpiID);
    // Create extension folder, in case it doesn't already exists
    try {
      fs.mkdir(path.join(profile, "extensions"));
    } catch(e) {}
    fs.writeFileSync(extensionLink, options.xpiPath);
    
    // Override some prefs by using user.js in profile directory
    let userpref = path.join(profile, "user.js");
    fs.writeFileSync(userpref, 
      'pref("browser.shell.checkDefaultBrowser", false);\n' +
      'pref("extensions.checkCompatibility.4.0b", false);\n' +
      'pref("browser.startup.homepage", "about:blank");\n' +
      'pref("startup.homepage_welcome_url", "about:blank");\n' +
      'pref("devtools.errorconsole.enabled", true);\n' +
      // Remove first install open source software notification
      'pref("browser.rights.3.shown", true);\n' +
      // Disable testpilot
      'pref("extensions.testpilot.runStudies", false);\n' + 
      'pref("browser.dom.window.dump.enabled", true);');
  }
  
  return require("moz-launcher").launch({
    binary: options.binary,
    args: args,
    stdout: options.stdout,
    stderr: options.stderr,
    quit: function () {
      // Wait a litle bit before removing files
      // because process may still block them
      function cleanProfile() {
        require("rm-rec").rm(profile, function(err) {
          if (err) {
            timer.setTimeout(cleanProfile, 1000);
            return;
          }
          require("rm-rec").rm(temporaryXPIFolder);
          if (options.quit)
            options.quit();
        });
      }
      cleanProfile();
    }
  });
  
}

exports.runWithin = function runWithin(options) {
  if (require("self").id == options.jetpackID)
    throw new Error("You can't run within this addon because it has same ID " +
      "than Jetpack runner!");
  console.log(require("self").id + " == " + options.jetpackID);
  
  let workdir = path.join(require("url").toFilename(require("self").data.url("../workdir")));
  let temporaryXPI = path.join(workdir, "zipped-xpi.xpi");
  
  if (fs.statSync(options.xpiPath).isDirectory()) {
    // Create a temporary XPI because AddonManager can't install xpi from a folder
    let xpi = new zip.ZipWriter(temporaryXPI);
    xpi.add("", options.xpiPath);
    xpi.close();
    options.xpiPath = temporaryXPI;
  }
  
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(options.xpiPath);
  
  let install = null;
  
  // Get a install object from our xpi
  AddonManager.getInstallForFile(file, function(aInstall) {
    install = aInstall;
    
    // Watch for install event
    /*
    install.addListener({
      onInstallEnded: function(aInstall, aAddon) {
        console.log("Install ended");
        install.removeListener(this);
      }
    });
    */
    
    // Watch for an event dispatched by the installed addon
    let observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
    let observer = {
      observe: function(subject, topic, data) {
        try {
          if (options.stdout)
            options.stdout(data);
        } catch(e) {
          console.error(e);
        }
      }
    };
    observerService.addObserver(observer, "internal-log-"+options.jetpackID, false);
    observerService.addObserver({
        observe: function(subject, topic, data) {
          try {
            if (options.quit)
              options.quit();
          } catch(e) {
            console.error(e);
          }
          observerService.removeObserver(observer, "internal-log-"+options.jetpackID);
          observerService.removeObserver(this, "internal-quit-"+options.jetpackID);
        }
      }, "internal-quit-"+options.jetpackID, false);
    
    // Launch addon installation!
    install.install();
  });
  
  
  return {
    kill: function kill() {
      if (!install)
        return;
      if (!install.addon || !install.addon.id)
        return require("timer").setTimeout(this.kill, 100);
      AddonManager.getAddonByID(install.addon.id, function (addon) {
        console.log("Uninstall : "+install.addon.id+" -- "+addon.id);
        if (addon)
          addon.uninstall();
        install = null;
      });
    }
  };
}
