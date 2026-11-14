export type TrackingMapInit = { latitude: number; longitude: number } | null;

const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "").trim();
const CAR_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

/**
 * HTML bản đồ Leaflet cho màn theo dõi xe (WebView) — cùng pattern với
 * vehicleSearchMapHtml: chỉ số học được đưa vào script, RN → map qua
 * injectJavaScript(window.updatePosition / window.setRoute), map → RN qua postMessage.
 */
export function buildTrackingMapHtml(
  initial: TrackingMapInit,
  brandColor: string,
  backgroundColor: string,
) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    + (CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "");
  const safeInitial = initial && Number.isFinite(initial.latitude) && Number.isFinite(initial.longitude) ? initial : null;
  const serializedInitial = JSON.stringify(safeInitial);
  const serializedCarSvg = JSON.stringify(CAR_SVG);

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;background:${backgroundColor};overflow:hidden}
.leaflet-control-zoom{display:none}
.tracking-pin{display:grid;place-items:center;width:40px;height:40px;border:2px solid #fff;border-radius:50%;background:${brandColor};color:#fff;box-shadow:0 2px 8px #0f172a55}
.tracking-pin.stale{background:#dc2626}
.tracking-pin.ended{background:#64748b}
.inspect-pin{width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 4px #f59e0b66,0 2px 6px #0f172a55}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var initial=${serializedInitial};
  var carSvg=${serializedCarSvg};
  var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:false});
  L.tileLayer(${JSON.stringify(tileUrl)},{subdomains:'abcd',maxZoom:20}).addTo(map);
  var marker=null;
  var followed=true;
  var routePts=[];
  var routeLine=null;
  var inspectMarker=null;
  function send(payload){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}}
  function iconFor(state){
    return L.divIcon({className:'',html:'<div class="tracking-pin '+(state||'')+'">'+carSvg+'</div>',iconSize:[40,40],iconAnchor:[20,20]});
  }
  window.updatePosition=function(latitude,longitude,state){
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    if(marker){
      marker.setLatLng([latitude,longitude]);
      marker.setIcon(iconFor(state));
    }else{
      marker=L.marker([latitude,longitude],{icon:iconFor(state)}).addTo(map);
      map.setView([latitude,longitude],16,{animate:false});
    }
    if(routeLine){
      var last=routePts[routePts.length-1];
      if(!last||last[0]!==latitude||last[1]!==longitude){
        routePts.push([latitude,longitude]);
        routeLine.addLatLng([latitude,longitude]);
      }
    }
    if(followed){map.panTo([latitude,longitude],{animate:true,duration:0.5});}
  };
  window.setRoute=function(points,fit){
    if(!Array.isArray(points)||points.length<1)return;
    var doFit=fit!==false;
    routePts=points.slice();
    if(routeLine){
      routeLine.setLatLngs(routePts);
      if(doFit&&routePts.length>1){map.fitBounds(routeLine.getBounds(),{padding:[24,24]});}
      return;
    }
    routeLine=L.polyline(routePts,{color:${JSON.stringify(brandColor)},weight:4,opacity:0.8,interactive:false}).addTo(map);
    if(doFit&&routePts.length>1){map.fitBounds(routeLine.getBounds(),{padding:[24,24]});}
  };
  window.setFollowed=function(value){followed=!!value;};
  // Ghim mốc đang xem lại (màu hổ phách) và đưa bản đồ tới đó.
  window.showPoint=function(latitude,longitude){
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
    if(inspectMarker){inspectMarker.setLatLng([latitude,longitude]);}
    else{
      inspectMarker=L.marker([latitude,longitude],{icon:L.divIcon({className:'',html:'<div class="inspect-pin"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
    }
    map.setView([latitude,longitude],Math.max(map.getZoom(),15),{animate:true});
  };
  window.clearPoint=function(){
    if(inspectMarker){map.removeLayer(inspectMarker);inspectMarker=null;}
  };
  map.on('dragstart',function(){followed=false;send({type:'drag'});});
  if(initial){window.updatePosition(initial.latitude,initial.longitude,'');}
  else{map.setView([16.05,108.1],6);}
  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}

/**
 * HTML bản đồ nhiều xe đang cho thuê (chủ xe). RN → map qua window.setVehicles,
 * map → RN qua postMessage {type:'vehicle', bookingId} khi bấm ghim.
 */
export function buildFleetMapHtml(brandColor: string, backgroundColor: string) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    + (CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "");
  const serializedCarSvg = JSON.stringify(CAR_SVG);

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;background:${backgroundColor};overflow:hidden}
.leaflet-control-zoom{display:none}
.tracking-pin{display:grid;place-items:center;width:38px;height:38px;border:2px solid #fff;border-radius:50%;background:${brandColor};color:#fff;box-shadow:0 2px 8px #0f172a55}
.tracking-pin.stale{background:#dc2626}
.tracking-pin.ended,.tracking-pin.none{background:#64748b}
.leaflet-tooltip{font:600 11px system-ui,sans-serif;border-radius:8px;padding:3px 7px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var carSvg=${serializedCarSvg};
  var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:true});
  L.tileLayer(${JSON.stringify(tileUrl)},{subdomains:'abcd',maxZoom:20}).addTo(map);
  map.setView([16.05,108.1],6);
  var markers={};
  var fitted=false;
  function send(payload){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}}
  function iconFor(state){
    return L.divIcon({className:'',html:'<div class="tracking-pin '+(state||'')+'">'+carSvg+'</div>',iconSize:[38,38],iconAnchor:[19,19]});
  }
  function fitIfNeeded(){
    if(fitted)return;
    var points=Object.keys(markers).map(function(id){return markers[id].getLatLng();});
    if(points.length===0)return;
    fitted=true;
    if(points.length===1){map.setView(points[0],15,{animate:false});}
    else{map.fitBounds(L.latLngBounds(points),{padding:[36,36],maxZoom:15});}
  }
  window.setVehicles=function(vehicles){
    if(!Array.isArray(vehicles))return;
    var seen={};
    vehicles.forEach(function(vehicle){
      var latitude=vehicle.latitude, longitude=vehicle.longitude;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
      var id=String(vehicle.bookingId);
      seen[id]=true;
      var state=vehicle.state||'';
      var marker=markers[id];
      if(marker){
        marker.setLatLng([latitude,longitude]);
        marker.setIcon(iconFor(state));
        if(vehicle.label)marker.setTooltipContent(vehicle.label);
      }else{
        marker=L.marker([latitude,longitude],{icon:iconFor(state)}).addTo(map);
        if(vehicle.label)marker.bindTooltip(vehicle.label,{direction:'top',offset:[0,-20]});
        marker.on('click',(function(bookingId){return function(){send({type:'vehicle',bookingId:bookingId});};})(vehicle.bookingId));
        markers[id]=marker;
      }
    });
    Object.keys(markers).forEach(function(id){
      if(!seen[id]){map.removeLayer(markers[id]);delete markers[id];}
    });
    fitIfNeeded();
  };
  window.fitVehicles=function(){
    fitted=false;
    fitIfNeeded();
  };
  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}
