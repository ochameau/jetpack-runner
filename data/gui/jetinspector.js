function require(module) {
  return Components.classes[
    "@mozilla.org/harness-service;1?id=jid0-k60wfE2Xuwso9RsQpqdbOXw8ZWI"].
    getService().wrappedJSObject.loader.require(module);
}
var prefs = require("preferences-service");
var path = require("path");
var process = require("process");
var runner = require("addon-runner");

var packagesPath = "";//path.join(process.cwd(), "..");

var currentPackage = null;
var sdkVersions = null;
var gPackages = null;

function loadSettings() {
  $("#run_as_application").attr("checked",!!prefs.get("run-as-app"));
  $("#run_as_application").change(function () {
    prefs.set("run-as-app",$(this).is(":checked"));
  });
}

function loadBinaries() {
  var mbs = require("moz-bin-search");
  var bins = mbs.findBinaries();
  var binaryPath = prefs.get("binary-path");
  if (!binaryPath || !path.existsSync(binaryPath)) {
    binaryPath = bins[0];
    prefs.set("binary-path",binaryPath);
  }
  if (bins.indexOf(binaryPath)==-1)
    bins.unshift(binaryPath);
  for(var i=0; i<bins.length; i++) {
    var bin = bins[i];
    try {
      var info = mbs.getInfo(bin);
      $("#binary").append('<option value="'+i+'"'+(bin==binaryPath?' selected="true"':'')+'>'+info.name+' '+info.version+' - '+bin+'</option>');
    } catch(e) {}
  }
  $("#binary").change(function () {
    var i = parseInt($(this).val());
    prefs.set("binary-path",bins[i]);
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

function loadPackagesList() {
  gPackages = null;
  var packagesPaths = prefs.get("include-paths");
  if (packagesPaths) {
    packagesPaths = packagesPaths.split('\n');
    var list = $("#packages-path-list");
    list.empty();
    for(var i=0; i<packagesPaths.length; i++) {
      list.append("<li>"+packagesPaths[i]+"</li>");
      gPackages = require("packages-inspector").getPackages(packagesPaths[i], gPackages);
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
    require("online-sdk").getAvailableVersions(function (err, list) {
      sdkVersions = list;
      var currentVersion = prefs.get("sdk-version");
      for(var i=0; i<list.length; i++) {
        var selected = (!currentVersion && i==list.length-1) || 
          (currentVersion && list[i].version==currentVersion);
        $("#sdk").append('<option value="'+i+'" '+(selected?'selected="true"':'')+'>'+list[i].version+'</option>');
      }
    });
    $("#sdk-selection").show();
    $("#packages-box").hide();
  } else {
    $("#packages-box").show();
  }
}

function openPackage(package) {
  currentPackage = package;
  $("#package-description").show();
  $("#package-name").text("Package: "+package.name);
  
  var extra = require("packages-inspector").getExtraInfo(package);
  $("#package-libs").html("");
  $("#package-tests").html("");
  
  function fillListWithFiles(ul, filesByDir, dirType) {
    
    for(var dir in filesByDir) {
      //var topLi=$("<li></li>");
      var subUl = $("<ul></ul>");
      var dirName = $('<span class="package-dir-name"></span>');
      dirName.text(dir+":");
      subUl.append(dirName);
      for each(var file in filesByDir[dir]) {
        var li = $("<li></li>");
        li.text(file.path.concat([file.name]).join("/"));
        if (dirType=="tests") {
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
  fillListWithFiles($("#package-libs"), extra.libs, "libs");
  fillListWithFiles($("#package-tests"), extra.tests, "tests");
  
}

function launch(package, dirType, file) {
  
  var options = {
    binary: prefs.get("binary-path"),
    packages: gPackages, 
    runAsApp: prefs.get("run-as-app"),
    package: package,
  };
  if (dirType=="tests") {
    
    if (file)
      options.testName = file.name;
    runner.launchTest(options);
    
  } else if (dirType=="libs") {
    
    runner.launchMain(options);
    
  }
  
}

function Run() {
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
  
  require("xpi-builder").build(gPackages, currentPackage, file);
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
    loadBinaries();
    loadSettings();
    loadPackagesList();
  } catch(e) {
    Components.utils.reportError("load ex: "+e+" - "+e.stack);
  }
},false);
