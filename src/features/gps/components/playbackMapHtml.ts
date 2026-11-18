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
 * - `window.setRoutes(segments)` nạp các đoạn polyline (gap mất tín hiệu không nối),
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

  var segments=[];
  var path=[];
  var segStart=[];
  var segEnd=[];
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

  function removeLayer(layer){
    if(layer){map.removeLayer(layer);}
  }

  // Chấp nhận cả mảng đoạn [[[lat,lng],...],...] lẫn path phẳng cũ [[lat,lng],...].
  function normalizeSegments(input){
    if(!Array.isArray(input)||input.length===0)return [];
    var first=input[0];
    var flat=Array.isArray(first)&&first.length===2&&typeof first[0]==='number';
    var source=flat?[input]:input;
    var out=[];
    for(var s=0;s<source.length;s++){
      var raw=Array.isArray(source[s])?source[s]:[];
      var points=[];
      for(var i=0;i<raw.length;i++){
        var point=raw[i];
        if(Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1]))points.push(point);
      }
      if(points.length>=2)out.push(points);
    }
    return out;
  }

  function rebuildIndex(){
    path=[];
    segStart=[];
    segEnd=[];
    for(var s=0;s<segments.length;s++){
      segStart.push(path.length);
      for(var i=0;i<segments[s].length;i++)path.push(segments[s][i]);
      segEnd.push(path.length-1);
    }
  }

  function segmentIndexAt(vertex){
    for(var s=0;s<segments.length;s++){
      if(vertex<=segEnd[s])return s;
    }
    return segments.length-1;
  }

  window.setRoutes=function(input){
    removeLayer(doneLine);doneLine=null;
    removeLayer(todoLine);todoLine=null;
    removeLayer(startDot);startDot=null;
    removeLayer(endDot);endDot=null;
    removeLayer(marker);marker=null;
    routeVisible=true;

    segments=normalizeSegments(input);
    rebuildIndex();
    if(path.length<1)return;

    todoLine=L.polyline(segments,{color:${JSON.stringify(theme.pending)},weight:4,opacity:0.9}).addTo(map);
    doneLine=L.polyline([],{color:${JSON.stringify(theme.brand)},weight:5,opacity:0.95}).addTo(map);
    var first=path[0];
    var last=path[path.length-1];
    startDot=L.marker(first,{icon:icon('<span class="start-dot"></span>',[14,14],[7,7]),zIndexOffset:500}).addTo(map);
    endDot=L.marker(last,{icon:icon('<span class="end-dot"></span>',[14,14],[7,7]),zIndexOffset:500}).addTo(map);
    marker=L.marker(first,{icon:carIcon,zIndexOffset:900}).addTo(map);
    if(path.length>=2){map.fitBounds(L.latLngBounds(path),{padding:[28,28]});}
    else{map.setView(first,16,{animate:false});}
  };
  // Tên cũ: chỉ vẽ 1 đoạn.
  window.setPath=window.setRoutes;

  window.clearRoute=function(){
    removeLayer(doneLine);doneLine=null;
    removeLayer(todoLine);todoLine=null;
    removeLayer(startDot);startDot=null;
    removeLayer(endDot);endDot=null;
    segments=[];
    path=[];
    segStart=[];
    segEnd=[];
  };

  window.setProgress=function(vertex,latitude,longitude){
    if(!path.length||!doneLine||!todoLine)return;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    var i=Math.max(0,Math.min(path.length-1,Math.floor(vertex)));
    var s=segmentIndexAt(i);
    var local=i-segStart[s];
    var here=[latitude,longitude];

    // Các đoạn trước đã đi hết; chỉ đoạn hiện tại được cắt tại vị trí marker.
    var done=segments.slice(0,s);
    if(local>0){
      done.push(segments[s].slice(0,local+1).concat([here]));
    }
    var todo=[];
    var tail=[here].concat(segments[s].slice(local+1));
    if(tail.length>=2)todo.push(tail);
    todo=todo.concat(segments.slice(s+1));

    doneLine.setLatLngs(done);
    todoLine.setLatLngs(todo);
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
    if(startDot){if(routeVisible)startDot.addTo(map);else map.removeLayer(startDot);}
    if(endDot){if(routeVisible)endDot.addTo(map);else map.removeLayer(endDot);}
  };

  window.resetVehicle=function(latitude,longitude,heading){
    if(marker&&path.length)marker.setLatLng([latitude,longitude]);
    var arrow=document.querySelector('.veh-arrow');
    if(arrow&&Number.isFinite(heading)){arrow.style.transform='rotate('+heading+'deg)';}
    var chip=document.querySelector('.veh-chip');
    if(chip){chip.textContent='0';}
    if(routeVisible&&todoLine)todoLine.setLatLngs(segments);
    if(doneLine){doneLine.setLatLngs([]);}
    if(path.length>=2)map.fitBounds(L.latLngBounds(path),{padding:[28,28]});
  };

  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}
