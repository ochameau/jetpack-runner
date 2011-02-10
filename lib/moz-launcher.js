const process = require("process");
const subprocess = require("subprocess");

exports.launch = 
  process.env.ComSpec?launchMozBinaryWin32:launchMozBinary;

function launchMozBinaryWin32(options) {
  // On window we need to hack around cmd.exe to be able to launch, kill
  // and retrieve stdout of firefox
  
  let subprocessId = "SUBP"+new Date().getTime();
  let stdin = null;
  let pid = null;
  let startData = "";
  let p = subprocess.call({
    command:     process.env.ComSpec, // Launch cmd.exe
    arguments:   ['/K'], // with /K that allow to send comand to this new cmd
    environment: [],
    
    stdin: subprocess.WritablePipe(function() {
      stdin = this;
      // Disable auto command repeat in stdout
      this.write('@ECHO OFF\n');
      // Change title to something unique
      this.write('TITLE '+subprocessId+"\n"); 
      // Retrieve current PID by matching this unique window title :o
      this.write('TASKLIST /FI "WINDOWTITLE eq '+subprocessId+'*" /FO LIST\n');
    }),
    
    stdout: subprocess.ReadablePipe(function(data) {
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
        }
        return;
      }
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
      // Use taskill in order to kill cmd AND its children!!!
      // (when you kill a process on windows, childs are kept alive)
      stdin.write('@taskkill /F /FI "PID eq '+pid+'" /T\n');
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
