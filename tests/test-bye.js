
exports.testTransitions = function(test) {

  var notifications = require("notifications");
  notifications.notify({
    title: "Bye",
    text: "Jet inspector test",
    data: "did gyre and gimble in the wabe",
    onClick: function (data) {
      console.log(data);
      // console.log(this.data) would produce the
      // same result in this case.
    }
  });
  test.waitUntilDone(10000);
return;
  var tabs = require("tabs");

  // Open a new tab on active window and make tab active.
  tabs.open("http://www.mozilla.com");

  test.waitUntilDone(10000);
}

