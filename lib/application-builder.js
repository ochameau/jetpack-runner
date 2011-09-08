const addonOptions = require("addon-options");
const URL = require("url");
const SELF = require("self");
const zip = require("zip");
const path = require("path");
const fs = require("fs");

exports.build = function (options, mainPackage, zipfile, useSymlinks) {
  let newOptions = JSON.parse(JSON.stringify(options));
  
  let templatePath = URL.toFilename(SELF.data.url("addon-runner@mozilla.com"));
  
  // Replace resources absolute path, by relative one
  // And copy resources file to zip
  let zw = new zip.ZipWriter(zipfile);
  
  fs.unlinkSync(path.join(templatePath, "harness-options.json"));
  
  zw.add("components", path.join(templatePath, "components"));
  zw.add("application.ini", path.join(templatePath, "application.ini"));
  
  zw.add("chrome.manifest", path.join(templatePath, "chrome.manifest"));
  
  // Used by commandLine components to create and call harness
  zw.add("bootstrap.js", path.join(templatePath, "bootstrap.js"));
  
  if (!useSymlinks) {
    // Copy modules js, tests and data into the XPI file, in resources folder
    // And update options with their new resource url (instead of file path)
    for(let id in newOptions.resources) {
      zw.add("resources/" + id, newOptions.resources[id]);
      newOptions.resources[id] = ["resources", id];
    }
    // Remove sourcePath attributes
    for(let i in newOptions.manifest)
      delete newOptions.manifest[i].sourcePath;
  }
  
  // Generate options-harness and write it to zipfile
  let tempOptions = require("temp").path("temp-options");
  fs.writeFileSync(tempOptions, JSON.stringify(newOptions));
  zw.add("harness-options.json", tempOptions);
  zw.close();
  fs.unlinkSync(tempOptions);
  
  return newOptions;
}
