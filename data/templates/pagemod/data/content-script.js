
let form = document.getElementById("tsf");

form.addEventListener("submit", function () {
  
  self.postMessage(form.q.value);
  
}, false);

let m = document.location.search.match(/q=([^&#]+)/);
if (m && m[1]) {
  self.postMessage(decodeURIComponent(m[1]));
}
