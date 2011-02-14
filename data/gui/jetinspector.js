function require(module) {
  return Components.classes[
    "@mozilla.org/harness-service;1?id=jid0-k60wfE2Xuwso9RsQpqdbOXw8ZWI"].
    getService().wrappedJSObject.loader.require(module);
}
var prefs = require("preferences-service");
var path = require("path");
var process = require("process");
var harnessCommander = require("harness-commander");

var packagesPath = "";//path.join(process.cwd(), "..");

var currentPackage = null;

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
    var info = mbs.getInfo(bin);
    $("#binary").append('<option value="'+i+'"'+(bin==binaryPath?' selected="true"':'')+'>'+info.name+' '+info.version+' - '+bin+'</option>');
  }
  $("#binary").change(function () {
    var i = parseInt($(this).val());
    prefs.set("binary-path",bins[i]);
  });
}

function downdloadAndUseSDK() {
  var url = $("#sdk").val();
  
  require("online-sdk").download(url, function (dir) {
    packagesPath = dir;
    loadPackagesList();
  });
}

function loadPackagesList() {
  var packages = null;
  if (packagesPath)
    packages = require("packages-inspector").getPackages(packagesPath);
  var domTarget = $("#packages-list");
  
  var count = 0;
  for(var i in packages) {
    var p = packages[i];
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
      for(var i=0; i<list.length; i++) {
        $("#sdk").append('<option value="'+list[i].url+'" '+(i==list.length-1?'selected="true"':'')+'>'+list[i].version+'</option>');
      }
    });
    $("#sdk-selection").show();
    domTarget.hide();
  } else {
    domTarget.show();
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
  var packages = require("packages-inspector").getPackages(packagesPath);
  
  var options = {
    binary: prefs.get("binary-path"),
    packages: packages, 
    runAsApp: prefs.get("run-as-app"),
    package: package,
  };
  if (dirType=="tests") {
    
    if (file)
      options.testName = file.name;
    harnessCommander.launchTest(options);
    
  } else if (dirType=="libs") {
    
    harnessCommander.launchMain(options);
    
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
function GetXPI() {
  var file = selectFile(
    "XPI file", 
    currentPackage.name+"-"+
      (currentPackage.version?currentPackage.version:"1.0")+".xpi", 
    "xpi");
  if (!file)
    return;
  var packages = require("packages-inspector").getPackages(packagesPath);
  harnessCommander.buildXPI(packages, currentPackage, file);
}

function GetApp() {
  var file = selectFile(
    "Xulrunner application file", 
    currentPackage.name+"-"+
      (currentPackage.version?currentPackage.version:"1.0")+".zip", 
    "zip");
  if (!file)
    return;
  var packages = require("packages-inspector").getPackages(packagesPath);
  harnessCommander.buildStandaloneApplication(packages, currentPackage, file);
}

window.addEventListener("load",function () {
  try {
    loadBinaries();
    loadSettings();
    loadPackagesList();
  } catch(e) {
    Components.utils.reportError("load ex: "+e);
  }
},false);


