// FareCare hackathon map: OpenStreetMap tiles + Leaflet, browser geolocation,
// and Nominatim landmark geocoding. Map data is external; no API key required.
// Geocoding is intentionally rate-limited and cached per browser session.
(async function(){
 const status=document.getElementById('mapStatus'), target=document.getElementById('farecareMap');
 if(!target)return;
 if(typeof L==='undefined'){status.textContent='Map library unavailable. Check your internet connection.';return;}
 const map=L.map(target,{scrollWheelZoom:false}).setView([18.464152,73.867668],14);
 requestAnimationFrame(()=>map.invalidateSize({pan:false}));
 window.addEventListener("resize",()=>map.invalidateSize({pan:false}));
 new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(target);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
 const landmarks=['PCMC Metro Station, Pimpri Chinchwad, Maharashtra, India','Physics Wallah Chinchwad Station, Pune, Maharashtra, India','Chapekar Chowk, Chinchwad, Maharashtra, India','Walhekarwadi, Pimpri Chinchwad, Maharashtra, India','K Town Gate, Ravet, Pune, Maharashtra, India','Mukai Chowk, Ravet, Pune, Maharashtra, India','Ravet Chowk, Ravet, Pune, Maharashtra, India','Vishwakarma Institute of Technology Bibwewadi Main Gate, Pune, Maharashtra, India','Bibwewadi, Pune, Maharashtra, India','Swargate, Pune, Maharashtra, India','Mahatma Phule Mandai, Pune, Maharashtra, India'];
 const names=['PCMC Metro Station','I-Venus / Physics Wallah','Chapekar Chowk','Walhekarwadi','K-Town Gate','Mukai Chowk','Ravet Chowk','VIT Pune Gate','Bibwewadi','Swargate','Mandai'];
 const configuredCoordinates={"PCMC Metro Station":[18.629,73.7999],"I-Venus / Physics Wallah":[18.638,73.7978],"Chapekar Chowk":[18.6462,73.797],"Walhekarwadi":[18.6588,73.78],"K-Town Gate":[18.653,73.741],"Mukai Chowk":[18.6565,73.744],"Ravet Chowk":[18.647,73.753],"VIT Pune Gate":[18.464152,73.867668],"Bibwewadi":[18.472,73.863],"Swargate":[18.5018,73.8585],"Mandai":[18.5155,73.8564]};
 const coords=[];let user=null,selectingDrop=false,dropMarker=null;
 // Colored, high-contrast 30px pins: explicit icon avoids missing default Leaflet PNGs.
 const palette=['#e11d48','#0d9488','#7c3aed','#ea580c','#2563eb','#db2777','#0891b2'];
 function farePin(index){
   const color=palette[index%palette.length];
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 2C8 2 2 9 2 18c0 11 15 24 15 24s15-13 15-24C32 9 26 2 17 2Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="17" cy="17" r="6" fill="white"/></svg>`;
   return L.divIcon({className:'farecare-pin',html:svg,iconSize:[34,44],iconAnchor:[17,42],popupAnchor:[0,-38]});
 }
 const pinList=document.createElement('div');pinList.className='farecare-pin-list';pinList.setAttribute('aria-label','Available common-point map pins');
 target.closest('.map-viewport')?.insertAdjacentElement('afterend',pinList);
 function renderPinList(){
   pinList.replaceChildren();
   for(const point of coords){
     const button=document.createElement('button');button.type='button';button.className='farecare-pin-button';
     const dot=document.createElement('span');dot.className='farecare-pin-dot';dot.style.background=palette[point.index%palette.length];
     button.append(dot,document.createTextNode(point.name));
     button.addEventListener('click',()=>{map.setView(point.ll,15);point.marker.openPopup();selectPin(point.name);});
     pinList.appendChild(button);
   }
 }
 
 document.addEventListener('farecare:enable-map-drop',()=>{selectingDrop=true;status.textContent='Click a location on the map for Person A destination.'});
 map.on('click',e=>{if(!selectingDrop)return;selectingDrop=false;const {lat,lng}=e.latlng;if(dropMarker)map.removeLayer(dropMarker);dropMarker=L.marker([lat,lng]).addTo(map).bindPopup('Your selected destination').openPopup();document.dispatchEvent(new CustomEvent('farecare:map-drop',{detail:{lat,lng}}));status.textContent='Destination selected on map; choose a fare anchor to calculate price.'});
 document.addEventListener("farecare:pickup-gps",e=>{const {lat,lng}=e.detail||{};if(Number.isFinite(lat)&&Number.isFinite(lng)){map.setView([lat,lng],14);map.invalidateSize({pan:false});}});
 function selectPin(name){
   document.dispatchEvent(new CustomEvent('farecare:select-dropoff',{detail:{name}}));
 }
 function safeName(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function geocode(q){
   const cacheKey='fcgeo:v2:'+q;const cached=sessionStorage.getItem(cacheKey);
   if(cached)return JSON.parse(cached);
   const response=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q));
   if(!response.ok)throw Error('Geocoding unavailable');
   const data=await response.json();const result=data.length?[Number(data[0].lat),Number(data[0].lon)]:null;
   if(result)sessionStorage.setItem(cacheKey,JSON.stringify(result));return result;
 }
 const distance=(a,b)=>{const rad=Math.PI/180,dl=(b[1]-a[1])*rad,dp=(b[0]-a[0])*rad;const x=Math.sin(dp/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dl/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
 function nearby(){
  if(!user)return;
  const found=coords.filter(Boolean).map(x=>({...x,km:distance(user,x.ll)})).sort((a,b)=>a.km-b.km);
  const near=found.filter(x=>x.km<=15);
  document.getElementById('nearbyPoints').textContent=near.length?'Within 15 km (click a pin to select drop-off): '+near.map(x=>`${x.name} (${x.km.toFixed(1)} km)`).join(' · '):'No geocoded FareCare points found within 15 km.';
  document.dispatchEvent(new CustomEvent('farecare:nearby',{detail:{locationAvailable:true,within15km:near.map(x=>x.name)}}));
 }
 document.getElementById('locateMe').addEventListener('click',()=>{
   if(!navigator.geolocation){status.textContent='Geolocation is unavailable in this browser.';return;}
   status.textContent='Requesting your location permission…';
   navigator.geolocation.getCurrentPosition(pos=>{
     user=[pos.coords.latitude,pos.coords.longitude];L.circleMarker(user,{radius:9,color:'#2563eb',fillOpacity:0.9}).addTo(map).bindPopup('Your current location (approximate)');map.setView(user,13);setTimeout(()=>map.invalidateSize(),100);status.textContent='Location found. Showing nearby configured fare points.';nearby();
   },err=>{status.textContent='Location unavailable or permission denied: '+err.message;},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
 });
 status.textContent='Displaying configured FareCare stop pins…';
 for(let i=0;i<names.length;i++){
   const pointName=names[i],ll=configuredCoordinates[pointName];
   if(!ll)continue;
   const marker=L.marker(ll,{icon:farePin(i),title:pointName,riseOnHover:true}).addTo(map);
   coords.push({name:pointName,ll,index:i,marker});
   marker.bindPopup(`<strong>${safeName(pointName)}</strong><br>Tap pin to choose drop-off`);
   marker.on('click',()=>selectPin(pointName));
 }
 renderPinList();
 if(coords.length){renderPinList();map.setView(configuredCoordinates['VIT Pune Gate'],14);setTimeout(()=>map.invalidateSize(),150);status.textContent=`Map centered near VIT Pune Gate (demo starting view). Click Use my current location to verify your actual GPS pickup within 1 km.`;nearby();}
 else status.textContent='Map points could not be located. Check internet and geocoding access; fare dropdowns still work.';
})();
