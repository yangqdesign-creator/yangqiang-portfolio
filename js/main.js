/* =========================================================
   电商设计作品集 · 交互脚本
   - 网格渲染（来自 data.js）
   - 电商详情 / 活动海报：长图切成「屏」→ 网格切片弹窗 → 点击单屏放大（清晰）
   - 包装 / 直播间 / 展会：直接灯箱
   - 品牌视觉：PDF 封面卡片（查看 / 下载）
   - 移动端菜单 / 导航高亮
   - 灯箱：以原始像素尺寸渲染，缩放=改变真实尺寸，100% 清晰不模糊
   - 管理模式：token 验证后可对每个板块上传 / 删除作品
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.PORTFOLIO || {};
  var IMG_SECTIONS = ["detail", "packaging", "poster", "live"];
  var ADMIN_TOKEN = null;

  /* ---------- 工具 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function basename(p) { return String(p).split("/").pop(); }
  function fileNameTitle(p) {
    var n = basename(p);
    return n.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  }

  /* ---------- 渲染：图片网格板块 ---------- */
  function renderGrids() {
    IMG_SECTIONS.forEach(function (sec) {
      var box = document.getElementById("grid-" + sec);
      if (!box || !DATA[sec]) return;
      DATA[sec].forEach(function (item) {
        var card;
        if (sec === "detail" || sec === "poster") {
          var thumb = item.cover || (item.img || "").replace(/(\.(?:jpg|jpeg|png))$/i, "-thumb$1");
          card = makeImgCard(item, thumb, function () { openSliceModal(item); });
        } else {
          card = makeImgCard(item, item.cover || item.img, function () { openLightbox(DATA[sec], DATA[sec].indexOf(item)); });
        }
        card.dataset.admSection = sec;
        card.dataset.admFile = item.img;
        card.dataset.admTitle = item.title || "";
        box.appendChild(card);
      });
    });

    /* 视频：卡片只用封面图+播放按钮，避免 APP 内置浏览器劫持浮层 */
    var vbox = document.getElementById("grid-video");
    if (vbox && DATA.video) {
      DATA.video.forEach(function (item) {
        var card = document.createElement("div");
        card.className = "video-card";
        card.dataset.admSection = "video";
        card.dataset.admFile = item.src;
        card.dataset.admTitle = item.title || "";
        var cover = item.cover || "";
        var posterHtml = cover
          ? '<img loading="lazy" src="' + cover + '" alt="' + escapeAttr(item.title) + '">'
          : '<div class="video-poster-fallback"><span class="vpf-icon">▶</span><span class="vpf-title">' + escapeHtml(item.title) + '</span></div>';
        card.innerHTML =
          '<div class="video-poster">' + posterHtml + '<div class="video-play-overlay"><span class="video-play-icon">▶</span></div></div>' +
          '<div class="card-title">' + escapeHtml(item.title) + "</div>";
        card.addEventListener("click", function () { openVideoPlayer(item); });
        vbox.appendChild(card);
      });
    }
  }

  /* 视频播放入口：APP/移动端直接调系统播放器，避免被 X5/百度内核劫持 */
  function openVideoPlayer(item) {
    var ua = navigator.userAgent.toLowerCase();
    var isAppBrowser = /micromessenger|baidu|qq|weibo/i.test(ua);
    var isMobile = /android|iphone|ipad|ipod/i.test(ua);
    if (isAppBrowser || isMobile) {
      window.open(item.src, "_blank");
      return;
    }
    openLightbox([item], 0);
  }

  function makeImgCard(item, thumb, onClick) {
    var card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      '<div class="card-media"><img loading="lazy" src="' + thumb +
      '" alt="' + escapeAttr(item.title) + '"></div>' +
      '<div class="card-title">' + escapeHtml(item.title) + "</div>";
    card.addEventListener("click", onClick);
    return card;
  }

  /* ---------- 渲染：品牌视觉（PDF 封面） ---------- */
  function renderBrand() {
    var box = document.getElementById("grid-brand");
    if (!box || !DATA.brand) return;
    DATA.brand.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "brand-card";
      card.dataset.admSection = "brand";
      card.dataset.admFile = item.pdf;
      card.dataset.admTitle = item.title || "";
      var coverHtml = item.cover
        ? '<img loading="lazy" src="' + item.cover + '" alt="' + escapeAttr(item.title) + '" />'
        : '<div class="brand-cover-fallback"><span class="pdf-tag">PDF</span><span class="bcp-title">' + escapeHtml(item.title) + '</span></div>';
      card.innerHTML =
        '<div class="brand-cover' + (item.cover ? '' : ' no-cover') + '" role="button" tabindex="0" aria-label="查看 ' + escapeAttr(item.title) + '">' +
          coverHtml +
        '</div>' +
        '<div class="brand-meta">' +
          '<div class="brand-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="brand-sub">' + escapeHtml(item.size || "") + ' · 点击查看 / 下载</div>' +
          '<div class="brand-actions">' +
            '<button type="button" class="brand-view">查看</button>' +
            '<a class="brand-dl" href="' + item.pdf + '" download="' + escapeAttr(basename(item.pdf)) + '">下载</a>' +
          '</div>' +
        '</div>';
      var cover = card.querySelector(".brand-cover");
      cover.addEventListener("click", function () { openPdfModal(item); });
      cover.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPdfModal(item); }
      });
      card.querySelector(".brand-view").addEventListener("click", function () { openPdfModal(item); });
      box.appendChild(card);
    });
  }

  /* ---------- 渲染：展会视觉（分组画廊） ---------- */
  function renderExhibition() {
    var box = document.getElementById("grid-exhibition");
    if (!box || !DATA.exhibition) return;
    DATA.exhibition.forEach(function (group) {
      var g = document.createElement("div");
      g.className = "ex-group";
      g.dataset.admExname = group.name;
      var head = document.createElement("div");
      head.className = "ex-group-head";
      head.innerHTML =
        '<h3>' + escapeHtml(group.name) + '</h3>' +
        '<span class="ex-en">' + escapeHtml(group.en) + '</span>' +
        '<span class="ex-count">' + group.images.length + ' 张</span>';
      g.appendChild(head);
      var grid = document.createElement("div");
      grid.className = "ex-grid";
      group.images.forEach(function (img, i) {
        var card = makeImgCard(img, img.cover || img.img, function () { openLightbox(group.images, i); });
        card.dataset.admSection = "exhibition";
        card.dataset.admFile = img.img;
        card.dataset.admExname = group.name;
        card.dataset.admTitle = img.title || "";
        grid.appendChild(card);
      });
      g.appendChild(grid);
      box.appendChild(g);
    });
  }

  /* =========================================================
     管理模式：上传 / 删除
     ========================================================= */
  function adminApi(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (ADMIN_TOKEN) opts.headers["X-Admin-Token"] = ADMIN_TOKEN;
    return fetch(path, opts);
  }

  function checkAdminToken() {
    var t = (window.__adminToken && window.__adminToken()) || null;
    if (!t) return;
    adminApi("/api/check_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res.ok) { ADMIN_TOKEN = t; try { localStorage.setItem("adminToken", t); } catch (e) {} enableAdminMode(); }
      else { localStorage.removeItem("adminToken"); }
    }).catch(function () { localStorage.removeItem("adminToken"); });
  }

  function enableAdminMode() {
    document.body.classList.add("admin-mode");
    var badge = document.getElementById("adminBadge");
    if (badge) badge.style.display = "block";
    var logout = document.getElementById("adminLogout");
    if (logout) logout.addEventListener("click", function () { localStorage.removeItem("adminToken"); location.href = "index.html"; });
    injectSectionUploads();
    attachDeleteButtons();
    attachTitleEditing();
  }

  function injectSectionUploads() {
    var sectionAccepts = {
      brand: ".pdf",
      detail: "image/*",
      packaging: "image/*",
      poster: "image/*",
      live: "image/*",
      video: "video/*",
      exhibition: "image/*"
    };
    ["brand", "detail", "packaging", "poster", "live", "video"].forEach(function (sec) {
      var section = document.getElementById(sec);
      if (!section) return;
      var bar = document.createElement("div");
      bar.className = "admin-bar";
      bar.innerHTML = uploadBtnHtml(sec, sectionAccepts[sec], "+ 上传作品");
      section.querySelector(".container").insertBefore(bar, section.querySelector(".container").children[1]);
      bindUploadInput(bar.querySelector('input[type="file"]'));
    });

    // 展会单独处理：需要选择展会
    var exSection = document.getElementById("exhibition");
    if (exSection && DATA.exhibition) {
      var bar = document.createElement("div");
      bar.className = "admin-bar";
      var select = '<select class="admin-ex-select" id="exUploadSelect">' +
        '<option value="__new">+ 新建展会</option>';
      DATA.exhibition.forEach(function (g) {
        select += '<option value="' + escapeAttr(g.name) + '">' + escapeHtml(g.name) + '</option>';
      });
      select += '</select>';
      bar.innerHTML = select +
        '<input type="text" class="admin-ex-new" id="exUploadNewName" placeholder="新展会名称">' +
        '<input type="text" class="admin-ex-new" id="exUploadNewEn" placeholder="英文名称（选填）">' +
        uploadBtnHtml("exhibition", "image/*", "+ 上传到展会");
      exSection.querySelector(".container").insertBefore(bar, exSection.querySelector(".container").children[1]);
      bindUploadInput(bar.querySelector('input[type="file"]'));
      var sel = document.getElementById("exUploadSelect");
      var newName = document.getElementById("exUploadNewName");
      var newEn = document.getElementById("exUploadNewEn");
      function toggle() {
        var isNew = sel.value === "__new";
        newName.style.display = isNew ? "" : "none";
        newEn.style.display = isNew ? "" : "none";
      }
      sel.addEventListener("change", toggle);
      toggle();
    }
  }

  function uploadBtnHtml(section, accept, label) {
    return '<label class="admin-upload-btn"><input type="file" accept="' + escapeAttr(accept) + '" multiple data-section="' + escapeAttr(section) + '"><span>' + escapeHtml(label) + '</span></label>';
  }

  function bindUploadInput(input) {
    if (!input) return;
    input.addEventListener("change", function () {
      if (!input.files || !input.files.length) return;
      var section = input.dataset.section;
      var exName, newExName, newExEn;
      if (section === "exhibition") {
        var sel = document.getElementById("exUploadSelect");
        if (sel && sel.value === "__new") {
          newExName = document.getElementById("exUploadNewName").value.trim();
          newExEn = document.getElementById("exUploadNewEn").value.trim();
          if (!newExName) { alert("请填写新展会名称"); input.value = ""; return; }
        } else {
          exName = sel ? sel.value : "";
          if (!exName) { alert("请选择展会"); input.value = ""; return; }
        }
      }
      var busy = input.parentElement.querySelector(".admin-spinner");
      if (!busy) {
        busy = document.createElement("span");
        busy.className = "admin-spinner";
        input.parentElement.appendChild(busy);
      }
      var fd = new FormData();
      if (ADMIN_TOKEN) fd.append("token", ADMIN_TOKEN);
      fd.append("section", section);
      Array.prototype.forEach.call(input.files, function (f) { fd.append("files", f); });
      if (exName) fd.append("exhibition", exName);
      if (newExName) { fd.append("newExName", newExName); fd.append("newExEn", newExEn || newExName); }

      adminApi("/api/upload", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          input.value = "";
          if (busy) busy.remove();
          if (res.ok) { alert("上传成功：" + (res.added && res.added.length ? res.added.join("、") : "")); location.reload(); }
          else { alert("上传失败：" + (res.error || "未知错误")); }
        })
        .catch(function (e) { input.value = ""; if (busy) busy.remove(); alert("上传失败：" + e.message); });
    });
  }

  function attachDeleteButtons() {
    var targets = document.querySelectorAll(".card, .video-card, .brand-card, .ex-group .card");
    Array.prototype.forEach.call(targets, function (card) {
      if (card.querySelector(".admin-delete")) return;
      var section = card.dataset.admSection;
      var file = card.dataset.admFile;
      var title = card.dataset.admTitle || fileNameTitle(file);
      if (!section || !file) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-delete";
      btn.title = "删除：" + title;
      btn.textContent = "×";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("确定删除「" + title + "」？删除后不可恢复。")) return;
        var body = { token: ADMIN_TOKEN, section: section, file: file };
        if (section === "exhibition") body.exName = card.dataset.admExname;
        adminApi("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (res.ok) location.reload();
          else alert("删除失败：" + (res.error || "未知错误"));
        }).catch(function (e) { alert("删除失败：" + e.message); });
      });
      card.appendChild(btn);
    });
  }

  /* ---------- 标题在线编辑 ---------- */
  function attachTitleEditing() {
    var selectors = [
      ".card > .card-title",
      ".video-card .card-title",
      ".brand-card .brand-title",
      ".ex-group .card .card-title"
    ];
    var targets = document.querySelectorAll(selectors.join(", "));
    Array.prototype.forEach.call(targets, function (el) {
      if (el.dataset.titleEditBound) return;
      el.dataset.titleEditBound = "1";
      var card = el.closest(".card, .video-card, .brand-card");
      if (!card) return;
      el.classList.add("admin-editable-title");
      el.title = "点击编辑名称";
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        el.contentEditable = "true";
        el.focus();
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
      el.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      el.addEventListener("focus", function () {
        el.dataset.originalTitle = el.textContent;
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        else if (e.key === "Escape") {
          e.preventDefault();
          el.textContent = el.dataset.originalTitle || "";
          el.blur();
        }
      });
      el.addEventListener("blur", function () {
        el.contentEditable = "false";
        var newTitle = el.textContent.trim();
        var oldTitle = el.dataset.originalTitle || "";
        if (!newTitle) { el.textContent = oldTitle; return; }
        if (newTitle === oldTitle) return;
        var section = card.dataset.admSection;
        var file = card.dataset.admFile;
        if (!section || !file) { el.textContent = oldTitle; return; }
        var body = { token: ADMIN_TOKEN, section: section, file: file, title: newTitle };
        if (section === "exhibition") body.exName = card.dataset.admExname;
        adminApi("/api/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res.ok) {
            alert("重命名失败：" + (res.error || "未知错误"));
            el.textContent = oldTitle;
          } else {
            card.dataset.admTitle = newTitle;
          }
        }).catch(function (e) {
          alert("重命名失败：" + e.message);
          el.textContent = oldTitle;
        });
      });
    });
  }

  /* =========================================================
     灯箱（清晰放大：图片按原始像素渲染，缩放改变真实尺寸）
     ========================================================= */
  var lb = document.getElementById("lightbox");
  var lbStage = document.getElementById("lbStage");
  var lbImg = document.getElementById("lbImg");
  var lbVideo = document.getElementById("lbVideo");
  var lbTitle = document.getElementById("lbTitle");
  var zoomWrap = document.getElementById("lbZoomWrap");
  var lbZoomControls = document.querySelector(".lb-zoom-controls");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");
  var curItems = null, curIdx = 0;
  var natW = 0, natH = 0, fitScale = 1, curScale = 1, tx = 0, ty = 0;
  var returnToSliceItem = null;

  function applyZoom() {
    var w = natW * curScale, h = natH * curScale;
    lbImg.style.width = Math.round(w) + "px";
    lbImg.style.height = Math.round(h) + "px";
    var sr = lbStage.getBoundingClientRect();
    var maxTx = Math.max(0, (w - sr.width) / 2);
    var maxTy = Math.max(0, (h - sr.height) / 2);
    if (tx > maxTx) tx = maxTx; if (tx < -maxTx) tx = -maxTx;
    if (ty > maxTy) ty = maxTy; if (ty < -maxTy) ty = -maxTy;
    zoomWrap.style.transform = "translate(" + tx + "px," + ty + "px)";
  }
  function fit() {
    var sr = lbStage.getBoundingClientRect();
    var sw = sr.width - 32, sh = sr.height - 32;
    fitScale = Math.min(sw / natW, sh / natH, 1);
    if (!isFinite(fitScale) || fitScale <= 0) fitScale = 1;
    curScale = fitScale; tx = 0; ty = 0; applyZoom();
  }
  function zoomIn() { curScale = Math.min(curScale * 1.25, 4); applyZoom(); }
  function zoomOut() { curScale = Math.max(curScale / 1.25, fitScale); if (curScale <= fitScale) { tx = 0; ty = 0; } applyZoom(); }
  function resetZoom() { curScale = 1; tx = 0; ty = 0; applyZoom(); }

  function showCur() {
    var item = curItems[curIdx];
    lbTitle.textContent = item.title || "";
    tx = 0; ty = 0; curScale = fitScale = 1;
    if (item.src) {
      // 视频模式：不显示图片，不走缩放逻辑；让灯箱按视频比例自适应高度
      lb.classList.add("video-mode");
      lbImg.style.display = "none";
      lbImg.src = "";
      if (lbVideo) {
        lbVideo.style.display = "";
        lbVideo.src = item.src;
        lbVideo.play().catch(function () {});
      }
      if (lbZoomControls) lbZoomControls.style.display = "none";
      if (lbPrev) lbPrev.style.display = "none";
      if (lbNext) lbNext.style.display = "none";
    } else {
      lb.classList.remove("video-mode");
      lbImg.style.display = "";
      lbImg.src = item.img;
      lbImg.alt = item.title || "";
      if (lbVideo) { lbVideo.pause(); lbVideo.src = ""; lbVideo.style.display = "none"; }
      if (lbZoomControls) lbZoomControls.style.display = "";
      if (lbPrev) lbPrev.style.display = "";
      if (lbNext) lbNext.style.display = "";
      if (lbImg.complete && lbImg.naturalWidth) {
        natW = lbImg.naturalWidth; natH = lbImg.naturalHeight; fit();
      }
    }
  }
  function openLightbox(items, i, fromSliceItem) {
    curItems = items; curIdx = i; returnToSliceItem = fromSliceItem || null;
    showCur();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.classList.remove("open", "video-mode");
    lb.setAttribute("aria-hidden", "true");
    lbImg.src = "";
    if (lbVideo) { lbVideo.pause(); lbVideo.src = ""; lbVideo.style.display = "none"; }
    document.body.style.overflow = "";
    if (lbZoomControls) lbZoomControls.style.display = "";
    if (lbPrev) lbPrev.style.display = "";
    if (lbNext) lbNext.style.display = "";
    if (returnToSliceItem) { var it = returnToSliceItem; returnToSliceItem = null; openSliceModal(it); }
  }
  function step(d) {
    if (!curItems) return;
    curIdx = (curIdx + d + curItems.length) % curItems.length;
    showCur();
  }

  lbImg.addEventListener("load", function () {
    natW = lbImg.naturalWidth; natH = lbImg.naturalHeight; fit();
  });
  document.getElementById("lbClose").addEventListener("click", closeLightbox);
  document.getElementById("lbPrev").addEventListener("click", function () { step(-1); });
  document.getElementById("lbNext").addEventListener("click", function () { step(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
  window.addEventListener("resize", function () { if (lb.classList.contains("open")) fit(); });

  document.getElementById("lbZoomIn").addEventListener("click", function (e) { e.stopPropagation(); zoomIn(); });
  document.getElementById("lbZoomOut").addEventListener("click", function (e) { e.stopPropagation(); zoomOut(); });
  document.getElementById("lbZoomReset").addEventListener("click", function (e) { e.stopPropagation(); resetZoom(); });

  /* 滚轮缩放 */
  zoomWrap.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }, { passive: false });

  /* 双击：在「适应屏幕」与「100% 原始」之间切换 */
  zoomWrap.addEventListener("dblclick", function () {
    if (curScale > fitScale + 0.02) { curScale = fitScale; tx = 0; ty = 0; }
    else { curScale = 1; }
    applyZoom();
  });

  /* 拖拽平移（鼠标） */
  var dragging = false, dragSX = 0, dragSY = 0, dragTX = 0, dragTY = 0;
  zoomWrap.addEventListener("mousedown", function (e) {
    if (curScale <= fitScale) return;
    dragging = true;
    dragSX = e.clientX; dragSY = e.clientY;
    dragTX = tx; dragTY = ty;
    zoomWrap.style.cursor = "grabbing";
    e.preventDefault();
  });
  document.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    tx = dragTX + (e.clientX - dragSX);
    ty = dragTY + (e.clientY - dragSY);
    applyZoom();
  });
  document.addEventListener("mouseup", function () { dragging = false; zoomWrap.style.cursor = "grab"; });

  /* 触控：单指拖拽 / 双指捏合缩放 */
  var pinchStart = 0, pinchScale = 1;
  zoomWrap.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
      dragging = true;
      dragSX = e.touches[0].clientX; dragSY = e.touches[0].clientY;
      dragTX = tx; dragTY = ty;
    } else if (e.touches.length === 2) {
      pinchStart = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchScale = curScale;
    }
  }, { passive: false });
  zoomWrap.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      tx = dragTX + (e.touches[0].clientX - dragSX);
      ty = dragTY + (e.touches[0].clientY - dragSY);
      applyZoom();
    } else if (e.touches.length === 2) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      curScale = Math.min(Math.max(pinchScale * (d / pinchStart), fitScale), 4);
      applyZoom();
    }
  }, { passive: false });
  zoomWrap.addEventListener("touchend", function () { dragging = false; });

  /* =========================================================
     长图切片网格弹窗（详情 / 海报）
     ========================================================= */
  var sliceModal = document.getElementById("sliceModal");
  var sliceGrid = document.getElementById("sliceGrid");
  var sliceTitle = document.getElementById("sliceTitle");

  function openSliceModal(item) {
    sliceTitle.textContent = item.title || "长图";
    sliceGrid.innerHTML = "";
    var slices = item.slices && item.slices.length ? item.slices : [item.img];
    slices.forEach(function (src, i) {
      var cell = document.createElement("div");
      cell.className = "slice-cell";
      cell.dataset.admSection = "detail"; // 删除时按原 long image 处理
      cell.dataset.admFile = item.img;
      cell.innerHTML =
        '<img loading="lazy" src="' + src + '" alt="第 ' + (i + 1) + ' 屏">' +
        '<span class="slice-num">' + (i + 1) + '</span>';
      cell.addEventListener("click", function () {
        var items = slices.map(function (s, k) {
          return { img: s, title: (item.title || "长图") + " · 第 " + (k + 1) + " 屏" };
        });
        closeSliceModal();
        openLightbox(items, i, item);
      });
      sliceGrid.appendChild(cell);
    });
    if (document.body.classList.contains("admin-mode")) attachDeleteButtons();
    sliceModal.classList.add("open");
    sliceModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeSliceModal() {
    sliceModal.classList.remove("open");
    sliceModal.setAttribute("aria-hidden", "true");
    sliceGrid.innerHTML = "";
    document.body.style.overflow = "";
  }
  document.getElementById("sliceClose").addEventListener("click", closeSliceModal);
  sliceModal.addEventListener("click", function (e) { if (e.target === sliceModal) closeSliceModal(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sliceModal.classList.contains("open")) closeSliceModal();
  });

  /* =========================================================
     PDF 查看 / 下载 弹窗
     ========================================================= */
  var pdfModal = document.getElementById("pdfModal");
  var pdfFrame = document.getElementById("pdfFrame");
  var pdfName = document.getElementById("pdfName");
  var pdfDownload = document.getElementById("pdfDownload");
  var pdfOpen = document.getElementById("pdfOpen");
  var pdfViewer = document.getElementById("pdfViewer");

  function isEmbeddedApp() {
    var ua = navigator.userAgent.toLowerCase();
    return /micromessenger|baidu|bidubrowser|qq\/|mqqbrowser|weibo|ucbrowser|qqbrowser/i.test(ua);
  }
  function absoluteUrl(rel) {
    var a = document.createElement("a");
    a.href = rel;
    return a.href;
  }

  function openPdfModal(item) {
    var title = item.title || basename(item.pdf);
    pdfName.textContent = title;
    pdfDownload.href = item.pdf;
    pdfDownload.setAttribute("download", basename(item.pdf));
    pdfOpen.href = item.pdf;
    // 国内网络下 Google Docs 不可达，统一隐藏「在线预览」，避免误导
    if (pdfViewer) pdfViewer.style.display = "none";

    var tip = document.getElementById("pdfTip");

    // 内置浏览器（微信/QQ/百度/微博/UC）：iframe 常被劫持或无法预览，
    // 改为提示文案 + 手动「下载/新窗口打开」，避免自动 window.open 被拦截成「保存失败」
    if (isEmbeddedApp()) {
      if (pdfFrame) { pdfFrame.src = ""; pdfFrame.style.display = "none"; }
      if (tip) tip.style.display = "flex";
    } else {
      // 普通浏览器（含手机 Safari）：iframe 直接预览
      if (tip) tip.style.display = "none";
      if (pdfFrame) { pdfFrame.style.display = ""; pdfFrame.src = item.pdf; }
    }

    pdfModal.classList.add("open");
    pdfModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closePdfModal() {
    pdfModal.classList.remove("open");
    pdfModal.setAttribute("aria-hidden", "true");
    if (pdfFrame) { pdfFrame.src = ""; pdfFrame.style.display = ""; }
    var tip = document.getElementById("pdfTip");
    if (tip) tip.style.display = "none";
    document.body.style.overflow = "";
  }
  document.getElementById("pdfClose").addEventListener("click", closePdfModal);
  pdfModal.addEventListener("click", function (e) { if (e.target === pdfModal) closePdfModal(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && pdfModal.classList.contains("open")) closePdfModal();
  });

  /* =========================================================
     移动端菜单
     ========================================================= */
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

  /* =========================================================
     导航高亮
     ========================================================= */
  if (links) {
    var navAnchors = Array.prototype.slice.call(links.querySelectorAll("a"));
    var sections = navAnchors
      .map(function (a) { var h = a.getAttribute("href") || ""; return h.startsWith("#") ? document.querySelector(h) : null; })
      .filter(Boolean);

    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var id = en.target.id;
            navAnchors.forEach(function (a) {
              var h = a.getAttribute("href") || "";
              a.classList.toggle("active", h === "#" + id);
            });
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (s) { obs.observe(s); });
    }
  }

  /* 杂项 */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* 检测是否在 APP 内置浏览器中（仅微信、QQ 显示顶部提示，普通手机浏览器/百度等不显示） */
  function detectAppBrowser() {
    var ua = navigator.userAgent.toLowerCase();
    var isWeixin = /micromessenger/i.test(ua);
    var isQQ = /\bqq\//i.test(ua) || /\bmqqbrowser\//i.test(ua);
    if (!(isWeixin || isQQ)) return;
    var hint = document.getElementById("appBrowserHint");
    var close = document.getElementById("abhClose");
    var copyBtn = document.getElementById("abhCopy");
    var toast = document.getElementById("abhToast");
    if (!hint) return;
    hint.style.display = "";
    if (close) close.addEventListener("click", function () { hint.style.display = "none"; });

    function showToast(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(function () { toast.classList.remove("show"); }, 2400);
    }
    function fallbackCopy(url) {
      try {
        var ta = document.createElement("textarea");
        ta.value = url; ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(ok ? "已复制，去浏览器粘贴打开 ✓" : "复制失败，请长按网址手动复制");
      } catch (e) {
        showToast("复制失败，请长按网址手动复制");
      }
    }
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { showToast("已复制，去浏览器粘贴打开 ✓"); },
          function () { fallbackCopy(url); }
        );
      } else {
        fallbackCopy(url);
      }
    });
  }

  /* 启动 */
  function init() {
    renderGrids();
    renderBrand();
    renderExhibition();
    checkAdminToken();
    detectAppBrowser();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
