const mbs = require("moz-bin-search");

exports.testgetBinaries = function (test) {
  let binaries = mbs.findBinaries();
  test.assert(binaries.length>0);
  for(let i=0; i<binaries.length; i++) {
    let info = null;
    try {
      info = mbs.getInfo(binaries[i]);
    } catch(e) {
      // We fail on linux on some old versions with no application.ini
      continue;
    }
    test.assert(info.name.match(/Firefox|Thunderbird|Iceweasel|Xulrunner/));
    test.assert(info.version.match(/\d+(\.\d+)*/));
  }
  let current = mbs.getCurrentProcessBinary();
  // On linux we may not have current process binary dur to process.argv limitation.
  if (current)
    test.assertEqual(binaries[0], current);
  
  test.assert(mbs.getBestBinary(), "Got at least one 'best' binary");
}

