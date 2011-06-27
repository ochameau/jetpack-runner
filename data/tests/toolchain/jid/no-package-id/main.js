let jid = require("self").id;
console.log(jid.match(/jid0-\d+@jetpack/) ? "Test OK" : "Test fail, jid=" + jid);
