var prefs = require("preferences-service");
var path = require("path");

var Options = {
  _inited: false
};

Options.init = function OptionsInit() {
  $("#general-options-button").click(Options.toggle);
  // Init default prefs
  if (!prefs.has("run-within")) {
    prefs.set("run-within", true);
  }
}

Options.toggle = function OptionsToggle() {
  var block = $("#options");
  block.toggle();
  $("#title").toggle();
  if (block.is(':visible')) {
    Options.setup();
  }
}

Options.setup = function OptionsSetup() {
  if (Options._inited)
    return;
  Options._inited = true;
  
  var input = $("#run-as-app");
  input.attr("checked", !!prefs.get("run-as-app"));
  input.change(function () {
    prefs.set("run-as-app", $(this).is(":checked"));
  });
  
  var runWithinInput = $('#run-within input');
  function updateWithin(doRunWithin) {
    runWithinInput.attr("checked", doRunWithin);
    if (doRunWithin) {
      $("#run-another").hide();
    } else {
      Options.loadBinariesList();
      $("#run-another").show();
    }
  }
  runWithinInput.change(function () {
    var newValue = runWithinInput.is(":checked");
    prefs.set("run-within", newValue);
    updateWithin(newValue);
  });
  $('#run-within span').click(function (event) {
    var newValue = !runWithinInput.is(":checked");
    runWithinInput.attr("checked", newValue);
    prefs.set("run-within", newValue);
    updateWithin(newValue);
  });
  
  updateWithin(prefs.get("run-within"));
}

Options.loadBinariesList = function OptionsLoadBinariesList() {
  var selectNode = $("#run-another select");
  
  // Check if binaries list is already built
  if (selectNode.children().length>0)
    return;
  
  var mbs = require("moz-bin-search");
  var bins = mbs.findBinaries();
  var binaryPath = prefs.get("binary-path");
  
  // Select first binary as default one
  if (!binaryPath || !path.existsSync(binaryPath)) {
    binaryPath = bins[0];
    prefs.set("binary-path",binaryPath);
  }
  if (bins.indexOf(binaryPath)==-1)
    bins.unshift(binaryPath);
  
  // Build the list
  for(var i=0; i<bins.length; i++) {
    var bin = bins[i];
    try {
      // getInfo can throw easily on linux
      var info = mbs.getInfo(bin);
      selectNode.append('<option value="'+i+'"'+(bin==binaryPath?' selected="true"':'')+'>'+info.name+' '+info.version+' - '+bin+'</option>');
    } catch(e) {}
  }
  
  // Watch for change
  selectNode.change(function () {
    var i = parseInt($(this).val());
    prefs.set("binary-path", bins[i]);
  });
}
