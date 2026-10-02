export type MapVehiclePoint = {
  id: number;
  latitude: number;
  longitude: number;
  vehicleType: string;
  price: number;
  name: string;
  featuredImage: string | null;
  totalPrice: number | null;
  distanceKm: number | null;
};

type PickupCenter = { latitude: number; longitude: number } | null;

const CAR_SVG = '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
const BIKE_SVG = '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';

const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "").trim();

export function buildVehicleSearchMapHtml(
  points: MapVehiclePoint[],
  pickup: PickupCenter,
  radiusKm: number,
  brandColor: string,
  backgroundColor: string,
) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    + (CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "");
  // Only numeric coordinates/prices and known vehicle types enter the WebView script.
  const mapPoints = points.map((point) => ({
    id: point.id,
    latitude: point.latitude,
    longitude: point.longitude,
    vehicleType: point.vehicleType === "Motorbike" ? "Motorbike" : "Car",
    price: point.price,
    name: point.name,
    featuredImage: point.featuredImage,
    totalPrice: point.totalPrice,
    distanceKm: point.distanceKm,
  }));
  const serializedPoints = JSON.stringify(mapPoints).replace(/</g, "\\u003c");

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;background:${backgroundColor};overflow:hidden}
.leaflet-control-zoom{display:none}
.vehicle-pin{display:flex;align-items:center;flex-direction:column;width:94px;filter:drop-shadow(0 3px 5px #25164955)}
.vehicle-pin .symbol{display:grid;place-items:center;width:42px;height:39px;border:2px solid ${brandColor};border-radius:13px;background:#fff;color:${brandColor}}
.vehicle-pin.selected .symbol{border-color:#f59e0b;color:#b45309}
.vehicle-pin .price{margin-top:2px;padding:3px 6px;border-radius:7px;background:${brandColor};color:#fff;font:700 11px sans-serif;white-space:nowrap}
.vehicle-pin.selected .price{background:#92400e}
.vehicle-pin.cluster{position:relative;justify-content:center;height:44px}
.vehicle-pin.cluster .count{position:absolute;top:-7px;right:5px;padding:2px 5px;border:1px solid #fff;border-radius:7px;background:${brandColor};color:#fff;font:700 10px sans-serif}
.vehicle-popup{display:flex;flex-direction:column;gap:7px;width:220px;font:13px sans-serif;color:#1e293b}
.vehicle-popup img{width:100%;height:104px;object-fit:cover;border-radius:8px}
.vehicle-popup strong{font-size:14px}
.vehicle-popup .daily{color:${brandColor};font-weight:700}
.vehicle-popup .detail{color:#64748b;font-size:12px}
.vehicle-popup button{align-self:flex-start;border:0;border-radius:7px;padding:8px 12px;background:${brandColor};color:#fff;font-weight:700}
.pickup-dot{display:block;width:14px;height:14px;box-sizing:border-box;border:2px solid #fff;border-radius:50%;background:#0891b2;box-shadow:0 0 0 1px #0891b2}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var points=${serializedPoints};
  var pickup=${JSON.stringify(pickup)};
  var radiusKm=${JSON.stringify(radiusKm)};
  var carSvg=${JSON.stringify(CAR_SVG)};
  var bikeSvg=${JSON.stringify(BIKE_SVG)};
  var selectedId=null;
  var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:false});
  L.tileLayer(${JSON.stringify(tileUrl)},{subdomains:'abcd',maxZoom:20}).addTo(map);
  var markerLayer=L.layerGroup().addTo(map);
  var markerById={};
  function send(payload){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}}
  function price(value){return value>=1000000?(Math.round(value/100000)/10)+'tr':Math.round(value/1000)+'k';}
  function popupFor(vehicle){
    var root=document.createElement('div');root.className='vehicle-popup';
    if(vehicle.featuredImage&&(vehicle.featuredImage.indexOf('https://')===0||vehicle.featuredImage.indexOf('http://')===0)){
      var image=document.createElement('img');image.src=vehicle.featuredImage;image.alt='';root.appendChild(image);
    }
    var name=document.createElement('strong');name.textContent=vehicle.name;root.appendChild(name);
    var daily=document.createElement('span');daily.className='daily';daily.textContent=price(vehicle.price)+'/ngày';root.appendChild(daily);
    if(vehicle.totalPrice!=null){
      var total=document.createElement('span');total.className='detail';total.textContent='Tổng tiền thuê: '+Math.round(vehicle.totalPrice).toLocaleString('vi-VN')+'đ';root.appendChild(total);
    }
    if(vehicle.distanceKm!=null){
      var distance=document.createElement('span');distance.className='detail';distance.textContent='Cách điểm nhận '+vehicle.distanceKm.toFixed(1)+' km';root.appendChild(distance);
    }
    var button=document.createElement('button');button.type='button';button.textContent='Xem xe';
    button.addEventListener('click',function(event){event.stopPropagation();send({type:'open',id:vehicle.id});});
    root.appendChild(button);return root;
  }
  function renderMarkers(){
    markerLayer.clearLayers();
    markerById={};
    var groups={};
    points.forEach(function(point){
      var pixel=map.project([point.latitude,point.longitude],map.getZoom());
      var key=Math.floor(pixel.x/90)+':'+Math.floor(pixel.y/65);
      (groups[key]||(groups[key]=[])).push(point);
    });
    Object.keys(groups).forEach(function(key){
      var group=groups[key];
      var latitude=group.reduce(function(sum,p){return sum+p.latitude;},0)/group.length;
      var longitude=group.reduce(function(sum,p){return sum+p.longitude;},0)/group.length;
      var clustered=group.length>1;
      var active=group.some(function(p){return p.id===selectedId;});
      var vehicle=group[0];
      var symbol=clustered||vehicle.vehicleType==='Car'?carSvg:bikeSvg;
      var html='<div class="vehicle-pin'+(clustered?' cluster':'')+(active?' selected':'')+'"><span class="symbol">'+symbol+'</span>'
        +(clustered?'<span class="count">'+group.length+' xe</span>':'<span class="price">'+price(vehicle.price)+'/ngày</span>')+'</div>';
      var icon=L.divIcon({className:'',html:html,iconSize:[94,clustered?44:65],iconAnchor:[47,20],popupAnchor:[0,-16]});
      var marker=L.marker([latitude,longitude],{icon:icon});
      if(!clustered){marker.bindPopup(function(){return popupFor(vehicle);},{minWidth:220,maxWidth:240,autoPanPaddingBottomRight:[10,80]});markerById[vehicle.id]=marker;}
      marker.on('click',function(){
        if(clustered){
          if(map.getZoom()<17){map.setView([latitude,longitude],Math.min(map.getZoom()+2,17));}
          else{send({type:'cluster',ids:group.map(function(p){return p.id;})});}
        }else{
          selectedId=vehicle.id;
          renderMarkers();
          if(markerById[vehicle.id])markerById[vehicle.id].openPopup();
          send({type:'select',id:vehicle.id});
        }
      });
      marker.addTo(markerLayer);
    });
  }
  if(pickup){
    L.circle([pickup.latitude,pickup.longitude],{radius:radiusKm*1000,color:${JSON.stringify(brandColor)},fillOpacity:0.07,weight:2}).addTo(map);
    L.marker([pickup.latitude,pickup.longitude],{
      icon:L.divIcon({className:'',html:'<span class="pickup-dot"></span>',iconSize:[14,14],iconAnchor:[7,7]}),
      zIndexOffset:1000
    }).bindPopup('Điểm nhận xe bạn chọn').addTo(map);
    map.fitBounds(L.latLng(pickup.latitude,pickup.longitude).toBounds(radiusKm*2000),{padding:[24,24],maxZoom:14});
  }else if(points.length){
    map.fitBounds(L.latLngBounds(points.map(function(p){return [p.latitude,p.longitude];})),{padding:[38,38],maxZoom:13});
  }else{
    map.setView([16.05,108.1],6);
  }
  map.on('zoomend',renderMarkers);
  renderMarkers();
  window.focusVehicle=function(id){
    var point=points.find(function(p){return p.id===Number(id);});
    if(!point)return;
    selectedId=point.id;
    map.setView([point.latitude,point.longitude],Math.max(map.getZoom(),16),{animate:false});
    renderMarkers();
    if(markerById[point.id])markerById[point.id].openPopup();
    else L.popup({minWidth:220,maxWidth:240,autoPanPaddingBottomRight:[10,80]}).setLatLng([point.latitude,point.longitude]).setContent(popupFor(point)).openOn(map);
  };
  window.focusPickup=function(){if(pickup){map.fitBounds(L.latLng(pickup.latitude,pickup.longitude).toBounds(radiusKm*2000),{padding:[24,24],maxZoom:14});}};
  setTimeout(function(){map.invalidateSize();},100);
  send({type:'ready'});
})();
</script></body></html>`;
}
