
var links = document.getElementsByTagName("link");

for(var i = 0; i < links.length; i++) {
  var link = links[i];
  if (link.getAttribute("rel") == "stylesheet" 
    || link.getAttribute("type") == "text/css") {
    link.parentNode.removeChild(link);
  }
}


var styles = document.getElementsByTagName("style");

for(var i = 0; i < styles.length; i++) {
  var item = styles[i];
  item.parentNode.removeChild(item);
}
