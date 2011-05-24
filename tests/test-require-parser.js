const parser = require("require-parser");

exports.testRequire = function(test) {
  
  function assert(content, list) {
    let requires = parser.scanContent(content);
    test.assertEqual(Object.keys(requires).sort().join(', '), 
                     list.sort().join(', '), content);
  }

  let content = "var foo = require('one');";
  assert(content, ["one"]);
  
  content = "var foo = require(\"one\");";
  assert(content, ["one"]);

  content = "var foo=require(  'one' )  ;  ";
  assert(content, ["one"]);

  content = "var foo = require('o'+'ne'); // tricky, denied";
  assert(content, []);

  content = "require('one').immediately.do().stuff();";
  assert(content, ["one"]);

  // these forms are commented out, and thus ignored

  content = "// var foo = require('one');";
  assert(content, []);

  content = "/* var foo = require('one');";
  assert(content, []);

  content = " * var foo = require('one');";
  assert(content, []);

  content = " ' var foo = require('one');";
  assert(content, []);

  content = " \" var foo = require('one');";
  assert(content, []);

  // multiple requires

  content = "const foo = require('one');\n" + 
            "const foo = require('two');";
  assert(content, ["one", "two"]);

  content = "const foo = require('one'); const foo = require('two');";
  assert(content, ["one", "two"]);

  // define calls

  content = "define('one', ['two', 'numbers/three'], function(t, th) {});";
  assert(content, ["two", "numbers/three"])

  content = "define(\n" +
            "['odd',\n" +
            "\"numbers/four\"], function() {});";
  assert(content, ["odd", "numbers/four"]);
  
  content = "define(function(require, exports, module) {\n" +
            "var a = require(\"some/module/a\"),\n" +
            "    b = require('b/v1');\n" +
            "exports.a = a;\n" +
            "//This is a fakeout: require('bad');\n" +
            "/* And another var bad = require('bad2'); */\n" +
            "require('foo').goFoo();\n"
            "});";
  assert(content, ["some/module/a", "b/v1", "foo"]);
  
  content = "define (\n" +
            "\"foo\",\n" +
            "[\"bar\"], function (bar) {\n" +
            " var me = require(\"me\");\n" +
            "}\n" +
            ")";
  assert(content, ["bar", "me"]);

  content = "define(['se' + 'ven', 'eight', nine], function () {});";
  assert(content, ["eight"]);

  // async require calls

  content = "require(['one'], function(one) {var o = require(\"one\");});";
  assert(content, ["one"]);

  content = "require([  'one' ], function(one) {var t = require(\"two\");});";
  assert(content, ["one", "two"]);

  content = "require ( ['two', 'numbers/three'], function(t, th) {});";
  assert(content, ["two", "numbers/three"]);

  content = "require (\n" +
            "[\"bar\", \"fa\" + 'ke'  ], function (bar) {\n" +
            "var me = require(\"me\");\n" +
            "// require(\"bad\").doBad();\n" +
            "}\n" +
            ")";
  assert(content, ["bar", "me"]);
}
