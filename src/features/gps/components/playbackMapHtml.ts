const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "").trim();

const CAR_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

/**
 * HTML bản đồ phát lại hành trình (WebView Leaflet) — cùng pattern trackingMapHtml.
 * RN → map: window.setPath(points) vẽ polyline + fitBounds, window.moveMarker(lat,lng)
 * di chuyển marker theo slider/Play. map → RN: postMessage {type:'ready'}.
 * Chỉ boolean/mảng số được đưa vào script.
 */
export function buildPlaybackMapHtml(brandColor: string, backgroundColor: string) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    + (CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "");

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;background:${backgroundColor};overflow:hidden}
.leaflet-control-zoom{display:none}
.car-pin{display:grid;place-items:center;width:40px;height:40px;border:3px solid #fff;border-radius:50%;background:${brandColor};box-shadow:0 3px 8px #0f172a55}
.start-dot,.end-dot{display:block;width:14px;height:14px;box-sizing:border-box;border:2px solid #fff;border-radius:50%}
.start-dot{background:#059669}
.end-dot{background:#dc2626}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:true});
  L.tileLayer(${JSON.stringify(tileUrl)},{subdomains:'abcd',maxZoom:20}).addTo(map);
  function send(payload){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}}
  var marker=null;
  var startDot=null;
  var endDot=null;
  var carIcon=L.divIcon({className:'',html:'<div class="car-pin">${CAR_SVG}</div>',iconSize:[40,40],iconAnchor:[20,20]});
  map.setView([16.05,108.1],6);
  window.setPath=function(points){
    if(!points||points.length<1)return;
    var latlngs=points.filter(function(p){return Number.isFinite(p[0])&&Number.isFinite(p[1]);});
    if(latlngs.length<1)return;
    if(latlngs.length>=2){
      L.polyline(latlngs,{color:${JSON.stringify(brandColor)},weight:4,opacity:0.85}).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs),{padding:[28,28]});
      startDot=L.marker(latlngs[0],{icon:L.divIcon({className:'',html:'<span class="start-dot"></span>',iconSize:[14,14],iconAnchor:[7,7]}),zIndexOffset:500}).addTo(map);
      endDot=L.marker(latlngs[latlngs.length-1],{icon:L.divIcon({className:'',html:'<span class="end-dot"></span>',iconSize:[14,14],iconAnchor:[7,7]}),zIndexOffset:500}).addTo(map);
    }
    marker=L.marker(latlngs[0],{icon:carIcon}).addTo(map);
    if(latlngs.length<2){map.setView(latlngs[0],16,{animate:false});}
  };
  window.moveMarker=function(latitude,longitude){
    if(!marker||!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    marker.setLatLng([latitude,longitude]);
  };
  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}
