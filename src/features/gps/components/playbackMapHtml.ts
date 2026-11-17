const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "").trim();

/** Mũi tên định vị giống marker xe bên web (playback-veh-arrow). */
const ARROW_SVG = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 2.2 19.6 20.4 12 16.6 4.4 20.4Z" fill="#7c3aed" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"></path></svg>';

export type PlaybackMapTheme = {
  brand: string;
  background: string;
  surface: string;
  text: string;
  /** Màu phần tuyến chưa đi tới. */
  pending: string;
  /** Màu đường viền marker/điểm đầu cuối. */
  outline: string;
};

/**
 * HTML bản đồ phát lại hành trình (WebView Leaflet) — cùng pattern trackingMapHtml.
 *
 * RN → map:
 * - `window.setPath(points)` nạp polyline (chỉ gọi 1 lần sau khi tải dữ liệu),
 * - `window.setProgress(vertex, lat, lng)` tách tuyến thành "đã đi" (brand) và
 *   "chưa đi" (xám) + di chuyển marker tới vị trí nội suy,
 * - `window.moveVehicle(lat, lng, heading, speed, follow)` xoay mũi tên + chip tốc độ,
 * - `window.setRouteVisible(visible)` ẩn/hiện lộ trình.
 *
 * map → RN: postMessage {type:'ready'}.
 */
export function buildPlaybackMapHtml(theme: PlaybackMapTheme) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    + (CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "");

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;background:${theme.background};overflow:hidden}
.leaflet-control-zoom{display:none}
.veh-wrap{display:flex;flex-direction:column;align-items:center;gap:3px}
.veh-speed{display:flex;align-items:center;gap:3px;background:${theme.surface};color:${theme.text};border-radius:9999px;padding:3px 8px;font:800 11px/1 system-ui,sans-serif;white-space:nowrap;box-shadow:0 3px 10px #0f172a44;font-variant-numeric:tabular-nums}
.veh-speed i{font-style:normal;color:${theme.brand}}
.veh-arrow{display:grid;place-items:center;width:34px;height:34px;transform-origin:50% 50%;filter:drop-shadow(0 3px 6px #0f172a66)}
.start-dot,.end-dot{display:block;width:14px;height:14px;box-sizing:border-box;border:2px solid ${theme.outline};border-radius:50%}
.start-dot{background:#059669}
.end-dot{background:#dc2626}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:true});
  L.tileLayer(${JSON.stringify(tileUrl)},{subdomains:'abcd',maxZoom:20}).addTo(map);
  function send(payload){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}}
  function icon(html,size,anchor,z){return L.divIcon({className:'',html:html,iconSize:size,iconAnchor:anchor});}

  var path=[];
  var doneLatLngs=[];
  var todoLatLngs=[];
  var doneLine=null;
  var todoLine=null;
  var marker=null;
  var startDot=null;
  var endDot=null;
  var routeVisible=true;
  var lastSpeed=null;
  var lastHeading=null;
  var followOn=false;

  // Người dùng tự kéo/zoom bản đồ thì tắt "Theo xe" (giống web: map.on('dragstart')).
  function disableFollow(){
    if(!followOn)return;
    followOn=false;
    send({type:'followOff'});
  }
  map.on('dragstart',disableFollow);
  map.on('zoomstart',disableFollow);

  var carIcon=icon('<div class="veh-wrap"><div class="veh-speed"><i>⚡</i><span class="veh-chip">0</span> km/h</div><div class="veh-arrow">${ARROW_SVG}</div></div>',[46,58],[23,41]);

  map.setView([16.05,108.1],6);

  window.setPath=function(points){
    if(!points||points.length<1)return;
    path=points.filter(function(p){return Number.isFinite(p[0])&&Number.isFinite(p[1]);});
    if(path.length<1)return;
    if(doneLine){map.removeLayer(doneLine);doneLine=null;}
    if(todoLine){map.removeLayer(todoLine);todoLine=null;}
    if(startDot){map.removeLayer(startDot);startDot=null;}
    if(endDot){map.removeLayer(endDot);endDot=null;}
    if(marker){map.removeLayer(marker);marker=null;}

    todoLine=L.polyline(path,{color:${JSON.stringify(theme.pending)},weight:4,opacity:0.9}).addTo(map);
    doneLine=L.polyline([],{color:${JSON.stringify(theme.brand)},weight:5,opacity:0.95}).addTo(map);
    if(path.length>=2){
      startDot=L.marker(path[0],{icon:icon('<span class="start-dot"></span>',[14,14],[7,7]),zIndexOffset:500}).addTo(map);
      endDot=L.marker(path[path.length-1],{icon:icon('<span class="end-dot"></span>',[14,14],[7,7]),zIndexOffset:500}).addTo(map);
    }
    marker=L.marker(path[0],{icon:carIcon,zIndexOffset:900}).addTo(map);
    map.fitBounds(L.latLngBounds(path),{padding:[28,28]});
    if(path.length<2){map.setView(path[0],16,{animate:false});}
  };

  window.setProgress=function(vertex,latitude,longitude){
    if(!path.length)return;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    var i=Math.max(0,Math.min(path.length-1,Math.floor(vertex)));
    var here=[latitude,longitude];
    doneLatLngs=path.slice(0,i+1).concat([here]);
    todoLatLngs=[here].concat(path.slice(i+1));
    if(doneLine)doneLine.setLatLngs(doneLatLngs.length>=2?doneLatLngs:[here,here]);
    if(todoLine)todoLine.setLatLngs(todoLatLngs.length>=2?todoLatLngs:[here,here]);
  };

  window.moveVehicle=function(latitude,longitude,heading,speed,follow){
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    if(marker)marker.setLatLng([latitude,longitude]);
    var arrow=document.querySelector('.veh-arrow');
    if(arrow&&Number.isFinite(heading)){arrow.style.transform='rotate('+heading+'deg)';lastHeading=heading;}
    var chip=document.querySelector('.veh-chip');
    if(chip&&Number.isFinite(speed)){chip.textContent=String(Math.round(speed));lastSpeed=speed;}
    followOn=!!follow;
    if(follow)map.panTo([latitude,longitude],{animate:false});
  };

  window.setRouteVisible=function(visible){
    routeVisible=!!visible;
    if(todoLine){if(routeVisible)todoLine.addTo(map);else map.removeLayer(todoLine);}
    if(doneLine){if(routeVisible)doneLine.addTo(map);else map.removeLayer(doneLine);}
  };

  window.resetVehicle=function(latitude,longitude,heading){
    if(marker)marker.setLatLng([latitude,longitude]);
    var arrow=document.querySelector('.veh-arrow');
    if(arrow&&Number.isFinite(heading)){arrow.style.transform='rotate('+heading+'deg)';}
    var chip=document.querySelector('.veh-chip');
    if(chip){chip.textContent='0';}
    if(routeVisible&&todoLine){todoLine.setLatLngs(path);}
    if(doneLine){doneLine.setLatLngs([]);}
    map.fitBounds(L.latLngBounds(path),{padding:[28,28]});
  };

  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}
