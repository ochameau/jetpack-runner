const pi = require("packages-inspector");
const self = require("self");
const fs = require("fs");

function getDataFilePath(file) {
  return require("url").toFilename(self.data.url("tests/"+file));
}
function readManifest(packageName) {
  let file = getDataFilePath("test-pi/packages/"+packageName+"/package.json");
  return JSON.parse(fs.readFileSync(file));
}

exports.testGetPackages = function (test) {
  let packages = pi.getPackages(getDataFilePath("test-pi/packages"));
  
  let list = [];
  for(var name in packages) {
    let p = packages[name];
    list.push({name:name,value:p});
    test.assertEqual(p.name,name);
    let json = readManifest(name);
    test.assertEqual(p.description,json.description);
    test.assertEqual(p.lib.length,1);
    test.assertEqual(p.lib[0],"lib");
    test.assertEqual(p.root_dir,getDataFilePath("test-pi/packages/"+name));
  }
  test.assertEqual(list.length,3);
  test.assertEqual(list[0].name,"aardvark");
  test.assertEqual(list[1].name,"api-utils");
  test.assertEqual(list[2].name,"barbeque");
}

exports.testGetExtraInfos = function (test) {
  let packages = pi.getPackages(getDataFilePath("test-pi/packages"));
  let info = pi.getExtraInfo(packages["api-utils"]);
  test.assertEqual(info.libs.lib.length,3);
  test.assertEqual(JSON.stringify(info.libs.lib[0]),JSON.stringify({path:["folder","sub-folder"],name:"sub-sub-lib.js"}));
  test.assertEqual(JSON.stringify(info.libs.lib[1]),JSON.stringify({path:["folder"],name:"sub-lib.js"}));
  test.assertEqual(JSON.stringify(info.libs.lib[2]),JSON.stringify({path:[],name:"lib.js"}));
  test.assertEqual(info.tests.tests.length,3);
  test.assertEqual(JSON.stringify(info.tests.tests[0]),JSON.stringify({path:["folder","sub-folder"],name:"sub-sub-test.js"}));
  test.assertEqual(JSON.stringify(info.tests.tests[1]),JSON.stringify({path:["folder"],name:"sub-test.js"}));
  test.assertEqual(JSON.stringify(info.tests.tests[2]),JSON.stringify({path:[],name:"test.js"}));  
}
