try {

var prefs = require("preferences-service");
var path = require("path");
var fs = require("fs");
var process = require("process");
var runner = require("addon-runner");

var currentPackage = null;
var hasMain = false;
var currentProcess = null;


function openPackage(package) {
  currentPackage = package;
  hasMain = false;
  $("#package-description").show();
  $("#package-name").text("Package: "+package.name);
  
  var extra = require("packages-inspector").getExtraInfo(package);
  
  function fillListWithFiles(ul, filesByDir, dirType) {
    ul.html("");
    for(var dir in filesByDir) {
      var subUl = $("<ul></ul>");
      var dirName = $('<span class="package-dir-name"></span>');
      dirName.text(dir+":");
      subUl.append(dirName);
      for each(var file in filesByDir[dir]) {
        var li = $("<li></li>");
        if (file.name == "main.js" && dirType == "libs")
          hasMain = true;
        li.text(file.path.concat([file.name]).join("/"));
        if (dirType=="tests") {
          li.addClass("link");
          (function (dir,file) {
            li.click(function () {
              document.location = "jetpack:" + package.name + ":" + file.name;
            });
          })(dir,file);
        }
        subUl.append(li);
      }
      ul.append(subUl);
    }
    
  }
  fillListWithFiles($("#package-libs-list"), extra.libs, "libs");
  fillListWithFiles($("#package-tests-list"), extra.tests, "tests");
  
}


function launch(package, dirType, testFileName) {
  $("#run-panel").show();
  
  try {
    // Kill previous process if it's still alive
    if (currentProcess)
      Kill();
    
    var title = "";
    if (dirType == "tests") {
      if (testFileName)
        title = "Running test " + package.name + ", " + testFileName + ":";
      else
        title = "Running all tests from " + package.name + ":";
    }
    else {
      title = "Running " + package.name + ":";
    }
    Report.run(title);
    
    // 1/ Built addon's big options object that contain all data needed to
    // bootstrap/launch the addon 
    var addonOptions = null;
    if (dirType=="tests") {
      
      addonOptions = require("addon-options").buildForTest({
        packages: Packages.dict,
        mainPackageName: package.name,
        testName: testFileName?testFileName:null
      });
      
      // If there is no resultFile
      // harness.js won't try to kill firefox at end of tests!
      if (prefs.get("run-within")) {
        addonOptions.noKillAtTestEnd = true;
      }
      
    } else if (dirType=="libs") {
      
      addonOptions = require("addon-options").buildForRun({
        packages: Packages.dict,
        mainPackageName : package.name,
      });
      
    } else {
      throw new Error("Unknown dirType: "+dirType);
    }
    
    addonOptions.noDumpInJsConsole = true;
    
    
    // 2/ Build one XPI by reading this options object
    // either a "xulrunner application zip" or a regular firefox extension XPI
    var tmpdir = require("temp").dir;
    var xpiPath = null;
    
    if (prefs.get("run-as-app")) {
      xpiPath = path.join(tmpdir, addonOptions.jetpackID+".zip");
      if (path.existsSync(xpiPath))
        fs.unlinkSync(xpiPath);
      addonOptions = require("application-builder").build(addonOptions, package, xpiPath, true);
    } else {
      xpiPath = path.join(tmpdir, addonOptions.jetpackID+".xpi");
      if (path.existsSync(xpiPath))
        fs.unlinkSync(xpiPath);
      addonOptions = require("xpi-builder").build(addonOptions, package, xpiPath, true);
    }
    delete addonOptions.resultFile;
    delete addonOptions.logFile;
    
    // 3/ Run the addon either inside the current firefox instance
    // or in a remote one
    if (prefs.get("run-within")) {
      currentProcess = runner.runWithin({
        xpiPath: xpiPath,
        jetpackID: addonOptions.jetpackID,
        
        stdout : function (msg) {
          Report.log(msg);
        },
        stderr : function (msg) {
          Report.log(msg);
        },
        quit: function () {
          if (path.existsSync(xpiPath))
            fs.unlinkSync(xpiPath);
          Killed();
        }
      });
    } 
    else {
      currentProcess = runner.runRemote({
        binary: prefs.get("binary-path"),
        xpiPath: xpiPath,
        xpiID: addonOptions.bundleID,
        
        runAsApp: prefs.get("run-as-app"),
        
        stdout : function (msg) {
          Report.log(msg);
        },
        stderr : function (msg) {
          Report.log(msg);
        },
        quit: function () {
          if (path.existsSync(xpiPath))
            fs.unlinkSync(xpiPath);
          Killed();
        }
      });
    }
    
    
  } catch(e) {
    Report.error("Internal error: " + e + "\n" + e.stack);
    if (currentProcess)
      Kill();
    else
      Killed();
  }
}

function Run() {
  if (!hasMain)
    return alert("You need a 'main.js' file in order to run an extension");
  document.location.href = "jetpack:" + currentPackage.name + ":run";
}

function Test() {
  document.location.href = "jetpack:" + currentPackage.name + ":test";
}

function Kill() {
  if (!currentProcess) return;
  currentProcess.kill();
  Report.kill();
}
function Killed() {
  Report.killed();
  currentProcess = null;
}

const nsIFilePicker = Components.interfaces.nsIFilePicker;
function selectFile(title, filename, ext) {
  var fp = Components.classes["@mozilla.org/filepicker;1"]
               .createInstance(nsIFilePicker);
  fp.init(window, title, nsIFilePicker.modeSave);
  fp.appendFilter(title, "*."+ext);
  fp.appendFilters(nsIFilePicker.filterAll);
  fp.defaultString = filename;
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    return fp.file.path;
  }
  return null;
}

function GetXPI() {
  var file = selectFile(
    "XPI file", 
    currentPackage.name+"-"+
      (currentPackage.version?currentPackage.version:"1.0")+".xpi", 
    "xpi");
  if (!file)
    return;
  
  var addonOptions = require("addon-options").buildForRun({
      packages: Packages.dict,
      mainPackageName : currentPackage.name,
    });
  
  require("xpi-builder").build(addonOptions, currentPackage, file, false);
}

function GetApp() {
  var file = selectFile(
    "Xulrunner application file", 
    currentPackage.name+"-"+
      (currentPackage.version?currentPackage.version:"1.0")+".zip", 
    "zip");
  if (!file)
    return;
  
  require("application-builder").build(Packages.dict, currentPackage, file);
}

window.addEventListener("load", function onload() {
  window.removeEventListener("load", onload, false);
  try {
    
    Options.init();
    Packages.init();
    Packages.refreshList();
    Report.init();
    
    var args = document.location.href.replace(/:$/,"").split(":");
    
    // home
    if (args.length >= 1) {
      
    } 
    
    var p = null;
    // Package
    if (args.length >= 2) {
      var packageName = args[1];
      p = Packages.dict[packageName];
      if (!p)
        return alert("Unable to found package '"+packageName+"'");
      openPackage(p);
      Packages.refreshList();
    }
    
    // Execution: test or run
    if (args.length >= 3) {
      var cmd = args[2];
      if (cmd == "run")
        launch(p, "libs");
      else if (cmd == "test")
        launch(p, "tests");
      else
        launch(p, "tests", cmd);
    }
    
    
  } catch(e) {
    alert("Exception during load: "+e+" \n "+e.stack);
  }
}, false);

window.addEventListener("unload", function () {
  Kill();
}, false);

} catch(e) {
  alert(e);
}