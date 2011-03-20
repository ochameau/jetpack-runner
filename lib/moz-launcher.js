const { Ci, Cc } = require("chrome");
const process = require("process");
const subprocess = require("subprocess");
const utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"].
        getService(Ci.nsIUTF8ConverterService);

exports.launch = launchMozBinary;
// So it ends up that all this windows specific code is ... useless :o
// The main problem seems to be dump() in remote instance that do not work
// but nsIDomWindow.dump is working correctly, so fix that in remote code!
//  process.env.ComSpec ? launchMozBinaryWin32 : launchMozBinary;

function launchMozBinaryWin32(options) {
  // On window we need to hack around cmd.exe to be able to launch, kill
  // and retrieve stdout of firefox
  
  let subprocessId = "SUBP" + new Date().getTime();
  let stdin = null;
  let pid = null;
  let startData = "";
  let startReadingStdout = false;
  
  let p = subprocess.call({
    command:     process.env.ComSpec, // Launch cmd.exe
    arguments:   ['/K'], // with /K we allow to send comand to this new cmd
    environment: [],
    
    stdin: subprocess.WritablePipe(function() {
      stdin = this;
      // Disable auto command repeat in stdout
      this.write('@ECHO OFF\n');
      // Change title to something unique
      this.write('TITLE '+subprocessId+"\n"); 
      // Retrieve current PID by matching this unique window title :o
      this.write('TASKLIST /FI "WINDOWTITLE eq '+subprocessId+'*" /FO LIST | find "PID:"\n');
    }),
    
    stdout: subprocess.ReadablePipe(function(data) {
      console.log("STDOUT< "+data);
      if (data && data.indexOf("QUIT")==0)
        console.log("RCV QUIT");
      
      if (data && data[0]=='@' && (data.indexOf("@wmic")==0 || data.indexOf("@taskkill")==0)) {
        return;
      }
      // Watch for PID sent by TASKLIST
      if (!pid) {
        // Agregate stdout as lines may be splitted 
        // (tasklist seems to have multiple /FO LIST layout :x)
        startData += data;
        let m = startData.match(/PID:\s+(\d+)/);
        if (m) {
          startData = null;
          pid = m[1];
          // Finally, launch mozilla binary!
          // And don't forget to encapsulate arguments with spaces by quotes
          let args = options.args;
          args.unshift(options.binary);
          for(var i=0; i<args.length; i++) {
            if (args[i].indexOf(' ')==-1)
              continue;
            args[i] = '"' + args[i] + '"';
          }
          stdin.write(args.join(' ')+'\n');
          
          // Dispatch a GO to start reading on STDOUT
          // because after this there is a lot of noises
          stdin.write('echo GO\n');
          
          // Frequently query process list to find if there is still a process
          // executed in this command line
          // If there is no more process, we close the command line with "EXIT"
          // in order to get onFinished event
          function ping() {
            try {
              console.log("ping");
              stdin.write('@wmic process where ParentProcessId="'+pid+'" get Name, ParentProcessId | find /V /I "WMIC" | find /V /I "find" | find "'+pid+'" > nul || (echo QUIT && EXIT)\n');
              require("timer").setTimeout(ping, 1000);
            } catch(e) {}
          }
          require("timer").setTimeout(ping, 2000);
          
        }
        return;
      }
      
      if (!startReadingStdout) {
        if (data.indexOf("GO") == 0)
          startReadingStdout = true;
        return;
      }
      
      data = utf8Converter.convertURISpecToUTF8 (data, "UTF-8");
      /* 
      // The previous line works fine, except that it truncate lines with
      // "complex characters" written by win32 commands
      // But works fines with characters coming from firefox, so ...
      
      // These tests fails, xpcom exceptions:
      utf8Converter.convertStringToUTF8(data, "UTF-8", false);
      
      var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
	                          .createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      data = converter.ConvertToUnicode(data);
      */

      if (options.stdout)
        options.stdout.call(null, data);
    }),
    
    stderr: subprocess.ReadablePipe(function(data) {
      data = utf8Converter.convertURISpecToUTF8 (data, "UTF-8");
      if (options.stderr)
        options.stderr.call(null, data);
    }),
    
    onFinished: subprocess.Terminate(function() {
      console.log("ON FINISH");
      killed = true;
      if (options.quit)
        options.quit.call(null, this.exitCode);
    }),
    
    mergeStderr: false
  });
  
  let killed = false;
  return {
    kill: function () {
      console.log("attempt to kill : "+killed);
      if (killed) 
        return;
      killed = true;
      console.log("kill");
      // Use taskill in order to kill cmd AND its children!!!
      // (when you kill a process on windows, childs are kept alive)
      stdin.write('@taskkill /F /PID '+pid+' /T > nul\n');
      stdin.close();
    }
  };
}

function launchMozBinary(options) {
  // On linux, simply wrap subprocess for the same API
  let p = subprocess.call({
    command:     options.binary,
    arguments:   options.args,
    environment: [],
    stdin: subprocess.WritablePipe(function() {
      this.close();
    }),
    stdout: subprocess.ReadablePipe(function(data) {
      if (options.stdout)
        options.stdout.call(null, data);
    }),
    stderr: subprocess.ReadablePipe(function(data) {
      if (options.stderr)
        options.stderr.call(null, data);
    }),
    onFinished: subprocess.Terminate(function() {
      if (options.quit)
        options.quit.call(null, this.exitCode);
    }),
    mergeStderr: false
  });
  
  return {
    kill: function () {
      p.kill();
    }
  };
}
