const path = require("path");
const fs = require("fs");

function parseManifest(dir, json) {
  if (!json.name)
    json.name = path.basename(dir);
  
  function apply_default_dir(name) {
    if (json[name]) return;
    var subdir = path.join(dir,name);
    if (path.existsSync(subdir) && fs.statSync(subdir).isDirectory())
      json[name] = [name];
  }
  for each(let name in ['lib', 'tests', 'data', 'packages']) apply_default_dir(name);
  
  function normalize(name) {
    if (typeof json[name]=="string")
      json[name] = [json[name]];
    else if (!json[name])
      json[name] = [];
  }
  for each(let name in ['lib', 'tests', 'data', 'dependencies', 'packages']) normalize(name);
  
  json.root_dir = dir;
  
  return json;
}

exports.getPackage = function (packagePath) {
  var packageManifest = path.join(packagePath,"package.json");
  if (!path.existsSync(packageManifest)) return null;
  var json = JSON.parse(fs.readFileSync(packageManifest));
  return parseManifest(packagePath,json);
}

exports.getPackages = function (rootPath, existingPackages) {
  var packages = existingPackages || {};
  
  function parseDir(dir) {
    var dirs = fs.readdirSync(dir);
    for(var i=0; i<dirs.length; i++) {
      var packageDir = dirs[i];
      var packageFullPath = path.join(dir, packageDir);
      var packageManifest = path.join(packageFullPath,"package.json");
      if (!path.existsSync(packageManifest)) continue;
      var json = JSON.parse(fs.readFileSync(packageManifest));
      var manifest = parseManifest(packageFullPath,json);
      if (packages[manifest.name])
        throw new Error("Duplicate package '"+manifest.name+"' : \n - "+manifest.root_dir.path+" - "+packages[manifest.name].root_dir.path);
      packages[manifest.name] = manifest;
      if (manifest.packages) {
        for each (let packageDirName in manifest.packages) {
          var packageFile = path.join(manifest.root_dir,packageDirName);
          parseDir(packageFile);
        }
      }
    }
  }
  
  parseDir(rootPath);
  
  return packages;
}

function getFilesNameFromDirList(root_dir, list) {
  
  function searchForLibsInDir(dir, currentPath) {
    var libs = [];
    var files = fs.readdirSync(dir);
    for(var i=0; i<files.length; i++) {
      var file = files[i];
      var fullpath = path.join(dir,file);
      if (fs.statSync(fullpath).isDirectory()) {
        libs = libs.concat(searchForLibsInDir(fullpath,currentPath.concat([file])));
      } else if (path.extname(file)==".js") {
        libs.push({path:currentPath, name:file});
      }
    }
    return libs;
  }
  
  var dirs = {};
  for each(var name in list) {
    var dir = path.join(root_dir,name);
    if (!path.existsSync(dir)) throw new Error("Unable to find "+name+" directory in : "+root_dir);
    dirs[name] = searchForLibsInDir(dir,[]);
  }
  
  return dirs;
}

exports.getExtraInfo = function (package) {
  return {
    libs : getFilesNameFromDirList(package.root_dir, package.lib),
    tests : getFilesNameFromDirList(package.root_dir, package.tests),
  };
}
