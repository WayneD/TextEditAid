// Initialize fallback defaults on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['keycode'], (res) => {
    if (res.keycode === undefined) {
      chrome.storage.local.set({ keycode: 0, shift: 0, ctrl: 0, alt: 0 });
    }
  });
});

chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.sendMessage(tab.id, {textaid: 'get', tab_id: tab.id}, function(response) {
    if (response) {
      do_filter(response);
    }
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.msg == 'showIcon') {
    chrome.storage.local.get(['keycode', 'shift', 'ctrl', 'alt'], function(data) {
      var response = {
        keycode: data.keycode || 0,
        shift: data.shift == 1,
        ctrl: data.ctrl == 1,
        alt: data.alt == 1
      };
      chrome.action.enable(sender.tab.id);
      chrome.action.setTitle({tabId: sender.tab.id, title: "Edit/filter the current textarea"});
      sendResponse(response);
    });
    return true; // Keeps the message channel open for the asynchronous response
  } else if (request.msg == 'hideIcon') {
    chrome.action.disable(sender.tab.id);
    chrome.action.setTitle({tabId: sender.tab.id, title: ""});
  } else if (request.msg == 'edit') {
    request.tab_id = sender.tab.id;
    do_filter(request);
  } else {
    console.log('Unrecognized request.msg: ' + request.msg);
  }
});

function do_filter(request)
{
  chrome.storage.local.get(['base_url', 'username', 'password', 'strip'], function(data) {
    var url = data.base_url;
    if (!url) {
      chrome.tabs.create({url: "options.html"});
      return;
    }
    url += '?id=' + encodeURIComponent(request.id) + '&url=' + encodeURIComponent(request.url);

    var username = data.username || '';
    var password = data.password || '';

    var headers = { 'Content-Type': 'text/plain' };
    if (username !== '' || password !== '') {
      headers['Authorization'] = 'Basic ' + base64encode(username + ':' + password);
    }

    fetch(url, {
      method: 'POST',
      headers: headers,
      body: request.text
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Status: ' + response.status + ' ' + response.statusText);
      }
      return response.text();
    })
    .then(responseText => {
      var strip = data.strip;
      var regex = strip && strip == 1 ? new RegExp('(\r?\n)+$') : new RegExp('$');
      chrome.tabs.sendMessage(request.tab_id, {
        textaid: 'set',
        id: request.id,
        req: request.req,
        text: responseText.replace(regex, '')
      });
    })
    .catch(error => {
      console.error(error);
      // alert() is unavailable in background Workers, dispatch the error to the frontend content script instead
      chrome.tabs.sendMessage(request.tab_id, {
        textaid: 'error',
        message: 'Failed to filter using:\n' + url + '\n' + error.message
      });
    });
  });
}

function base64encode(str)
{
  return btoa(unescape(encodeURIComponent(str)));
}
