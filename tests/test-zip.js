const zip = require("zip");
const self = require("self");
const fs = require("fs");

let path = require("url").toFilename(self.data.url("tests/test.zip"));
require("unload").when(function () {
  fs.unlinkSync(path);
});

exports.testWriter = function(test) {
  let zw = new zip.ZipWriter(path);
  let fileToAdd = require("url").toFilename(self.data.url("tests/zip.txt"));
  zw.add("test1.txt", fileToAdd);
  zw.add("sub-dir/test2.txt", fileToAdd);
  zw.add("sub-dir/dir/test3.txt", fileToAdd);
  let dirToAdd = require("url").toFilename(self.data.url("tests/test-harness/package"));
  zw.add("add-dir", dirToAdd);
  zw.close();
  
  //test.assertEqual(fs.statSync(path).size, 1275, "zip file size is the expected one");  
  test.pass("zip created");
}

exports.testReader = function(test) {
  let zr = new zip.ZipReader(path);
  let dir = require("url").toFilename(self.data.url("tests/zip-extract"));
  zr.extractAll(dir);
  zr.close();
  
  test.pass("zip extracted");
}
