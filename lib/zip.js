const { Ci, Cc } = require("chrome");
const path = require("path");

const PR_RDONLY      = 0x01;
const PR_WRONLY      = 0x02;
const PR_RDWR        = 0x04;
const PR_CREATE_FILE = 0x08;
const PR_APPEND      = 0x10;
const PR_TRUNCATE    = 0x20;
const PR_SYNC        = 0x40;
const PR_EXCL        = 0x80;

function createNsFile(path) {
  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  try {
    file.initWithPath(path);
  } catch(e) {
    throw new Error("This path is not valid : "+path+"\n"+e);
  }
  return file;
}

exports.ZipWriter = function (zipPath) {
  let zw = Cc["@mozilla.org/zipwriter;1"]
                .createInstance(Ci.nsIZipWriter);
  zw.open(createNsFile(zipPath), PR_RDWR | PR_CREATE_FILE | PR_TRUNCATE);
  
  this.add = function add(pathInZip, filePath) {
    let nsfile = typeof filePath=="object" && typeof filePath.leafName=="string"?filePath:createNsFile(filePath);
    if (!nsfile.exists())
      throw new Error("This file doesn't exists : "+filePath);
    // Case 1/ Regular file
    if (!nsfile.isDirectory()) {
      try {
        zw.addEntryFile(pathInZip, Ci.nsIZipWriter.COMPRESSION_DEFAULT, nsfile, false);
      } catch(e) {
        console.log(e);
        console.log(pathInZip);
      }
      return;
    }
    // Case 2/ Directory
    let entries = nsfile.directoryEntries;
    let array = [];
    
    if (pathInZip && pathInZip.length>0)
      zw.addEntryDirectory(pathInZip, nsfile.lastModifiedTime, false);
    
    while(entries.hasMoreElements()) {
      let entry = entries.getNext();
      entry.QueryInterface(Ci.nsIFile);
      if (entry.leafName=="." || entry.leafName=="..") continue;
      this.add((pathInZip && pathInZip.length>0 && pathInZip[pathInZip.length-1]!="/"?pathInZip+"/":"")+entry.leafName, entry);
    }
  }
  
  this.close = function close() {
    zw.close();
  }
}

