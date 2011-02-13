const Request = require('request').Request;

const BASE_URL = "https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/";

exports.getAvailableVersions = function (callback) {
  Request({
    url: BASE_URL+"?C=M;O=A",
    onComplete: function (response) {
      let m = response.text.match(/>(addon-sdk-[\.\w]+\.zip)<\/a><\/td><td align="right">(\d+-\w+-\d+)/g);
      if (!m) //
        return callback("Unable to match versions");
      let list = [];
      for(var i=1; i<m.length; i++) {
        let file = m[i].match(/addon-sdk-[\.\w]+\.zip/)[0];
        let date = m[i].match(/\d+-\w+-\d+/)[0].replace(/-/g,"/");
        list.push({
          file: file,
          date: new Date(date),
          url: BASE_URL+file,
          version: file.match(/addon-sdk-([\.\w]+)\.zip/)[1]
        });
      }
      callback(null, list);
    }
  }).get();
}
