const pageMod = require("page-mod");
const widgets = require("widget");
const panels = require("panel");
const self = require("self");
const tabs = require("tabs");

exports.main = function main(options, callbacks) {
  
  let requests = 1;
  
  let widget = widgets.Widget({
    id: "google-queries",
    label: "Google previous queries",
    content: "0",
    panel: panels.Panel({
      contentURL: self.data.url("panel.html"),
      contentScriptFile: self.data.url("panel.js"),
      contentScriptWhen: "ready",
      onMessage: function (msg) {
        tabs.open(msg);
        this.hide();
      }
    })
  });
  
  pageMod.PageMod({
    include: "http://www.google.*",
    contentScriptFile: self.data.url("content-script.js"),
    contentScriptWhen: "ready",
    onAttach: function (worker) {
      worker.on("message", function (msg) {
        widget.content = "" + requests++;
        widget.panel.postMessage(msg);
      });
    }
  });
  
}
