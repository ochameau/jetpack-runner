const self = require("self");
const tabs = require("tabs");
const widgets = require("widget");

exports.main = function main(options, callbacks) {
  
  let widget = widgets.Widget({
    id: "remove-css",
    label: "Remove CSS",
    contentURL: self.data.url("css.jpg"),
    onClick: function () {
      tabs.activeTab.attach({
        contentScriptFile: self.data.url("content-script.js")
      });
    }
  });
  
}
