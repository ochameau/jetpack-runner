const online = require("online-sdk");

exports.testOnlineVersions = function(test) {
  test.waitUntilDone();
  online.getAvailableVersions(function (err, list) {
    if (err)
      return test.fail(err);
    test.assert(list.length>0, "got some versions");
    let previousDate = new Date(0);
    for(var i=0; i<list.length; i++) {
      let v = list[i];
      test.assertNotEqual(v.file.indexOf(v.version), -1, "file contains version");
      test.assertNotEqual(v.url.indexOf(v.file), -1, "url contains file");
      test.assert(v.date >= previousDate,"list is sorted by date ("+v.date+" > "+previousDate+")");
      previousDate = v.date;
    }
    test.done();
  });
}
