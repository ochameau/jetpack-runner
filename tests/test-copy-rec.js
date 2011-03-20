const copy = require("copy-rec");
const self = require("self");
const fs = require("fs");
const path = require("path");

let source = require("url").toFilename(self.data.url("tests/test-copy"));

try {
  fs.mkdirSync(source);

  let file1 = path.join(source, "file1");
  fs.writeFileSync(file1, "file1");

  let dir1 = path.join(source, "dir1");
  fs.mkdirSync(dir1);

  let file2 = path.join(dir1, "file2");
  fs.writeFileSync(file2, "file2");

  let dir2 = path.join(dir1, "dir2");
  fs.mkdirSync(dir2);

  let file3 = path.join(dir2, "file3");
  fs.writeFileSync(file3, "file3");
} catch(e) {
  console.log("Error creating test files tree");
}

exports.testCopy = function(test) {
  test.waitUntilDone();
  
  let destination = require("url").toFilename(self.data.url("tests/test-copy-target"));
  copy.copy(source, destination, function (err) {
    if (err)
      return test.fail(err);
    
    test.pass("Files copied successfully");
    
    require("rm-rec").rm(destination, function (err) {
      require("rm-rec").rm(source, function (err) {
        test.done();
      });
    });
    
  });
  
}
