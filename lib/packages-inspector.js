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
  }
  for each(let name in ['lib', 'tests', 'dependencies', 'packages']) normalize(name);
  
  json.root_dir = dir;
  
  return json;
}

exports.getPackage = function (packagePath) {
  var packageManifest = path.join(packagePath,"package.json");
  if (!path.existsSync(packageManifest)) return null;
  var json = JSON.parse(fs.readFileSync(packageManifest));
  return parseManifest(packagePath,json);
}

exports.getPackages = function (rootPath) {
  var packages = {};
  
  function parseDir(dir) {
    var dirs = fs.readDirSync(dir);
    for(var i=0; i<dirs.length; i++) {
      var packageDir = dirs[i];
      var packageManifest = path.join(packageDir,"package.json");
      if (!path.existsSync(packageManifest)) continue;
      var json = JSON.parse(fs.readFileSync(packageManifest));
      var manifest = parseManifest(packageDir,json);
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
    var files = fs.readDirSync(dir);
    for(var i=0; i<files.length; i++) {
      var file = files[i];
      if (fs.statSync(file).isDirectory()) {
        libs = libs.concat(searchForLibsInDir(file,currentPath.concat([path.basename(file)])));
      } else if (path.extname(file)==".js") {
        libs.push({path:currentPath,name:path.basename(file)});
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
