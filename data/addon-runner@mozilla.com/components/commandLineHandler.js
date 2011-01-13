const nsIAppShellService    = Components.interfaces.nsIAppShellService;
const nsISupports           = Components.interfaces.nsISupports;
const nsICategoryManager    = Components.interfaces.nsICategoryManager;
const nsIComponentRegistrar = Components.interfaces.nsIComponentRegistrar;
const nsICommandLine        = Components.interfaces.nsICommandLine;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIModule             = Components.interfaces.nsIModule;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;


const appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
    getService(Components.interfaces.nsIAppStartup);


// category names are sorted alphabetically. Typical command-line handlers use a
// category that begins with the letter "m".
const clh_category = "a-jetpack-clh";

const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type="+clh_category;

const clh_CID = Components.ID("{2991c315-b871-42cd-b33f-bfee4fcbf301}");

/**
 * Utility functions
 */
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
function myComponent() {
}
myComponent.prototype = {
  // this must match whatever is in chrome.manifest!
  classID: Components.ID("{2991c315-b871-42cd-b33f-bfee4fcbf301}"),

  /* nsISupports */
  QueryInterface : function clh_QI(iid)
  {
    if (iid.equals(nsICommandLineHandler) ||
        iid.equals(nsIFactory) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
  
  wrappedJSObject : this,
  lastCommand : null,
  
  /* nsICommandLineHandler */
  
  handle : function clh_handle(cmdLine)
  {
    dump(cmdLine.length+" -- "+cmdLine.handleFlag("jsconsole",false)+"\n");
    
    this.wrappedJSObject = this;
    this.lastCommand = cmdLine;
    
    let installPath = Components.classes["@mozilla.org/file/directory_service;1"]
                    .getService(Components.interfaces.nsIProperties)
                    .get("resource:app", Components.interfaces.nsIFile);
    dump("installPath : "+installPath.path+"\n");
    // Hack to start jetpack on application startup
    // $installPath need to be set!
    Components.utils.reportError("Instanciate bootstart");
    let bootstrap = {};
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
               .getService(Components.interfaces.mozIJSSubScriptLoader);
    let bootstrapFile = installPath.clone();
    bootstrapFile.append("bootstrap.js");
    loader.loadSubScript("file://"+bootstrapFile.path, bootstrap);
    
    Components.utils.reportError("Launch bootstart");
    bootstrap.startup({installPath:installPath},"startup");
    Components.utils.reportError("Bootstrap launched!");
    
  },

  helpInfo : "",


  /* nsIFactory */

  createInstance : function clh_CI(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory : function clh_lock(lock)
  {
    /* no-op */
  }
};

/**
 * The XPCOM glue that implements nsIModule
 */
const myAppHandlerModule = {
  /* nsISupports */
  QueryInterface : function mod_QI(iid)
  {
    if (iid.equals(nsIModule) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsIModule */
  getClassObject : function mod_gch(compMgr, cid, iid)
  {
    if (cid.equals(clh_CID))
      return myComponent.prototype.QueryInterface(iid);

    throw Components.results.NS_ERROR_NOT_REGISTERED;
  },
  
  registerSelf : function mod_regself(compMgr, fileSpec, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.registerFactoryLocation(clh_CID,
                                    "myAppHandler",
                                    clh_contractID,
                                    fileSpec,
                                    location,
                                    type);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.addCategoryEntry("command-line-handler",
                            clh_category,
                            clh_contractID, true, true);
  },

  unregisterSelf : function mod_unreg(compMgr, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(clh_CID, location);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.deleteCategoryEntry("command-line-handler", clh_category);
  },

  canUnload : function (compMgr)
  {
    return true;
  }
};

try {
  Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([myComponent]);
} catch(e) {
  /* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
   * this component provides
   */
  function NSGetModule(comMgr, fileSpec)
  {
    return myAppHandlerModule;
  }
}
