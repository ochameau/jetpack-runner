const Request = require('request').Request;
const { Ci, Cc } = require("chrome");
const path = require("path");
const fs = require("fs");

const BASE_URL = "https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/";

exports.getAvailableVersions = function (callback) {
  Request({
    url: BASE_URL+"?C=M;O=A",
    onComplete: function (response) {
      let m = response.text.match(/>(addon-sdk-[\.\w]+\.zip)<\/a><\/td><td align="right">(\d+-\w+-\d+)/g);
      if (!m) //
        return callback("Unable to match versions");
      let list = [];
      for(var i=1; i<m.length; i++) {
        let file = m[i].match(/addon-sdk-[\.\w]+\.zip/)[0];
        let date = m[i].match(/\d+-\w+-\d+/)[0].replace(/-/g,"/");
        list.push({
          file: file,
          date: new Date(date),
          url: BASE_URL+file,
          version: file.match(/addon-sdk-([\.\w]+)\.zip/)[1]
        });
      }
      callback(null, list);
    }
  }).get();
}

const nsIWBP = Ci.nsIWebBrowserPersist;
const flags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES
  | nsIWBP.PERSIST_FLAGS_FROM_CACHE;
function downloadUrlTo(url, path, callback) {
  let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                .createInstance(Ci.nsIWebBrowserPersist);
  persist.persistFlags = flags ;
  persist.progressListener = {
	  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, 
        aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onStatusChanges: function () {},
	  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        callback()
      }
	  }
	}
  
  let obj_URI = Cc["@mozilla.org/network/io-service;1"]
	              .getService(Ci.nsIIOService)
	              .newURI(url, null, null);
  let file = Cc["@mozilla.org/file/local;1"]
	           .createInstance(Ci.nsILocalFile);
	file.initWithPath(path); 
  persist.saveURI(obj_URI, null, null, null, "", file);
}

exports.download = function (sdk, callback) {
  let workdir = path.join(require("url").toFilename(require("self").data.url()),"..","workdir");
  let filepath = path.join(workdir,"sdk.zip");
  let dirpath = path.join(workdir,"sdk");
  
  downloadUrlTo(sdk.url, filepath, function () {
    let zip = require("zip");
    let zr = new zip.ZipReader(filepath);
    let dirname = sdk.file.replace(".zip","");
    zr.extract(dirname+"/packages/*", dirpath);
    let packagesPath = path.join(dirpath, dirname, "packages");
    let packages = fs.readdirSync(packagesPath);
    for(let i=0; i<packages.length; i++) 
      fs.renameSync(
        path.join(packagesPath, packages[i]), 
        path.join(dirpath, packages[i]));
    fs.rmdirSync(packagesPath);
    fs.rmdirSync(path.join(dirpath, dirname));
    callback(dirpath);
  });
}