
let list = document.getElementById("list");

self.on("message", function (msg) {
  
  let item = document.createElement("li");
  item.textContent = msg;
  list.appendChild(item);
  
});

list.addEventListener("click", function (event) {
  if (event.target.tagName != "LI")
    return;
  
  let url = "http://www.google.com/search?q=" + 
    encodeURIComponent(event.target.textContent);
  self.postMessage(url);
  
}, true);
