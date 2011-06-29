const fs = require("fs");

const COMMENT_PREFIXES = ["//", "/*", "*", "\'", "\"", "dump("];

// (?<!['"]) -> [^"']*
const REQUIRE_RE = /(^|[^'"])require\s*\(\s*['"]([^'"]+?)['"]\s*\)/;

// detect the define idiom of the form:
//   DEFINE("module name", ["dep1", "dep2", "dep3"], function() {}) 
// by capturing the contents of the list in a group.
const DEF_RE = /(require|define)\s*\(\s*(['"][^'"]+['"]\s*,)?\s*\[([^\]]+)\]/g;
// Out of the async dependencies, do not allow quotes in them.
const DEF_RE_ALLOWED = /^['"][^'"]+['"]$/;

const STRIP_RE = /(^\s+)|(\s+$)/g;

exports.scanFile = function scanFile(filePath) {
  return exports.scanContent(fs.readFileSync(filePath));
}

// JS Implementation of 'manifest.py:scan_requirements_with_grep':
exports.scanContent = function scanContent(content) {
  let requires = {};
  
  let lines = content.split("\n");
  for each (let line in lines) {
    for each (let clause in line.split(";")) {
      clause = clause.replace(STRIP_RE, "");
      isComment = false;
      for each (let commentPrefix in COMMENT_PREFIXES) {
        if (clause.indexOf(commentPrefix) == 0) {
          isComment = true;
          break;
        }
      }
      if (isComment)
        continue;
      let mo = clause.match(REQUIRE_RE);
      if (mo) {
        modName = mo[2];
        requires[modName] = {};
      }
    }
  }

  let mo;
  while ((mo = DEF_RE.exec(content)) != null) {
    // this should net us a list of string literals separated by commas
    for each (let strbit in mo[3].split(',')) {
      strbit = strbit.replace(STRIP_RE, "");
      // There could be a trailing comma netting us just whitespace, so
      // filter that out. Make sure that only string values with
      // quotes around them are allowed, and no quotes are inside
      // the quoted value.
      if (strbit && strbit.match(DEF_RE_ALLOWED)) {
        let modname = strbit.substr(1, strbit.length-2);
        if (modname != "exports")
          requires[modname] = {};
      }
    }
  }
  
  return requires;
}

