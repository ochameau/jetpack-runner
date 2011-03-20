const { Ci, Cc } = require("chrome");
const fs = require("fs");
const path = require("path");

function copyOneFile(source, target, callback) {
  var srcFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  try {
    srcFile.initWithPath(source);
  } catch(e) {
    callback("This path is not valid : "+path+"\n"+e);
  }
  if (!srcFile.exists())
    return callback("File doesn't exists : "+path);
  if (!srcFile.isFile())
    return callback("Only regular files can be copied : "+path);
  var dstDirectory = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  var dstDirectoryPath = path.dirname(target);
  try {
    dstDirectory.initWithPath(dstDirectoryPath);
  } catch(e) {
    callback("This path is not valid : "+dstDirectoryPath+"\n"+e);
  }
  if (!dstDirectory.exists())
    return callback("Destination directory doesn't exists : "+dstDirectoryPath);
  if (!dstDirectory.isDirectory())
    return callback("Destination is not a directory : "+dstDirectoryPath);
  
  try {
    srcFile.copyTo(dstDirectory, path.basename(target));
  } catch(e) {
    callback("Unable to copy this file : "+source+"\nTo: "+target+"\nError:"+e);
  }
  callback();
}

exports.copy = function (source, target, callback) {
  fs.stat(source, function (err, stat) {
    if (err)
      return callback(err);
    if (!stat)
      return callback(source+" doesn't exists");
    
    // Copy one regular file
    if (!stat.isDirectory()) {
      copyOneFile(source, target, callback);
      return;
    }
    
    // Copy a directory
    fs.stat(target, function (err, stat) {
      if (err)
        return callback(err);
      
      if (!stat) {
        try {
          fs.mkdirSync(target);
        } catch(e) {
          return callback("Unable to create target directory: "+e);
        }
      }
      fs.readdir(source, function (err, files) {
        if (err) 
          return callback(err);
        function copyOneByOne() {
          let file = files.pop();
          if (!file) 
            return callback();
          exports.copy(path.join(source, file), path.join(target, file),
            function (err) {
              if (err) 
                return callback(err);
              copyOneByOne();
            });
        }
        copyOneByOne();
      });
      
    });
  });
}
