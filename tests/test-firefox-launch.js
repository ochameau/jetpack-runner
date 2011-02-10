const self = require("self");
const fs = require("fs");
const path = require("path");

exports.testLaunchFirefox = function(test) {
  test.waitUntilDone(10000);
  
  let command = require("moz-bin-search").getCurrentProcessBinary();
  
  let profile = path.join(require("url").toFilename(self.data.url()),
    "..","workdir","profile-launch-test");
  
  try {
    fs.mkdir(profile);
  } catch(e) {}
  
  // Override some prefs by using user.js in profile directory
  let userpref = path.join(profile, "user.js");
  fs.writeFileSync(userpref, 
    'pref("browser.shell.checkDefaultBrowser", false);\n' +
    'pref("browser.dom.window.dump.enabled", true);');
  
  // Open firefox with a new tab that execute dump('dumpok')
  // So we retrieve this message in stdout and confirm that everything works!
  let p = require("moz-launcher").launch({
    binary: require("moz-bin-search").getCurrentProcessBinary(),
    args: ["-profile",profile,"-no-remote","javascript:dump('dumpok')"],
    stdout: function (data) {
      if (data == "dumpok") {
        test.pass("Got dumpok in stdout");
        p.kill();
      }
    },
    stderr: function (data) {
      
    },
    quit: function () {
      test.pass("Binary successfully launched and killed");
      require("rm-rec").rm(profile, function(err) {
        test.pass("Profile cleaned");
        test.done();
      });
    }
  });
  
}
