(function () {
  var CURRENT_VERSION = '17';
  var latestVersion = '';
  var checkInProgress = false;
  var safeStates = ['title', 'profiles', 'levels', 'armory', 'settings', 'howto', 'highscores'];

  function safeToReload() {
    return safeStates.indexOf(window.state) >= 0;
  }

  function reloadToVersion(version) {
    var nextUrl = new URL(window.location.href);
    if (nextUrl.searchParams.get('v') === version) {
      showUpdateNotice();
      return;
    }
    nextUrl.searchParams.set('v', version);
    window.location.replace(nextUrl.toString());
  }

  function showUpdateNotice() {
    if (document.getElementById('gameUpdateNotice')) return;
    var notice = document.createElement('div');
    notice.id = 'gameUpdateNotice';
    notice.className = 'gameUpdateNotice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'A game update is ready. It will load when you return to the title screen.';
    document.body.appendChild(notice);
  }

  function checkVersion() {
    if (checkInProgress || document.hidden) return;
    checkInProgress = true;
    fetch('version.json?check=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('version check failed');
        return response.json();
      })
      .then(function (info) {
        var remote = String(info && info.version || '');
        if (!remote || Number(remote) <= Number(CURRENT_VERSION)) return;
        latestVersion = remote;
        if (safeToReload()) reloadToVersion(remote);
        else showUpdateNotice();
      })
      .catch(function () {})
      .then(function () { checkInProgress = false; });
  }

  window.setInterval(function () {
    if (latestVersion && safeToReload()) reloadToVersion(latestVersion);
    else checkVersion();
  }, 30000);
  document.addEventListener('visibilitychange', checkVersion);
  checkVersion();
})();

