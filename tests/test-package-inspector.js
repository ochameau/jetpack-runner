const pi = require("packages-inspector");
const self = require("self");
const fs = require("fs");

function getDataFilePath(file) {
  return require("url").toFilename(self.data.url("tests/"+file));
}
function readManifest(repoName, packageName) {
  let file = getDataFilePath("test-pi/"+repoName+"/"+packageName+"/package.json");
  return JSON.parse(fs.readFileSync(file));
}

exports.testGetPackages = function (test) {
  let packages = pi.getPackages(getDataFilePath("test-pi/packages"));
  packages = pi.getPackages(getDataFilePath("test-pi/another-packages"), packages);
  
  let list = [];
  for(var name in packages) {
    let p = packages[name];
    list.push({name:name,value:p});
    test.assertEqual(p.name,name);
    let repo = name=="my-other-package"?"another-packages":"packages";
    let json = readManifest(repo, name);
    test.assertEqual(p.description,json.description);
    test.assertEqual(p.lib.length,1);
    test.assertEqual(p.lib[0],"lib");
    test.assertEqual(p.root_dir,getDataFilePath("test-pi/"+repo+"/"+name));
  }
  list.sort(function (a, b) {return a.name>b.name;});
  test.assertEqual(list.length,4);
  test.assertEqual(list[0].name,"aardvark");
  test.assertEqual(list[1].name,"api-utils");
  test.assertEqual(list[2].name,"barbeque");
  test.assertEqual(list[3].name,"my-other-package");
}

exports.testPackagesConflict = function (test) {
  let packages = pi.getPackages(getDataFilePath("test-pi/packages"));
  test.assertRaises(function () {
    pi.getPackages(getDataFilePath("test-pi/packages-conflict"), packages);
  },/Duplicate package 'api-utils'/);
}

exports.testGetExtraInfos = function (test) {
  let packages = pi.getPackages(getDataFilePath("test-pi/packages"));
  let info = pi.getExtraInfo(packages["api-utils"]);
  info.libs.lib.sort(function (a, b) a.name<b.name);
  test.assertEqual(info.libs.lib.length,3);
  test.assertEqual(JSON.stringify(info.libs.lib[0]),JSON.stringify({path:["folder","sub-folder"],name:"sub-sub-lib.js"}));
  test.assertEqual(JSON.stringify(info.libs.lib[1]),JSON.stringify({path:["folder"],name:"sub-lib.js"}));
  test.assertEqual(JSON.stringify(info.libs.lib[2]),JSON.stringify({path:[],name:"lib.js"}));
  info.tests.tests.sort(function (a, b) a.name>b.name);
  test.assertEqual(info.tests.tests.length,3);
  test.assertEqual(JSON.stringify(info.tests.tests[0]),JSON.stringify({path:["folder","sub-folder"],name:"sub-sub-test.js"}));
  test.assertEqual(JSON.stringify(info.tests.tests[1]),JSON.stringify({path:["folder"],name:"sub-test.js"}));
  test.assertEqual(JSON.stringify(info.tests.tests[2]),JSON.stringify({path:[],name:"test.js"}));  
}
