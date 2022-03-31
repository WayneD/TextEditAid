var last_sel = null, textarea_has_focus = false, key_bind = {}, counter = 0;
var active_reqs = Array();

// Add capturing focus/blur listeners to the body so we can respond to all
// textarea-focus-related events, even if the textarea gets created by JS.
document.body.addEventListener('focus', got_focus, true);
document.body.addEventListener('blur', got_blur, true);

function got_focus(e)
{
  if (e.target.type == 'textarea') {
    last_sel = e.target;
    textarea_has_focus = true;
    chrome.extension.sendRequest({msg: 'showIcon'}, function(response) {
      key_bind = response;
    });
  }
}

function got_blur(e)
{
  if (e.target.type == 'textarea') {
    textarea_has_focus = false;
    chrome.extension.sendRequest({msg: 'hideIcon'});
  }
}

// Handle requests to get/set a textarea's value.
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  //console.log('request: ' + JSON.stringify(request));
  if (!request.textaid)
    return;
  if (request.textaid == 'get') {
    // last_sel will point to the object that caused the icon to appear.
    if (last_sel === null)
      return; // impossible...
    var req = ++counter;
    active_reqs[req] = 1;
    if (!last_sel.id) // Each textarea must have an id.
      last_sel.id = '_textaid_' + req + '_';
    sendResponse({tab_id: request.tab_id, id: last_sel.id, req: req, url: location.href, text: last_sel.value});
  } else {
    if (!active_reqs[request.req]) {
      //console.log('Ignoring duplicate set request (' + request.req + ')');
      return;
    }
    delete active_reqs[request.req];
    var ta = document.getElementById(request.id);
    if (ta) {
      ta.value = request.text;
    } else {
      alert('Unable to save changes for textarea ' + request.id);
    }
  }
});

// Check for user-configured key-binding to trigger editing.
document.addEventListener('keyup', function(e) {
  if (textarea_has_focus && key_bind.keycode != 0
   && e.keyCode == key_bind.keycode
   && e.shiftKey == key_bind.shift
   && e.ctrlKey == key_bind.ctrl
   && e.altKey == key_bind.alt) {
    var req = ++counter;
    active_reqs[req] = 1;
    if (!last_sel.id) // Each textarea must have an id.
      last_sel.id = '_textaid_' + req + '_';
    chrome.extension.sendRequest({msg: 'edit', id: last_sel.id, req: req, url: location.href, text: last_sel.value});
  }
}, false);
