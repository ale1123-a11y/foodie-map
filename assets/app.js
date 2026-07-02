/**
 * B站美食探店地图 - 应用逻辑
 */
(function() {
  'use strict';

  // ========== 配置常量 ==========
  const UP主_COLORS = {
    '大胃王阿伦': '#e74c3c',
    'TestV': '#3498db',
    '盗月社食遇记': '#2ecc71',
    '转生成为毛毛': '#9b59b6'
  };

  const UP主_AVATAR = {
    '大胃王阿伦': '🍖',
    'TestV': '🎬',
    '盗月社食遇记': '🌙',
    '转生成为毛毛': '🦁'
  };

  // ========== 状态 ==========
  let map = null;
  let markersLayer = null;
  let currentUp主 = 'all';
  let currentSearch = '';
  let isMobile = window.innerWidth <= 768;

  // ========== DOM 元素缓存 ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ========== 初始化地图 ==========
  function initMap() {
    // 使用高德地图瓦片，无需 API Key
    map = L.map('map-container', {
      zoomControl: false,
      attributionControl: false
    }).setView([35.0, 105.0], 4);

    // 高德矢量底图
    L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      {
        subdomains: '1234',
        maxZoom: 18,
        minZoom: 3
      }
    ).addTo(map);

    // 重新定位 zoom 控件到右侧
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  }

  // ========== 渲染地图标注 ==========
  function renderMarkers(shops) {
    markersLayer.clearLayers();

    shops.forEach(function(shop) {
      const color = UP主_COLORS[shop.up主] || '#999';
      const iconHtml = '<div class="custom-marker" style="background:' + color + '">' +
        '<span class="marker-emoji">' + (UP主_AVATAR[shop.up主] || '📍') + '</span>' +
        '</div>';

      const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-marker-container',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([shop.lat, shop.lng], { icon: icon });

      const popupHtml = buildPopupHtml(shop);
      marker.bindPopup(popupHtml, {
        maxWidth: 320,
        className: 'shop-popup'
      });

      marker.on('click', function() {
        highlightListItem(shop.id);
      });

      marker.addTo(markersLayer);
    });
  }

  // ========== 构建弹窗 HTML ==========
  function buildPopupHtml(shop) {
    const color = UP主_COLORS[shop.up主] || '#999';
    const stars = '★'.repeat(Math.floor(shop.rating)) + '☆'.repeat(5 - Math.floor(shop.rating));
    const tagsHtml = shop.tags.map(function(t) {
      return '<span class="popup-tag">' + t + '</span>';
    }).join('');

    return '<div class="popup-content">' +
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
      '<a class="popup-video-btn" href="' + shop.videoUrl + '" target="_blank" rel="noopener" style="background:' + color + '">' +
        '▶ 观看探店视频' +
      '</a>' +
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
    const filtered = getFilteredShops();
    renderList(filtered);
    renderMarkers(filtered);
    updateStats(filtered);

    // 更新按钮状态
    $$('.filter-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.up主 === currentUp主);
    });

    // 如果过滤后店铺少，自动调整地图视野
    if (filtered.length > 0 && filtered.length <= 10) {
      const group = new L.featureGroup(filtered.map(function(s) { return L.marker([s.lat, s.lng]); }));
      map.fitBounds(group.getBounds().pad(0.2));
    } else if (filtered.length === 0) {
      map.setView([35.0, 105.0], 4);
    }
  }

  // ========== 交互 ==========
  window.setUp主Filter = function(up主) {
    currentUp主 = up主;
    applyFilter();
  };

  window.focusShop = function(id) {
    const shop = SHOPS.find(function(s) { return s.id === id; });
    if (!shop) return;

    map.setView([shop.lat, shop.lng], 14);

    // 打开对应标注的弹窗
    markersLayer.eachLayer(function(layer) {
      const latLng = layer.getLatLng();
      if (Math.abs(latLng.lat - shop.lat) < 0.0001 && Math.abs(latLng.lng - shop.lng) < 0.0001) {
        layer.openPopup();
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
