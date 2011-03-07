const {components,Cc,Ci} = require("chrome");
const addonOptions = require("addon-options");
const URL = require("url");
const SELF = require("self");
const zip = require("zip");
const path = require("path");
const fs = require("fs");

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


exports.build = function (packages, package, zipfile) {
  let options = addonOptions.build(packages, package.name);
  
  options.main  = "main";
  options.verbose = true;
  
  let addonTemplatePath = URL.toFilename(SELF.data.url("addon-runner@mozilla.com"));
  let customInstallRDF = path.join(addonTemplatePath,"custom-install.rdf");
  
  let installRDF = new RDFManifest(SELF.data.url("addon-runner@mozilla.com/install.rdf"));
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
  
  xpi.add("components", path.join(addonTemplatePath,"components"));
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
  let workdir = path.join(URL.toFilename(SELF.data.url()), "..", "workdir");
  if (!path.existsSync(workdir))
    fs.mkdirSync(workdir);
  let tempOptions = path.join(workdir, "temp-options");
  fs.writeFileSync(tempOptions, JSON.stringify(options));
  xpi.add("harness-options.json", tempOptions);
  xpi.close();
  fs.unlinkSync(tempOptions);
  fs.unlinkSync(customInstallRDF);
  
  return options;
}
