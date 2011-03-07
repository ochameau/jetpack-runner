const { Cc, Ci, Cu } = require("chrome");
const fs = require("fs");
const path = require("path");
const subprocess = require("subprocess");
const process = require("process");
const addonOptions = require("addon-options");

function setHarnessOptions(options) {
  var environ = Cc["@mozilla.org/process/environment;1"]
                .getService(Ci.nsIEnvironment);
  environ.set("HARNESS_OPTIONS","");
  
  let filePath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com/harness-options.json"));
  fs.writeFileSync(filePath, JSON.stringify(options));
}

function runMozilla(options) {
  
  let profile = path.join(require("url").toFilename(require("self").data.url()),"..","workdir","profile");
  let args = ["-jsconsole","-profile",profile];
  
  if (options.runAsApp) {
    // We want to run it as xulrunner application, not an extension.
    let app = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com/application.ini"));
    args = ["-app",app].concat(args);
  } else {
    let extensionLink = path.join(profile,"extensions","addon-runner@mozilla.com");
    let extensionPath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com"));
    // Create extension folder, in case it doesn't already exists
    try {
      fs.mkdir(path.join(profile,"extensions"));
    } catch(e) {}
    fs.writeFileSync(extensionLink, extensionPath);
    
    // Override some prefs by using user.js in profile directory
    let userpref = path.join(profile, "user.js");
    fs.writeFileSync(userpref, 
      'pref("browser.shell.checkDefaultBrowser", false);\n' +
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
      require("timer").setTimeout(function () {
        require("rm-rec").rm(profile, function(err) {
          if (options.quit)
            options.quit();
        });
      }, 1000);
    }
  });
  
}

exports.launchTest = function (options) {
  let harnessOptions = addonOptions.build(
    options.packages, 
    options.package.name, 
    ["test-harness"]);
  
  if (options.testName)
    harnessOptions.filter = options.testName;
  
  harnessOptions.iterations = 1;
  harnessOptions.main  = "run-tests";
  harnessOptions.verbose = true;
  
  let workdir = path.join(require("url").toFilename(require("self").data.url()),"..","workdir");
  harnessOptions.logFile = path.join(workdir,"harness_log");
  harnessOptions.resultFile = path.join(workdir,"harness_result");
  
  setHarnessOptions(harnessOptions);
  return runMozilla({
    binary: options.binary,
    runAsApp: options.runAsApp,
    stdout: options.stdout,
    stderr: options.stderr,
    quit: options.quit
  });
}

exports.launchMain = function (options) {
  let harnessOptions = addonOptions.build(options.packages, 
    options.package.name);
  
  harnessOptions.main  = "main";
  harnessOptions.verbose = true;

  setHarnessOptions(harnessOptions);
  return runMozilla({
    binary: options.binary,
    runAsApp: options.runAsApp,
    stdout: options.stdout,
    stderr: options.stderr,
    quit: options.quit
  });
}
