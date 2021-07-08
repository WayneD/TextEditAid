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

// Save options to localStorage.
function save_options()
{
  localStorage['base_url'] = document.getElementById('url').value;

  var el = document.getElementById('keycode');
  localStorage['keycode'] = el.children[el.selectedIndex].value;

  for (var j in chkBoxes) {
    var chk = chkBoxes[j];
    localStorage[chk] = document.getElementById(chk).checked ? 1 : 0;
  }

  for (var j in extraValues) {
    var name = extraValues[j];
    localStorage[name] = document.getElementById(name).value;
  }

  // Update status to let user know options were saved.
  var status = document.getElementById('status');
  status.innerHTML = '<span class="note">Options Saved.</span>';
  setTimeout(function() { status.innerHTML = '&nbsp;' }, 3000);
}

function load_options()
{
  var url = localStorage['base_url'];
  if (!url)
    url = '';

  for (var j in chkBoxes) {
    var chk = chkBoxes[j];
    var val = localStorage[chk];
    document.getElementById(chk).checked = val && val == 1 ? 1 : 0;
  }

  var keycode = localStorage['keycode'];
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
    var val = localStorage[name];
    if (!val)
      val = '';
    el = document.getElementById(name);
    el.value = val;
  }

  el = document.getElementById('url');
  el.value = url;
  el.focus();

  check_url();
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
