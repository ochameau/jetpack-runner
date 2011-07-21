const Cu = Components.utils, Ci = Components.interfaces, Cc = Components.classes;

let _quit = false;


// Fake a Firefox in order to make various code depending on xulappinfo work!
const XULAPPINFO_CONTRACTID = "@mozilla.org/xre/app-info;1";
const XULAPPINFO_CID = Components.ID("{fc937916-656b-4fb3-a395-8c63569e27a8}");
const XULAppInfo = {
  vendor: "Mozilla",
  name: "Firefox",
  ID: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  version: "5.0",
  appBuildID: "20110615151330",
  platformVersion: "5.0",
  platformBuildID: "20110615151330",
  inSafeMode: false,
  logConsoleErrors: true,
  OS: "WINNT",
  XPCOMABI: "noarch-spidermonkey",
  
  QueryInterface: function QueryInterface(iid) {
    if (iid.equals(Ci.nsIXULAppInfo)
     || iid.equals(Ci.nsIXULRuntime)
     || iid.equals(Ci.nsISupports))
      return this;
  
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};
const XULAppInfoFactory = {
  CID: XULAPPINFO_CID,
  scheme: "XULAppInfo",
  contractID: XULAPPINFO_CONTRACTID,
  createInstance: function (outer, iid) {
    if (outer != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;
    return XULAppInfo.QueryInterface(iid);
  }
};
var registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
registrar.registerFactory(XULAPPINFO_CID, "XULAppInfo",
                          XULAPPINFO_CONTRACTID, XULAppInfoFactory);
////
try {
let applicationRoot = __LOCATION__.parent.clone();
applicationRoot.append("jetpack-runner-01");
let harnessJs = applicationRoot.clone();
harnessJs.append("components");
harnessJs.append("harness.js");

var ios = Cc['@mozilla.org/network/io-service;1']
          .getService(Ci.nsIIOService);
var path = ios.newFileURI(harnessJs).spec;
var harness = {};
var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
             .getService(Ci.mozIJSSubScriptLoader);
scriptLoader.loadSubScript(path, harness);

var HarnessService = harness.buildHarnessService(applicationRoot);
var factory = HarnessService.prototype._xpcom_factory;
var proto = HarnessService.prototype;

var manager = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
manager.registerFactory(proto.classID,
                        proto.classDescription,
                        proto.contractID,
                        factory);

var harnessService = factory.createInstance(null, Ci.nsISupports);
harnessService = harnessService.wrappedJSObject;

//harnessService.load("startup");
let loader = harnessService.loader;

let envService = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
let packageFolderPaths = envService.get("JR_PACKAGES").split(";");
//packageFolderPaths = packageFolderPaths.map(function (v) {return (v[v.length-1]!="\\") ? v + "\\" : v;});
var packages = {};
let inspector = loader.require("packages-inspector")
for each (let path in packageFolderPaths) {
  let errors = inspector.getPackages(path, packages);
  if (errors)
    dump("Unable to load one package from registered directory '" + path + 
         "': \n" + errors.join('\n') + "\n");
  
}
let p = null;
try {
  p = inspector.getPackage(arguments[0]);
}
catch(e) {
  dump("Unable to found a valid package in current directory: \n"+e+"\n");
}
if (!p) {
  dump("There is no package in current directory\n");
} else {
  dump("Registered packages: " + Object.keys(packages).join(', ') + "\n");
  dump("Running package: " + p.name + "\n");

  let options = loader.require("addon-options").buildForRun({
    packages: packages,
    mainPackageName : p.name,
  });
  
  // Avoid loop in console.log <-> test-harness <-> harness
  options.noDumpInJsConsole = true;
  
  let xpiPath = loader.require("temp").path("jr-cmd-line.xpi");    
  let newOptions = loader.require("xpi-builder").build(options, p.name, xpiPath);
  let process = loader.require("addon-runner").runRemote({
    binary: loader.require("moz-bin-search").getBestBinary(),
    xpiPath: xpiPath,
    xpiID: newOptions.bundleID,
    
    runAsApp: false,
    
    stdout: function(data) {
      dump(">>"+data);
      //p.kill();
    },
    quit: function (data) {
      if (loader.require("path").existsSync(xpiPath))
        loader.require("fs").unlinkSync(xpiPath);
      _quit = true;
    }
  });
  
}


var thr = Components.classes["@mozilla.org/thread-manager;1"]
                    .getService().currentThread;

while (!_quit)
  thr.processNextEvent(true);

while (thr.hasPendingEvents())
  thr.processNextEvent(true);
//dump(packageFolderPaths.toSource());
//dump(packages.toSource());


}
catch(e) {
  dump("Exception: "+e+"\n"+e.message);
}