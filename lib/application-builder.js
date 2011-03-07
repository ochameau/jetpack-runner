const addonOptions = require("addon-options");
const URL = require("url");
const SELF = require("self");
const zip = require("zip");
const path = require("path");
const fs = require("fs");

exports.build = function (packages, package, zipfile) {
  let options = addonOptions.build(packages, package.name);
  
  options.main  = "main";
  options.verbose = true;
  
  let templatePath = URL.toFilename(SELF.data.url("addon-runner@mozilla.com"));
  
  // Replace zipname "resources://$(resourceID)" url by relative path "resources/$(resourceID)"
  for(let i in options.manifest)
    options.manifest[i].zipname = options.manifest[i].zipname.replace(/:\//,"");
  
  // Replace resources absolute path, by relative one
  // And copy resources file to zip
  let zw = new zip.ZipWriter(zipfile);
  
  fs.unlinkSync(path.join(templatePath,"harness-options.json"));
  
  zw.add("components", path.join(templatePath,"components"));
  zw.add("application.ini", path.join(templatePath,"application.ini"));
  
  zw.add("chrome.manifest", path.join(templatePath,"chrome.manifest"));
  
  // Used by commandLine components to create and call harness
  zw.add("bootstrap.js", path.join(templatePath,"bootstrap.js"));
  
  for(let id in options.resources) {
    //let dir = path.basename(options.resources[id]);
    //let packageName = path.basename(path.dirname(options.resources[id]));
    zw.add("resources/"+id, options.resources[id]);
    options.resources[id] = ["resources", id];
  }
  
  // Generate options-harness and write it to zipfile
  let workdir = path.join(URL.toFilename(SELF.data.url()), "..", "workdir");
  let tempOptions = path.join(workdir, "temp-options");
  fs.writeFileSync(tempOptions, JSON.stringify(options));
  zw.add("harness-options.json", tempOptions);
  zw.close();
  fs.unlinkSync(tempOptions);
  
  return options;
}
