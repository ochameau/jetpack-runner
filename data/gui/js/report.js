
var Report = {
  dom: null
};

Report.init = function ReportInit() {
  Report.dom = $("#console-report");
}

Report.run = function ReportRun(title) {
  Report.dom.empty();
  $("#report-title").text(title);
  $("#run-state-info").text("Running");
  $("#run-kill").addClass("on");
  $("#report-title").attr("test-result",null);
}

Report.log = function ReportLog(msg) {
  var type = "";
  var m = null;
  if (msg.match(/^info: executing/))
    type = "step";
  else if (msg.match(/^info: pass/))
    type = "success";
  else if (msg.match(/^error: fail/) || msg.match(/^error: TEST FAILED:/))
    type = "fail";
  else if (m = msg.match(/^(\d+) of (\d+) tests passed./)) {
    type = "resume";
    $("#report-title").attr("test-result", m[1] == m[2] ? "succeeded" : "failed");
  }
  
  if (type)
    msg = '<span class="' + type + '">' + msg + '</span>';
  Report.dom.append(msg);
}

Report.error = function ReportError(msg) {
  msg = '<span class="fail">' + msg + '</span>';
  Report.dom.append(msg);
}

Report.kill = function ReportKill() {
  $("#run-state-info").text("Trying to kill");
}

Report.killed = function ReportKilled() {
  $("#run-kill").removeClass("on");
  $("#run-state-info").text("Terminated");
  Report.dom.append("<hr />");
}
