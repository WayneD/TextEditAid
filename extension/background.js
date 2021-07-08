if (!localStorage['keycode']) {
  localStorage['keycode'] = localStorage['shift'] = localStorage['ctrl'] = localStorage['alt'] = 0;
}

chrome.pageAction.onClicked.addListener(function(tab) {
  chrome.tabs.sendRequest(tab.id, {textaid: 'get', tab_id: tab.id}, do_filter);
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  var response = {};
  if (request.msg == 'showIcon') {
    response = {
      keycode: localStorage['keycode'],
      shift: localStorage['shift'] == 1,
      ctrl: localStorage['ctrl'] == 1,
      alt: localStorage['alt'] == 1
    };
    chrome.pageAction.show(sender.tab.id);
    chrome.pageAction.setTitle({tabId: sender.tab.id, title: "Edit/filter the current textarea"});
  } else if (request.msg == 'hideIcon') {
    chrome.pageAction.hide(sender.tab.id);
    chrome.pageAction.setTitle({tabId: sender.tab.id, title: ""});
  } else if (request.msg == 'edit') {
    request.tab_id = sender.tab.id;
    do_filter(request)
  } else
    console.log('Unrecognized request.msg: ' + request.msg);
  sendResponse(response);
});

function do_filter(request)
{
  var url = localStorage['base_url'];
  if (!url) {
    chrome.tabs.create({url: "options.html"});
    return;
  }
  url += '?id=' + escape(request.id) + '&url=' + escape(request.url);

  var username = localStorage['username'];
  if (!username)
    username = '';
  var password = localStorage['password'];
  if (!password)
    password = '';

  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.onreadystatechange = function() {
    //console.log('xhr: ' + JSON.stringify(xhr));
    if (xhr.readyState != 4)
      return;
    if (xhr.status != 200) {
      var msg = 'Failed to filter using:\n' + url + '\nStatus: ' + xhr.status;
      if (xhr.status == 0)
        msg += ' (unable to connect)';
      else
        msg += ' ' + xhr.statusText;
      alert(msg);
      return;
    }
    var strip = localStorage['strip'];
    regex = strip && strip == 1 ? new RegExp('(\r?\n)+$') : new RegExp('$');
    chrome.tabs.sendRequest(request.tab_id, {textaid: 'set', id: request.id, req: request.req, text: xhr.responseText.replace(regex, '')});
  };

  xhr.setRequestHeader('Content-Type', 'text/plain');
  if (username != '' || password != '')
    xhr.setRequestHeader('Authorization', 'Basic ' + base64encode(username+':'+password));
  xhr.send(request.text);
}

function base64encode(str)
{
  var ltrs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  for (var i = 0; i < str.length; i += 3) {
    var ch1 = str.charCodeAt(i);
    var ch2 = str.charCodeAt(i+1);
    var ch3 = str.charCodeAt(i+2);

    var l1 = ltrs.charAt(ch1 >> 2);
    var l2 = ltrs.charAt(((ch1 & 0x03) << 4) | (ch2 >> 4));
    var l3 = ltrs.charAt(((ch2 & 0x0F) << 2) | (ch3 >> 6));
    var l4 = ltrs.charAt(ch3 & 0x3F);

    if (isNaN(ch2))
      l3 = l4 = '=';
    else if (isNaN(ch3))
      l4 = '=';

    out += l1 + l2 + l3 + l4;
  }

  return out;
}
