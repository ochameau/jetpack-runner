function require(module) {
  return Components.classes[
    "@mozilla.org/harness-service;1?id=jetpack-runner"].
    getService().wrappedJSObject.loader.require(module);
}
var prefs = require("preferences-service");
var path = require("path");
var fs = require("fs");
var process = require("process");
var runner = require("addon-runner");

var packagesPath = "";//path.join(process.cwd(), "..");

var currentPackage = null;
var hasMain = false;
var sdkVersions = null;
var gPackages = null;

function loadSettings() {
  var input = $("#run-as-app");
  input.attr("checked", !!prefs.get("run-as-app"));
  input.change(function () {
    prefs.set("run-as-app", $(this).is(":checked"));
  });
}

function toggleGeneralOptions() {
  var options = $("#options");
  options.toggle();
  $("#title").toggle();
  if (options.is(':visible')) {
    initTargetPlatformBinary();
  }
}

var optionsInited = false;
function initTargetPlatformBinary() {
  if (optionsInited)
    return;
  optionsInited = true;
  var runWithin = $('#run-within');
  var runWithinInput = $('#run-within input');
  function updateWith(doRunWithin) {
    runWithinInput.attr("checked", doRunWithin);
    if (doRunWithin) {
      $("#run-another").hide();
    } else {
      initBinariesList();
      $("#run-another").show();
    }
  }
  runWithinInput.change(function () {
    var newValue = runWithinInput.is(":checked");
    prefs.set("run-within", newValue);
    updateWith(newValue);
  });
  $('#run-within span').click(function (event) {
    var newValue = !runWithinInput.is(":checked");
    runWithinInput.attr("checked", newValue);
    prefs.set("run-within", newValue);
    updateWith(newValue);
  });
  
  if (!prefs.has("run-within")) {
    prefs.set("run-within", true);
    updateWith(true);
  } else {
    updateWith(prefs.get("run-within"));
  }
}

function initBinariesList() {
  var selectNode = $("#run-another select");
  
  // Check if binaries list is already built
  if (selectNode.children().length>0)
    return;
  
  var mbs = require("moz-bin-search");
  var bins = mbs.findBinaries();
  var binaryPath = prefs.get("binary-path");
  
  // Select first binary as default one
  if (!binaryPath || !path.existsSync(binaryPath)) {
    binaryPath = bins[0];
    prefs.set("binary-path",binaryPath);
  }
  if (bins.indexOf(binaryPath)==-1)
    bins.unshift(binaryPath);
  
  // Build the list
  for(var i=0; i<bins.length; i++) {
    var bin = bins[i];
    try {
      // getInfo can throw easily on linux
      var info = mbs.getInfo(bin);
      selectNode.append('<option value="'+i+'"'+(bin==binaryPath?' selected="true"':'')+'>'+info.name+' '+info.version+' - '+bin+'</option>');
    } catch(e) {}
  }
  
  // Watch for change
  selectNode.change(function () {
    var i = parseInt($(this).val());
    prefs.set("binary-path", bins[i]);
  });
}

function addIncludePath(includePath) {
  var path = selectFolder("Package(s) folder");
  if (path) {
    registerIncludePath(path);
  }
}

function registerIncludePath(includePath) {
  var previous = prefs.get("include-paths");
  if (!previous || previous.split('\n').indexOf(includePath)==-1) {
    try {
      var count = 0;
      for(var i in gPackages)
        count--;
      var packages = require("packages-inspector").getPackages(includePath, gPackages);
      for(var i in packages)
        count ++;
      if (count <= 0) 
        return alert("Unable to found a package in this include path");
    } catch(e) {
      return alert("Error while adding this include path : \n"+e);
    }
    prefs.set("include-paths", (previous?previous+'\n':'')+includePath);
  } else {
    return alert("This package path is already registered");
  }
  loadPackagesList();
}

function downdloadAndUseSDK() {
  var i = $("#sdk").val();
  var sdk = sdkVersions[i];
  prefs.set("sdk-version", sdk.version);
  
  var loading = $("#sdk-loading");
  loading.show();
  require("online-sdk").download(sdk, function (dir) {
    loading.hide();
    registerIncludePath(dir);
  });
}

function togglePackagesOptions() {
  var options = $("#packages-options");
  options.toggle();
  if (options.is(':visible')) {
    initSdkVersions();
  }
}

function initSdkVersions() {
  var currentVersion = prefs.get("sdk-version");
  $("#current-sdk-version").text(currentVersion ? currentVersion : "Unknown");
  
  var domTarget = $("#sdk");
  if (domTarget.children().length > 0)
    return;
  require("online-sdk").getAvailableVersions(function (err, list) {
    sdkVersions = list;
    
    for(var i=0; i<list.length; i++) {
      var selected = (!currentVersion && i==list.length-1) || 
        (currentVersion && list[i].version==currentVersion);
      domTarget.append('<option value="'+i+'" '+(selected?'selected="true"':'')+'>'+list[i].version+'</option>');
    }
  });
}


function loadPackagesList() {
  gPackages = null;
  var packagesPaths = prefs.get("include-paths");
  if (packagesPaths) {
    packagesPaths = packagesPaths.split('\n');
    var list = $("#packages-path-list");
    list.empty();
    for(var i=0; i<packagesPaths.length; i++) {
      var pPath = packagesPaths[i];
      list.append('<li title="'+pPath+'">.../'+pPath.split(/\/|\\/).slice(-3).join('/')+'</li>');
      gPackages = require("packages-inspector").getPackages(pPath, gPackages);
    }
    
    if (gPackages["addon-kit"] && !prefs.get("sdk-version") && gPackages["addon-kit"].version) {
      prefs.set("sdk-version", gPackages["addon-kit"].version);
      initSdkVersions();
    }
  }
  var domTarget = $("#packages-list");
  domTarget.empty();
  
  var list = [];
  for(var i in gPackages) {
    var p = gPackages[i];
    list.push(i);
  }
  list.sort();
  
  var count = 0;
  for(var i=0; i<list.length; i++) {
    var p = gPackages[list[i]];
    var elt = $("<li></li>");
    elt.addClass("link");
    elt.text(p.name);
    (function (elt,p) {
      elt.click(function () {
        try {
          openPackage(p);
        }catch(e){
          Components.utils.reportError(e);
        }
      });
    })(elt,p);
    domTarget.append(elt);
    count++;
  }
  
  if (count==0) {
    
    $("#sdk-selection").show();
    
    domTarget.append("<li>No packages</li>");
  }
}

function openPackage(package) {
  currentPackage = package;
  hasMain = false;
  $("#package-description").show();
  $("#package-name").text("Package: "+package.name);
  
  var extra = require("packages-inspector").getExtraInfo(package);
  
  function fillListWithFiles(ul, filesByDir, dirType) {
    ul.html("");
    for(var dir in filesByDir) {
      //var topLi=$("<li></li>");
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
              try {
                launch(package,dirType,file);
              } catch(e) {
                Components.utils.reportError(e+"\n"+e.stack);
              }
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

function launch(package, dirType, file) {
  
  $("#run-panel").show();
  if (dirType == "tests") {
    if (file)
      $("#report-title").text("Running test "+package.name+", "+file.name+":");
    else
      $("#report-title").text("Running all tests from "+package.name+":");
  }
  else {
    $("#report-title").text("Running "+package.name+":");
  }
  
  var addonOptions = null;
  if (dirType=="tests") {
    
    addonOptions = require("addon-options").buildForTest({
      packages: gPackages,
      mainPackageName: package.name,
      testName: file?file.name:null
    });
    // If there is no resultFile
    // harness.js won't try to kill firefox at end of tests!
    if (prefs.get("run-within")) {
      addonOptions.noKillAtTestEnd = true;
    }
    
  } else if (dirType=="libs") {
    
    addonOptions = require("addon-options").buildForRun({
      packages: gPackages,
      mainPackageName : package.name,
    });
    
  } else {
    throw new Error("Unknown dirType: "+dirType);
  }
  
  addonOptions.noDumpInJsConsole = true;
  
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
  
  var report = $("#console-report");
  report.empty();
  
  var p = null;
  if (prefs.get("run-within"))
    p = runner.runWithin({
      xpiPath: xpiPath,
      jetpackID: addonOptions.jetpackID,
      
      stdout : function (msg) {
        report.append(msg+"<br/>");
      },
      stderr : function (msg) {
        report.append(msg+"<br/>");
      },
      quit: function () {
        if (path.existsSync(xpiPath))
          fs.unlinkSync(xpiPath);
        report.append("------<br/><hr/>");
      }
    });
  else
    p = runner.runRemote({
      binary: prefs.get("binary-path"),
      xpiPath: xpiPath,
      xpiID: addonOptions.bundleID,
      
      runAsApp: prefs.get("run-as-app"),
      
      stdout : function (msg) {
        report.append(msg+"<br/>");
      },
      stderr : function (msg) {
        report.append(msg+"<br/>");
      },
      quit: function () {
        if (path.existsSync(xpiPath))
          fs.unlinkSync(xpiPath);
        report.append("------<br/>");
      }
    });
  setTimeout(function () {
    //console.log("try to kill");
    //p.kill();
  }, 6000);
}

function Run() {
  if (!hasMain)
    return alert("You need a 'main.js' file in order to run an extension");
  launch(currentPackage, "libs");
}

function Test() {
  launch(currentPackage, "tests");
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
function selectFolder(title) {
  var fp = Components.classes["@mozilla.org/filepicker;1"]
               .createInstance(nsIFilePicker);
  fp.init(window, title, nsIFilePicker.modeGetFolder);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
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
      packages: gPackages,
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
  
  require("application-builder").build(gPackages, currentPackage, file);
}

window.addEventListener("load",function () {
  try {
    loadSettings();
    loadPackagesList();
  } catch(e) {
    Components.utils.reportError("load ex: "+e+" - "+e.stack);
  }
},false);
