var prefs = require("preferences-service");
var packagesInspector = require("packages-inspector");
var onlineSDK = require("online-sdk");

var Packages = {
  dict : {}
};

Packages.init = function PackagesInit() {
  $("#packages-add-path").click(Packages.addIncludePath);
  $("#packages-options-button").click(Packages.toggleOptions);
  $("#download-sdk").click(Packages.downloadSDK);
}

Packages.addIncludePath = function PackagesAddIncludePath() {
  var path = Packages._selectFolder("Package(s) folder");
  if (path) {
    Packages.registerIncludePath(path);
  }
}

Packages.registerIncludePath = function PackagesRegisterIncludePath(path) {
  var previous = prefs.get("include-paths");
  if (!previous || previous.split('\n').indexOf(path)==-1) {
    try {
      var count = 0;
      for(var i in Packages.dict)
        count--;
      var packages = packagesInspector.getPackages(path, Packages.dict);
      for(var i in packages)
        count ++;
      if (count <= 0) 
        return alert("Unable to found a package in this include path");
    } catch(e) {
      return alert("Error while adding this include path : \n" + e);
    }
    prefs.set("include-paths", (previous ? previous + '\n' : '') + path);
  } else {
    return alert("This package path is already registered");
  }
  Packages.refreshList();
}

Packages.refreshList = function PackagesRefreshList() {
  Packages.dict = {};
  var packagesPaths = prefs.get("include-paths");
  if (packagesPaths) {
    packagesPaths = packagesPaths.split('\n');
    var list = $("#packages-path-list");
    list.empty();
    for(var i = 0; i < packagesPaths.length; i++) {
      var pPath = packagesPaths[i];
      list.append('<li title="' + pPath + '">.../' + 
        pPath.split(/\/|\\/).slice(-3).join('/') + 
        '</li>');
      Packages.dict = packagesInspector.getPackages(pPath, Packages.dict);
    }
    
    if (Packages.dict["addon-kit"] && !prefs.get("sdk-version") && Packages.dict["addon-kit"].version) {
      prefs.set("sdk-version", Packages.dict["addon-kit"].version);
      Packages.loadSDKVersion();
    }
  }
  var domTarget = $("#packages-list");
  domTarget.empty();
  
  var list = [];
  for(var i in Packages.dict) {
    var p = Packages.dict[i];
    list.push(i);
  }
  list.sort();
  
  var count = 0;
  for(var i = 0; i < list.length; i++) {
    var p = Packages.dict[list[i]];
    var elt = $("<li></li>");
    elt.addClass("link");
    if (currentPackage && p.name == currentPackage.name)
      elt.addClass("current");
    else
      elt.removeClass("current");
    elt.text(p.name);
    (function (elt,p) {
      elt.click(function () {
        document.location = "jetpack:" + p.name;
      });
    })(elt,p);
    domTarget.append(elt);
    count++;
  }
  
  if (count == 0) {
    $("#sdk-selection").show();
    domTarget.append("<li>No packages</li>");
  }
}

Packages.toggleOptions = function PackagesToggleOptions() {
  var options = $("#packages-options");
  options.toggle();
  if (options.is(':visible')) {
    Packages.loadSDKVersion();
  }
}

Packages.loadSDKVersion = function PackagesLoadSDKVersion() {
  var currentVersion = prefs.get("sdk-version");
  $("#current-sdk-version").text(currentVersion ? currentVersion : "Unknown");
  
  var domTarget = $("#sdk");
  if (domTarget.children().length > 0)
    return;
  onlineSDK.getAvailableVersions(function (err, list) {
    Packages._sdkVersions = list;
    
    for(var i=0; i<list.length; i++) {
      var selected = (!currentVersion && i==list.length-1) || 
        (currentVersion && list[i].version==currentVersion);
      domTarget.append('<option value="'+i+'" '+(selected?'selected="true"':'')+'>'+list[i].version+'</option>');
    }
  });
}

Packages.downloadSDK = function PackagesDownloadSDK() {
  var path = Packages._selectFolder("SDK folder");
  if (!path) return;
  
  var i = $("#sdk").val();
  var sdk = Packages._sdkVersions[i];
  prefs.set("sdk-version", sdk.version);
  
  var loading = $("#sdk-loading");
  loading.show();
  require("online-sdk").download(sdk, path, function () {
    loading.hide();
    Packages.registerIncludePath(path);
  });
}

Packages._selectFolder = function PackagesSelectFolder(title) {
  var fp = Components.classes["@mozilla.org/filepicker;1"]
               .createInstance(nsIFilePicker);
  fp.init(window, title, nsIFilePicker.modeGetFolder);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    return fp.file.path;
  }
  return null;
}
