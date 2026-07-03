/**
 * B站美食探店地图 - 应用逻辑（高德地图 JS API 2.0）
 */
(function() {
  'use strict';

  // ========== 配置常量 ==========
  const UP主_COLORS = {
    '转生成为毛毛': '#9b59b6',
    '鸡煲下士': '#e67e22',
    '搓手手大王': '#3498db',
  };

  const UP主_AVATAR = {
    '转生成为毛毛': '🦁',
    '鸡煲下士': '🐔',
    '搓手手大王': '👑',
  };

  // ========== 状态 ==========
  let map = null;
  let markers = [];
  let currentInfoWindow = null;
  let currentUp主 = 'all';
  let currentSearch = '';
  let isMobile = window.innerWidth <= 768;
  let autoComplete = null;
  let geolocation = null;
  let locateMarker = null;

  // ========== DOM 元素缓存 ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ========== 初始化地图 ==========
  function initMap() {
    map = new AMap.Map('map-container', {
      zoom: 4,
      center: [105.0, 35.0],
      resizeEnable: true,
      zoomEnable: true,
      dragEnable: true
    });

    // 加载高德插件
    AMap.plugin(['AMap.AutoComplete', 'AMap.Geolocation'], function() {
      initAutoComplete();
      initGeolocation();
    });
  }

  // ========== 初始化 POI 自动补全 ==========
  function initAutoComplete() {
    autoComplete = new AMap.AutoComplete({
      input: 'search-input'
    });

    autoComplete.on('select', function(e) {
      var poi = e.poi;
      if (poi.location) {
        map.setZoomAndCenter(16, [poi.location.lng, poi.location.lat]);
        hideSuggestions();
      }
    });

    // 监听输入，显示自定义建议列表
    var input = $('#search-input');
    if (input) {
      input.addEventListener('input', function(e) {
        var keyword = e.target.value.trim();
        if (keyword.length >= 1) {
          autoComplete.search(keyword, function(status, result) {
            if (status === 'complete' && result.info === 'OK') {
              renderSuggestions(result.tips);
            } else {
              hideSuggestions();
            }
          });
        } else {
          hideSuggestions();
        }
      });

      // 点击外部关闭建议
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-box')) {
          hideSuggestions();
        }
      });
    }
  }

  // ========== 渲染搜索建议 ==========
  function renderSuggestions(tips) {
    var list = $('#search-suggestions');
    if (!list) return;

    if (!tips || tips.length === 0) {
      hideSuggestions();
      return;
    }

    list.innerHTML = tips.slice(0, 6).map(function(tip) {
      var name = tip.name || '';
      var district = tip.district || '';
      return '<li onclick="selectSuggestion(' + tip.location.lng + ',' + tip.location.lat + ',\'' + escapeHtml(name).replace(/'/g, "\\'") + '\')">' +
        '<span class="sugg-icon">📍</span>' +
        '<span class="sugg-name">' + escapeHtml(name) + '</span>' +
        '<span class="sugg-district">' + escapeHtml(district) + '</span>' +
      '</li>';
    }).join('');

    list.classList.add('show');
  }

  window.selectSuggestion = function(lng, lat, name) {
    map.setZoomAndCenter(16, [lng, lat]);
    hideSuggestions();
    $('#search-input').value = name;
  };

  function hideSuggestions() {
    var list = $('#search-suggestions');
    if (list) list.classList.remove('show');
  }

  // ========== 初始化定位 ==========
  function initGeolocation() {
    geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
      showButton: false,
      showMarker: false,
      showCircle: false
    });
    map.addControl(geolocation);
  }

  // ========== 定位到我的位置 ==========
  window.locateMe = function() {
    var btn = $('#locate-btn');
    if (btn) btn.classList.add('locate-loading');

    if (!geolocation) {
      alert('定位功能初始化中，请稍后再试');
      if (btn) btn.classList.remove('locate-loading');
      return;
    }

    geolocation.getCurrentPosition(function(status, result) {
      if (btn) btn.classList.remove('locate-loading');

      if (status === 'complete') {
        var pos = result.position;
        // 添加或更新定位标记
        if (locateMarker) {
          locateMarker.setPosition([pos.lng, pos.lat]);
        } else {
          locateMarker = new AMap.Marker({
            position: [pos.lng, pos.lat],
            content: '<div style="width:16px;height:16px;background:#3388ff;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
            offset: new AMap.Pixel(-8, -8),
            zIndex: 200
          });
          locateMarker.setMap(map);
        }
        map.setZoomAndCenter(14, [pos.lng, pos.lat]);
      } else {
        alert('定位失败：' + (result.message || '请检查定位权限'));
      }
    });
  };

  // ========== 导航到这里 ==========
  window.navigateTo = function(lng, lat, name) {
    var url = 'https://uri.amap.com/navigation?to=' + lng + ',' + lat + ',' + encodeURIComponent(name) + '&mode=car&policy=1';
    window.open(url, '_blank');
  };

  // ========== 渲染地图标注 ==========
  function renderMarkers(shops) {
    // 清除旧标记
    markers.forEach(function(m) {
      m.setMap(null);
    });
    markers = [];

    shops.forEach(function(shop) {
      const color = UP主_COLORS[shop.up主] || '#999';
      var markerEl = document.createElement('div');
      markerEl.className = 'custom-marker';
      markerEl.style.background = color;
      markerEl.innerHTML = '<span class="marker-emoji">' + (UP主_AVATAR[shop.up主] || '📍') + '</span>';

      var marker = new AMap.Marker({
        position: [shop.lng, shop.lat],
        content: markerEl,
        offset: new AMap.Pixel(-18, -18),
        zIndex: 100
      });

      // 点击标记打开弹窗
      marker.on('click', function() {
        openInfoWindow(shop, marker);
        highlightListItem(shop.id);
      });

      marker._shopId = shop.id;
      marker.setMap(map);
      markers.push(marker);
    });
  }

  // ========== 打开弹窗 ==========
  function openInfoWindow(shop, marker) {
    // 关闭已有弹窗
    if (currentInfoWindow) {
      currentInfoWindow.close();
    }

    var content = buildInfoWindowHtml(shop);

    currentInfoWindow = new AMap.InfoWindow({
      content: content,
      offset: new AMap.Pixel(0, -40),
      isCustom: true
    });

    currentInfoWindow.open(map, marker.getPosition());
  }

  // ========== 构建弹窗 HTML ==========
  function buildInfoWindowHtml(shop) {
    const color = UP主_COLORS[shop.up主] || '#999';
    const stars = '★'.repeat(Math.floor(shop.rating)) + '☆'.repeat(5 - Math.floor(shop.rating));
    const tagsHtml = shop.tags.map(function(t) {
      return '<span class="popup-tag">' + t + '</span>';
    }).join('');

    // 媒体内容：视频或图片
    let mediaHtml = '';
    if (shop.videoUrl) {
      mediaHtml = '<a class="popup-video-btn" href="' + shop.videoUrl + '" target="_blank" rel="noopener" style="background:' + color + '">' +
        '▶ 观看探店视频' +
      '</a>';
    } else if (shop.image) {
      mediaHtml = '<div class="popup-image-wrap">' +
        '<img src="' + shop.image + '" alt="' + escapeHtml(shop.imageTitle || shop.name) + '" class="popup-image">' +
      '</div>';
    }

    // 导航按钮
    var navHtml = '<button class="popup-video-btn" onclick="navigateTo(' + shop.lng + ',' + shop.lat + ',\'' + escapeHtml(shop.name).replace(/'/g, "\\'") + '\')" style="background:#27ae60;margin-top:8px;">' +
      '🧭 导航到这里' +
    '</button>';

    return '<div class="shop-popup">' +
      '<div class="popup-header" style="border-left-color:' + color + '">' +
        '<h3>' + escapeHtml(shop.name) + '</h3>' +
        '<span class="popup-city">' + escapeHtml(shop.city) + '</span>' +
      '</div>' +
      '<div class="popup-meta">' +
        '<span class="popup-up主" style="color:' + color + '">' +
          (UP主_AVATAR[shop.up主] || '') + ' ' + escapeHtml(shop.up主) +
        '</span>' +
        '<span class="popup-rating" title="评分 ' + shop.rating + '">' + stars + ' ' + shop.rating + '</span>' +
      '</div>' +
      '<div class="popup-tags">' + tagsHtml + '</div>' +
      '<p class="popup-desc">' + escapeHtml(shop.description) + '</p>' +
      '<div class="popup-address">📍 ' + escapeHtml(shop.address) + '</div>' +
      mediaHtml +
      navHtml +
    '</div>';
  }

  // ========== 渲染侧边栏列表 ==========
  function renderList(shops) {
    const listEl = $('#shop-list');
    if (!listEl) return;

    if (shops.length === 0) {
      listEl.innerHTML = '<div class="empty-state">🍜 没有找到匹配的店铺</div>';
      return;
    }

    listEl.innerHTML = shops.map(function(shop) {
      const color = UP主_COLORS[shop.up主] || '#999';
      return '<div class="shop-card" data-id="' + shop.id + '" onclick="focusShop(' + shop.id + ')">' +
        '<div class="shop-card-header">' +
          '<h4>' + escapeHtml(shop.name) + '</h4>' +
          '<span class="shop-card-city">' + escapeHtml(shop.city) + '</span>' +
        '</div>' +
        '<div class="shop-card-meta">' +
          '<span class="shop-card-up主" style="color:' + color + '">' +
            (UP主_AVATAR[shop.up主] || '') + ' ' + escapeHtml(shop.up主) +
          '</span>' +
          '<span class="shop-card-rating">★ ' + shop.rating + '</span>' +
        '</div>' +
        '<div class="shop-card-tags">' +
          shop.tags.slice(0, 3).map(function(t) { return '<span>' + t + '</span>'; }).join('') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ========== 渲染 UP主 筛选器 ==========
  function renderUp主Filter() {
    const container = $('#up主-filter');
    if (!container) return;

    const up主s = ['all'].concat(getUniqueUp主s());
    container.innerHTML = up主s.map(function(u) {
      if (u === 'all') {
        return '<button class="filter-btn active" data-up主="all" onclick="setUp主Filter(\'all\')">全部</button>';
      }
      const color = UP主_COLORS[u] || '#999';
      return '<button class="filter-btn" data-up主="' + u + '" onclick="setUp主Filter(\'' + u + '\')" style="--up主-color:' + color + '">' +
        (UP主_AVATAR[u] || '') + ' ' + u +
      '</button>';
    }).join('');
  }

  // ========== 更新统计 ==========
  function updateStats(shops) {
    const total = SHOPS.length;
    const filtered = shops.length;
    const up主Count = getUniqueUp主s().length;
    const cities = new Set(SHOPS.map(function(s) { return s.city; })).size;

    const statsEl = $('#stats-bar');
    if (statsEl) {
      statsEl.innerHTML =
        '<div class="stat-item"><strong>' + total + '</strong><span>收录店铺</span></div>' +
        '<div class="stat-item"><strong>' + up主Count + '</strong><span>UP主</span></div>' +
        '<div class="stat-item"><strong>' + cities + '</strong><span>城市</span></div>' +
        (filtered !== total ? '<div class="stat-item filtered"><strong>' + filtered + '</strong><span>当前显示</span></div>' : '');
    }
  }

  // ========== 筛选逻辑 ==========
  function getFilteredShops() {
    return SHOPS.filter(function(shop) {
      const matchUp主 = currentUp主 === 'all' || shop.up主 === currentUp主;
      const search = currentSearch.toLowerCase();
      const matchSearch = !search ||
        shop.name.toLowerCase().includes(search) ||
        shop.city.toLowerCase().includes(search) ||
        shop.tags.some(function(t) { return t.toLowerCase().includes(search); }) ||
        shop.up主.toLowerCase().includes(search);
      return matchUp主 && matchSearch;
    });
  }

  function applyFilter() {
    var filtered = getFilteredShops();
    renderList(filtered);
    renderMarkers(filtered);
    updateStats(filtered);

    // 更新按钮状态
    $$('.filter-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.up主 === currentUp主);
    });

    // 如果过滤后店铺少，自动调整地图视野
    if (filtered.length > 0 && filtered.length <= 10) {
      map.setFitView(null, false, [80, 80, 80, 80]);
    } else if (filtered.length === 0) {
      map.setZoomAndCenter(4, [105.0, 35.0]);
    }
  }

  // ========== 交互 ==========
  window.setUp主Filter = function(up主) {
    currentUp主 = up主;
    applyFilter();
  };

  window.focusShop = function(id) {
    var shop = SHOPS.find(function(s) { return s.id === id; });
    if (!shop) return;

    map.setZoomAndCenter(14, [shop.lng, shop.lat]);

    // 找到对应标注并打开弹窗
    markers.forEach(function(m) {
      if (m._shopId === shop.id) {
        openInfoWindow(shop, m);
      }
    });

    highlightListItem(id);

    // 移动端：点击列表项后自动切换到地图视图
    if (isMobile) {
      switchTab('map');
    }
  };

  function highlightListItem(id) {
    $$('.shop-card').forEach(function(card) {
      card.classList.toggle('active', parseInt(card.dataset.id) === id);
    });
  }

  // ========== 移动端 Tab 切换 ==========
  window.switchTab = function(tab) {
    const sidebar = $('.sidebar');
    const overlay = $('#sidebar-overlay');
    const tabMap = $('#tab-map');
    const tabList = $('#tab-list');
    if (!sidebar || !tabMap || !tabList) return;

    if (tab === 'list') {
      sidebar.classList.add('show');
      if (overlay) overlay.classList.add('show');
      tabList.classList.add('active');
      tabMap.classList.remove('active');
    } else {
      sidebar.classList.remove('show');
      if (overlay) overlay.classList.remove('show');
      tabMap.classList.add('active');
      tabList.classList.remove('active');
    }
  };

  window.closeSidebar = function() {
    switchTab('map');
  };

  // 监听窗口大小变化
  window.addEventListener('resize', function() {
    isMobile = window.innerWidth <= 768;
  });

  // ========== 搜索 ==========
  function initSearch() {
    const input = $('#search-input');
    if (!input) return;

    input.addEventListener('input', function(e) {
      currentSearch = e.target.value.trim();
      applyFilter();
    });

    // 清空按钮
    const clearBtn = $('#search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        input.value = '';
        currentSearch = '';
        applyFilter();
        hideSuggestions();
      });
    }
  }

  // ========== 工具函数 ==========
  function getUniqueUp主s() {
    const set = new Set();
    SHOPS.forEach(function(s) { set.add(s.up主); });
    return Array.from(set);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 启动 ==========
  document.addEventListener('DOMContentLoaded', function() {
    initMap();
    renderUp主Filter();
    renderList(SHOPS);
    renderMarkers(SHOPS);
    updateStats(SHOPS);
    initSearch();
  });
})();