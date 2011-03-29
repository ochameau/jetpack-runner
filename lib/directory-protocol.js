/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Alexandre Poirot <poirot.alex@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let {Cc, Ci, Cr} = require("chrome");

var xpcom = require("xpcom");
var ios = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService);

var Protocol = exports.Protocol = function Protocol(name, url, principal, index) {
  memory.track(this);

  var self = this;
  var contractID = "@mozilla.org/network/protocol;1?name=" + name;

  try {
    xpcom.getClass(contractID);
    throw new Error("protocol already registered: " + name);
  } catch (e if e.result == Cr.NS_ERROR_FACTORY_NOT_REGISTERED) {}
  
  var base = ios.newURI(url, null, null);
  
  if (!principal) {
    var secman = Cc["@mozilla.org/scriptsecuritymanager;1"]
                 .getService(Ci.nsIScriptSecurityManager);
    principal = secman.getCodebasePrincipal(base);
  } else if (principal == "system") {
    principal = Cc["@mozilla.org/systemprincipal;1"]
                .createInstance(Ci.nsIPrincipal);
  }

  if (!(principal instanceof Ci.nsIPrincipal))
    throw new Error("invalid principal: " + principal);
  
  self.unload = function unload() {
    try {
      handler.unregister();
    } catch (e if /factory already unregistered/.test(e)) {}
    handler = null;
  };

  // http://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/about/nsAboutProtocolHandler.cpp
  function ProtocolHandler() {
    memory.track(this);
  }

  ProtocolHandler.prototype = {
    get scheme() {
      return name;
    },
    get protocolFlags() {
      // For more information on what these flags mean,
      // see caps/src/nsScriptSecurityManager.cpp
      return (Ci.nsIProtocolHandler.URI_NORELATIVE |
              Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE |
              Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD);
    },
    get defaultPort() {
      return -1;
    },
    allowPort: function allowPort() {
      return false;
    },
    newURI: function newURI(spec, charset, baseURI) {
      try {
        var  SimpleURI = Cc["@mozilla.org/network/simple-uri;1"];
        var uri = SimpleURI.createInstance(Ci.nsIURI)
        if (spec.indexOf(name+":") == -1 ) {
          uri.spec = name + ":/" + spec;
        } else {
          uri.spec = spec;
        }
        if (spec == "#" || spec == name+":/#")
          uri.spec = name+":";
        //console.log("newURI "+spec+" -- > "+uri.spec);
        return uri.QueryInterface(Ci.nsIURI);
      } catch(e) {
        console.log("Exception during newURI :\n"+e);
      }
    },
    newChannel: function newChannel(URI) {
      try {
        var resolved = null;
        if ( URI.spec == name + ":" || URI.spec.indexOf(name + ":#") == 0 ) {
          // Example of use of an iframe in order to fix jQuery that expect a valid URL
          // with at least "scheme://host" (ie jquery fails on "scheme:something")
          //resolved = ios.newURI('data:text/html,<iframe src="jetpack://jetinspector.html" style="position: absolute; top:0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; border: 0;" /></body></html>', null, null);
          resolved = ios.newURI(index, null, base);
        } else if (URI.spec.indexOf(name + ':/') != -1) {
          resolved = ios.newURI(URI.path.replace(/^\/+/,""), null, base);
        } else {
          resolved = ios.newURI(index, null, base);
        }
        //console.log("newChannel: "+URI.spec+" --> "+resolved.spec);
        var channel = ios.newChannelFromURI(resolved);
        channel.owner = principal;
        return channel;
      } catch(e) {
        console.log("Exception during newChannel :\n"+e);
      }
      throw Cr.NS_ERROR_FILE_NOT_FOUND;
    },
    QueryInterface: xpcom.utils.generateQI([Ci.nsISupports,
                                            Ci.nsISupportsWeakReference,
                                            Ci.nsIProtocolHandler])
  };

  var handler = xpcom.register({name: "Custom Protocol: " + name,
                                contractID: contractID,
                                create: ProtocolHandler});

  require("unload").ensure(this);
};

exports.register = function register(name, url, principal, index) {
  return new Protocol(name, url, principal, index);
};
