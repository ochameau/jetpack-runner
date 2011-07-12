const {components,Cc,Ci} = require("chrome");
const addonOptions = require("addon-options");
const URL = require("url");
const SELF = require("self");
const zip = require("zip");
const path = require("path");
const fs = require("fs");

const addonTemplatePath = URL.toFilename(SELF.data.url("addon-runner@mozilla.com"));

// We need a way to join an absolute path `rootPath` that use OS separator,
// and `relativePath` that use only '/'
// (On Unix, we would use regular path.join, but we can't do that on Windows)
function joinUnixPath(rootPath, relativePath) {
  if (!relativePath)
    return rootPath;
  let ospath = path.join.apply(null, relativePath.split("/"));
  return path.join(rootPath, ospath);
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

function buildInstallRDF(options, mainPackage) {
  let customInstallRDF = path.join(addonTemplatePath, "custom-install.rdf");
  
  let templateURL = SELF.data.url("addon-runner@mozilla.com/install.rdf");
  let installRDF = new RDFManifest(templateURL);
  installRDF.set("em:id", options.bundleID);
  installRDF.set("em:version",
               mainPackage.version ? mainPackage.version : '1.0');
  installRDF.set("em:name",
               mainPackage.fullName ? mainPackage.fullName : mainPackage.name);
  installRDF.set("em:description", mainPackage.description);
  installRDF.set("em:creator", mainPackage.author);
  installRDF.set("em:bootstrap", "true");
  installRDF.set("em:unpack", "true");
  
  installRDF.remove("em:updateURL")

  if (mainPackage.homepage)
      installRDF.set("em:homepageURL", mainPackage.homepage);
  else
      installRDF.remove("em:homepageURL");
  
  installRDF.saveTo(customInstallRDF);
  
  return customInstallRDF;
}

//   Build a regular XPI
// If useSymlinks = true: js, tests and data files won't be copied into the xpi
// but direct files path will be stored in harness-options file instead
exports.build = function (options, mainPackage, zipfile, useSymlinks) {
  let newOptions = JSON.parse(JSON.stringify(options));
  
  let xpi = new zip.ZipWriter(zipfile);
  
  fs.unlinkSync(path.join(addonTemplatePath,"harness-options.json"));
  
  xpi.add("components", path.join(addonTemplatePath, "components"));
  xpi.add("bootstrap.js", path.join(addonTemplatePath, "bootstrap.js"));
  
  xpi.add("chrome.manifest", path.join(addonTemplatePath, "chrome.manifest"));
  
  let customInstallRDF = buildInstallRDF(options, mainPackage);
  xpi.add("install.rdf", customInstallRDF);
  fs.unlinkSync(customInstallRDF);
  
  if (!useSymlinks) {
    // Copy modules js, tests and data into the XPI file, in resources folder
    // And update options with their new resource url (instead of file path)
    for(let id in newOptions.resources) {
      if (id.match(/(tests|lib)$/)) {
        for (let resourcePath in newOptions.manifest) {
          let url = "resource://" + id;
          if (resourcePath.indexOf(url) !== 0)
            continue;
          let path = resourcePath.replace(url, "");
          xpi.add("resources/" + id + path, joinUnixPath(newOptions.resources[id], path));
        }
      }
      else {
        xpi.add("resources/" + id, newOptions.resources[id]);
      }
      newOptions.resources[id] = ["resources", id];
    }
    // Remove sourcePath attributes
    for(let i in newOptions.manifest)
      delete newOptions.manifest[i].sourcePath;
  }
  
  // Generate options-harness and write it to zipfile
  let tempOptions = require("temp").path("temp-options");
  fs.writeFileSync(tempOptions, JSON.stringify(newOptions));
  xpi.add("harness-options.json", tempOptions);
  fs.unlinkSync(tempOptions);
  
  xpi.close();
  
  
  
  return newOptions;
}
