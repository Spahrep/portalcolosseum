/**
 * Device town URL. Classic blocking script (no import/export) so game.html
 * can call window.getTownUrl() before the body parses. An ES module is
 * deferred and would flash the desktop town; a late redirect can also drop
 * the PKCE query string game.html preserves.
 *
 * Do not copy the UA test. Login and game.html both call window.getTownUrl.
 */
function getTownUrl() {
  var ua = navigator.userAgent;
  var isPhone = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  var isSmall = window.innerWidth < 768;
  return (isPhone || isSmall) ? '/mobile' : '/game';
}

window.getTownUrl = getTownUrl;
