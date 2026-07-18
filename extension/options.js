var chkBoxes = new Array('shift', 'strip', 'ctrl', 'alt');
var extraValues = new Array('username', 'password');

function close_options()
{
  window.close();
}

function save_options_and_close()
{
  save_options();
  close_options();
}

// Save options to chrome.storage.local instead of localStorage.
function save_options()
{
  var data = {};
  data['base_url'] = document.getElementById('url').value;

  var el = document.getElementById('keycode');
  data['keycode'] = el.children[el.selectedIndex].value;

  for (var j in chkBoxes) {
    var chk = chkBoxes[j];
    data[chk] = document.getElementById(chk).checked ? 1 : 0;
  }

  for (var j in extraValues) {
    var name = extraValues[j];
    data[name] = document.getElementById(name).value;
  }

  chrome.storage.local.set(data, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.innerHTML = '<span class="note">Options Saved.</span>';
    setTimeout(function() { status.innerHTML = '&nbsp;' }, 3000);
  });
}

function load_options()
{
  chrome.storage.local.get(null, function(data) {
    var url = data.base_url || '';

    for (var j in chkBoxes) {
      var chk = chkBoxes[j];
      var val = data[chk];
      document.getElementById(chk).checked = val && val == 1 ? 1 : 0;
    }

    var keycode = data.keycode;
    if (keycode == null)
      keycode = 0;
    var el = document.getElementById('keycode');
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].value == keycode) {
        el.children[i].selected = 1;
        break;
      }
    }

    for (var j in extraValues) {
      var name = extraValues[j];
      var val = data[name] || '';
      el = document.getElementById(name);
      el.value = val;
    }

    el = document.getElementById('url');
    el.value = url;
    el.focus();

    check_url();
  });
}

function check_url()
{
  var url = document.getElementById('url').value;
  var status = document.getElementById('status');
  if (url == '')
    status.innerHTML = '<span class="note">You must set an URL before filtering can occur</span>';
  else
    status.innerHTML = '&nbsp;';
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('url').addEventListener('change', check_url);
  document.querySelector('button.ok').addEventListener('click', save_options_and_close);
  document.querySelector('button.cancel').addEventListener('click', close_options);
  document.querySelector('button.apply').addEventListener('click', save_options);
  load_options();
});
