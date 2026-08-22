/* 共享：移动端导航 + 管理员 token/API 工具 */
(function () {
  "use strict";

  /* 移动端导航 */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* API 地址：同域 */
  var apiBase = "";
  if (typeof window !== "undefined") {
    window.__adminAPI = apiBase;
  }

  function getQueryToken() {
    var m = location.search.match(/[?&]token=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getStoredToken() {
    try { return localStorage.getItem("adminToken"); } catch (e) { return null; }
  }

  function setStoredToken(t) {
    try { if (t) localStorage.setItem("adminToken", t); else localStorage.removeItem("adminToken"); } catch (e) {}
  }

  function getAdminToken() {
    return getQueryToken() || getStoredToken();
  }

  if (typeof window !== "undefined") {
    window.__adminToken = getAdminToken;
    window.__adminSetToken = setStoredToken;
  }
})();
