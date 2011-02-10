const mbs = require("moz-bin-search");

exports.testgetBinaries = function (test) {
  let binaries = mbs.findBinaries();
  test.assert(binaries.length>0);
  for(let i=0; i<binaries.length; i++) {
    let info = mbs.getInfo(binaries[i]);
    test.assert(info.name.match(/Firefox|Thunderbird|Iceweasel|Xulrunner/));
    test.assert(info.version.match(/\d+(\.\d+)*/));
  }
  test.assertEqual(binaries[0], mbs.getCurrentProcessBinary());
}

