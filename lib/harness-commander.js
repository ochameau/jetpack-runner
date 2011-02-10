const {components,Cc,Ci} = require("chrome");
const fs = require("fs");
const path = require("path");
const subprocess = require("subprocess");
const process = require("process");
const zip = require("zip");



exports.buildHarnessOptions = function (packages, targetPackage, additionalPackagesToInclude) {
  function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  }
  function guid() {
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
  }
  
  let jid = targetPackage.id?targetPackage.id:"jid0-"+new Date().getTime();
  
  let options = {
    jetpackID: jid,
    bundleID: jid+"@jetpack",
    verbose: true,
    bootstrap: {
      classID: guid(),
      contractID: "@mozilla.org/harness-service;1?id="+jid
    },
    
    metadata: {/*
      "addon-kit": {
        name: "addon-kit",
        license: "MPL 1.1/GPL 2.0/LGPL 2.1",
        "author": "Atul Varma (http://toolness.com/) <atul@mozilla.com>",
        "contributors": [
          "Myk Melez (http://melez.com/) ",
          "Daniel Aquino "
        ],
        "keywords": [
          "javascript",
          "engine",
          "platform",
          "xulrunner"
        ],
        "description": "Add-on development made easy."
      },*/
      /*
      api-utils
      test-harness
      jetinspector
      */
    },
    loader: "resource://"+jid+"-api-utils-lib/cuddlefish.js",
    resourcePackages: {},
    packageData: {},
    rootPaths: [],
    enable_e10s: false,
    profileMemory: 0,
    manifest: {},
    resources: {},
    staticArgs: {}
  };
  
  function declareOneModule(pack,dir,module) {
    var name = module.name.replace(/\.js$/,"");
    var resourcePath = "resource://"+jid+"-"+pack+"-"+dir+"/"+module.path.join("/")+(module.path.length>0?"/":"")+module.name;
    console.log(pack+" - "+dir+" - "+module.name);
    
    options.manifest[resourcePath] = {
      "e10s-adapter": null,
      "hash": "cb48bee8c6d7c545b73f0b05115e70f41417352131fc49634fe18051bba47b99",
      "name": name,
      "sectionName": dir,
      "chrome": true,
      "packageName": pack,
      "zipname": resourcePath,
      "requires": {/*
        "unload": object{
          "url": string"resource://jetinspector-api-utils-lib/unload.js"
        },
        "observer-service": object{
          "url": string"resource://jetinspector-api-utils-lib/observer-service.js"
        },
        "timer": object{
          "url": string"resource://jetinspector-api-utils-lib/timer.js"
        },
        "xul-app": object{
          "url": string"resource://jetinspector-api-utils-lib/xul-app.js"
        },
        "events": object{
          "url": string"resource://jetinspector-api-utils-lib/events.js"
        }*/
      }
    };
  }
  
  
  let includedPackages = {};
  function includePackage(name, requiredBy) {
    let p = packages[name];
    if (!p)
      throw new Error("Unable to found package with name : "+name+(requiredBy?" (required by "+requiredBy+")":""));
    if (includedPackages[p.name]) return;
    includedPackages[p.name]=true;
    
    if (p.dependencies) {
      for(let j=0; j<p.dependencies.length; j++) {
        includePackage(p.dependencies[j], p.name);
      }
    }
    
    console.log("Register package : "+p.name);
    var extra = require("packages-inspector").getExtraInfo(p);
    
    function registerOneResourcesDir(dir, dirType) {
      var resourceId = jid+"-"+p.name+"-"+dir;
      var resourcePath = "resource://"+resourceId;
      options.resources[resourceId] = path.join(p.root_dir,dir);
      options.resourcePackages[resourceId] = p.name;
      options.rootPaths.push(resourcePath);
      if (dirType=="data")
        options.packageData[p.name] = resourcePath+"/";
    }
    
    function readCommonJSDirectories(modulesByDir, dirType) {
      for(var dir in modulesByDir) {
        for each(var module in modulesByDir[dir]) {
          declareOneModule(p.name,dir,module);
        }
        registerOneResourcesDir(dir,dirType);
      }
    }
    
    readCommonJSDirectories(extra.libs,"libs");
    if (p.name == targetPackage)
      readCommonJSDirectories(extra.tests,"tests");
    
    for(let i=0; i<p.data.length; i++) {
      let dir = p.data[i];
      registerOneResourcesDir(dir,"data");
    }
  }
  
  // Force api-utils inclusion, at least for loader/cuddlefish.js
  includePackage("api-utils");
  
  includePackage(targetPackage);
  
  if (additionalPackagesToInclude) {
    for(let i=0; i<additionalPackagesToInclude.length; i++)
      includePackage(additionalPackagesToInclude[i]);
  }
  
  return options;
}

function setHarnessOptions(options) {
  var environ = Cc["@mozilla.org/process/environment;1"]
                .getService(Ci.nsIEnvironment);
  //console.log(JSON.stringify(options));
  
  environ.set("HARNESS_OPTIONS","");
  
  let filePath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com/harness-options.json"));
  fs.writeFileSync(filePath, JSON.stringify(options));
}

function runMozilla(binaryPath, runAsApp) {
  let command = binaryPath;
  
  let profile = path.join(require("url").toFilename(require("self").data.url()),"..","workdir","profile");
  let args = ["-jsconsole","-profile",profile];
  
  if (runAsApp) {
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
    fs.writeFileSync(userpref, 'pref("browser.shell.checkDefaultBrowser", false);');
  }
  
  // Specific windows case
  // We have to launch mozilla binary via cmd.exe
  if (process.env.ComSpec) {
    args = ['/C',command].concat(args);
    command = process.env.ComSpec; // Retrieve cmd.exe path
  }
  
  console.log(command);
  console.log(args.join(', '));
  
  var p = subprocess.call({
    command:     command,
    arguments:   args,
    environment: [],
    //workdir: 'c:\\',
    stdin: subprocess.WritablePipe(function() {
      
    }),
    stdout: subprocess.ReadablePipe(function(data) {
      console.log("got data on stdout:" +data+"\n");
    }),
    stderr: subprocess.ReadablePipe(function(data) {
      console.log("got data on stderr:" +data+"\n");
    }),
    onFinished: subprocess.Terminate(function() {
      console.log("process terminated with " +this.exitCode + "\n");
    }),
    mergeStderr: true
  });
}

exports.launchTest = function (binaryPath, packages, runAsApp, package, dirName, testName) {
  let options = exports.buildHarnessOptions(packages, package.name, ["test-harness"]);
  
  if (testName)
    options.filter = testName;
  
  options.iterations = 1;
  options.main  = "run-tests";
  
  let workdir = path.join(require("url").toFilename(require("self").data.url()),"..","workdir");
  options.logFile = path.join(workdir,"harness_log");
  options.resultFile = path.join(workdir,"harness_result");
  
  setHarnessOptions(options);
  runMozilla(binaryPath, runAsApp);
}

exports.launchMain = function (binaryPath, packages, runAsApp, package) {
  let options = exports.buildHarnessOptions(packages, package.name);
  
  options.main  = "main";
  options.verbose = true;

  setHarnessOptions(options);
  runMozilla(binaryPath, runAsApp);
}

function RDFManifest(url) {
  let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);
  req.open("GET", url, false); 
  req.send(null);
  
  let dom = req.responseXML;

  this.set = function (name, value) {
    let elements = dom.documentElement.getElementsByTagName(name);
    if (!elements)
      throw new Error("Element with value not found: "+name);
    if (!elements[0].firstChild)
      elements[0].appendChild(dom.createTextNode(value));
    else
      elements[0].firstChild.nodeValue = value;
  };
  
  this.get = function (name, defaultValue) {
    let elements = dom.documentElement.getElementsByTagName(name);
    if (!elements || !elements[0].firstChild)
      return defaultValue;
    return elements[0].firstChild.nodeValue;
  }
  
  this.remove = function (name) {
    let elements = dom.documentElement.getElementsByTagName(name);
    if (!elements) {
      return true;
    }
    else {
      for(var i=0; i<elements.length; i++) {
        let e = elements[i];
        e.parentNode.removeChild(e);
      }
    }
  }
  
  this.saveTo = function (path) {
    let serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"]
      .createInstance(Ci.nsIDOMSerializer);
 
    let foStream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Ci.nsIFileOutputStream);
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    try {
      file.initWithPath(path);
    } catch(e) {
      throw new Error("This path is not valid : "+path+"\n"+e);
    }
    foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
    serializer.serializeToStream(dom, foStream, "");   // rememeber, doc is the DOM tree
    foStream.close();
  }
}

exports.buildXPI = function (packages, package, zipfile) {
  let options = exports.buildHarnessOptions(packages, package.name);
  
  options.main  = "main";
  options.verbose = true;
  
  let addonTemplatePath = require("url").toFilename(require("self").data.url("addon-runner@mozilla.com"));
  let customInstallRDF = path.join(addonTemplatePath,"custom-install.rdf");
  
  let installRDF = new RDFManifest(require("self").data.url("addon-runner@mozilla.com/install.rdf"));
  installRDF.set("em:id", options.bundleID);
  installRDF.set("em:version",
               package.version?package.version:'1.0');
  installRDF.set("em:name",
               package.fullName?package.fullName:package.name);
  installRDF.set("em:description",
               package.description);
  installRDF.set("em:creator",
               package.author);
  installRDF.set("em:bootstrap", "true");
  installRDF.set("em:unpack", "true");
  
  installRDF.remove("em:updateURL")

  if (package.homepage)
      installRDF.set("em:homepageURL", package.homepage);
  else
      installRDF.remove("em:homepageURL");
  
  installRDF.saveTo(customInstallRDF);
  
  // Replace zipname "resources://$(resourceID)" url by relative path "resources/$(resourceID)"
  for(let i in options.manifest)
    options.manifest[i].zipname = options.manifest[i].zipname.replace(/:\//,"");
  
  // Replace resources absolute path, by relative one
  // And copy resources file to zip
  let xpi = new zip.ZipWriter(zipfile);
  
  fs.unlinkSync(path.join(addonTemplatePath,"harness-options.json"));
  
  let application = false;
  
  xpi.add("components", path.join(addonTemplatePath,"components"));
  if (application)
    xpi.add("application.ini", path.join(addonTemplatePath,"application.ini"));
  if (!application)
    xpi.add("bootstrap.js", path.join(addonTemplatePath,"bootstrap.js"));
  
  xpi.add("chrome.manifest", path.join(addonTemplatePath,"chrome.manifest"));
  xpi.add("install.rdf", customInstallRDF);
  
  for(let id in options.resources) {
    //let dir = path.basename(options.resources[id]);
    //let packageName = path.basename(path.dirname(options.resources[id]));
    xpi.add("resources/"+id, options.resources[id]);
    options.resources[id] = ["resources", id];
  }
  // Generate options-harness and write it to zipfile
  let workdir = path.join(require("url").toFilename(require("self").data.url()), "..", "workdir");
  let tempOptions = path.join(workdir, "temp-options");
  fs.writeFileSync(tempOptions, JSON.stringify(options));
  xpi.add("harness-options.json", tempOptions);
  xpi.close();
  fs.unlinkSync(tempOptions);
  fs.unlinkSync(customInstallRDF);
  
  return options;
}

