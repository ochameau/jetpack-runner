function require(module) {
  return Components.classes[
    "@mozilla.org/harness-service;1?id=jid0-k60wfE2Xuwso9RsQpqdbOXw8ZWI"].
    getService().wrappedJSObject.loader.require(module);
}
var prefs = require("preferences-service");
var path = require("path");
var process = require("process");

var packagesPath = path.join(process.cwd(), "..");

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

function loadPackagesList() {
  
  var packages = require("packages-inspector").getPackages(packagesPath);
  var domTarget = $("#packages-list");
  
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
  }
  
}

function openPackage(package) {
  $("#package-decription").show();
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
        (function (dir,file) {
          li.click(function () {
            try {
              launchTest(package,dir,dirType,file);
            } catch(e) {
              Components.utils.reportError(e+"\n"+e.stack);
            }
          });
        })(dir,file);
        subUl.append(li);
      }
      ul.append(subUl);
    }
    
  }
  fillListWithFiles($("#package-libs"), extra.libs, "libs");
  fillListWithFiles($("#package-tests"), extra.tests, "tests");
  
}

function launchTest(package, dirName,dirType,file) {
  var packages = require("packages-inspector").getPackages(packagesPath);
  
  if (dirType=="tests") {
    
    require("harness-commander").launchTest(prefs.get("binary-path"), packages, prefs.get("run-as-app"), package, dirName, file.name);
    
  } else if (dirType=="libs") {
    
    require("harness-commander").launchMain(prefs.get("binary-path"), packages, prefs.get("run-as-app"), package, dirName);
    
  }
  
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


