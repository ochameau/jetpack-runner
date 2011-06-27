let jid = require("self").id;
console.log(jid == "package-id@jetpack" ? "Test OK" : "Test fail, jid=" + jid);
