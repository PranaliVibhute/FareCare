// Driver-side visual route guide. Illustrative straight segments between fare anchors;
// no routing engine, road matching, live tracking or actual navigation.
(async()=>{
 const target=document.getElementById('driverMap');if(!target)return;
 const status=document.getElementById('driverMapStatus'),near=document.getElementById('driverNearbyStops'),stops=document.getElementById('driverRouteStops');
 if(typeof L==='undefined'){status.textContent='Map library unavailable. Check internet access.';return;}
 const names=['PCMC Metro Station','I-Venus / Physics Wallah','Chapekar Chowk','Walhekarwadi','K-Town Gate','Mukai Chowk','Ravet Chowk','VIT Pune Gate','Bibwewadi','Swargate','Mandai'];
 const queries=['PCMC Metro Station, Pimpri Chinchwad, Maharashtra, India','Physics Wallah Chinchwad Station, Pune, Maharashtra, India','Chapekar Chowk, Chinchwad, Maharashtra, India','Walhekarwadi, Pimpri Chinchwad, Maharashtra, India','K Town Gate, Ravet, Pune, Maharashtra, India','Mukai Chowk, Ravet, Pune, Maharashtra, India','Ravet Chowk, Ravet, Pune, Maharashtra, India','Vishwakarma Institute of Technology Bibwewadi Main Gate, Pune, Maharashtra, India','Bibwewadi, Pune, Maharashtra, India','Swargate, Pune, Maharashtra, India','Mahatma Phule Mandai, Pune, Maharashtra, India'];
 const configuredCoordinates={"PCMC Metro Station":[18.629,73.7999],"I-Venus / Physics Wallah":[18.638,73.7978],"Chapekar Chowk":[18.6462,73.797],"Walhekarwadi":[18.6588,73.78],"K-Town Gate":[18.653,73.741],"Mukai Chowk":[18.6565,73.744],"Ravet Chowk":[18.647,73.753],"VIT Pune Gate":[18.464152,73.867668],"Bibwewadi":[18.472,73.863],"Swargate":[18.5018,73.8585],"Mandai":[18.5155,73.8564]};
 const routes=[{points:names.slice(0,4),fares:[20,10,10]},{points:names.slice(4,7),fares:[10,20]},{points:names.slice(7,11),fares:[10,10,10]}];
 const palette=['#e11d48','#0d9488','#7c3aed','#ea580c','#2563eb','#db2777','#0891b2'];
 const map=L.map(target,{scrollWheelZoom:false}).setView([18.464152,73.867668],14);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
 new ResizeObserver(()=>map.invalidateSize()).observe(target);
 const coord=new Map(),markers=new Map(),lines=L.layerGroup().addTo(map);let gps=null,gpsMarker=null,driverPoint=null,selected=null;
 function pin(i){const color=palette[i%palette.length];return L.divIcon({className:'farecare-pin',html:`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 2C8 2 2 9 2 18c0 11 15 24 15 24s15-13 15-24C32 9 26 2 17 2Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="17" cy="17" r="6" fill="white"/></svg>`,iconSize:[34,44],iconAnchor:[17,42]});}
 function distance(a,b){const rad=Math.PI/180,dy=(b[0]-a[0])*rad,dx=(b[1]-a[1])*rad,h=Math.sin(dy/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dx/2)**2;return 12742*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
 function render(){lines.clearLayers();const route=selected?routes.find(r=>r.points.includes(selected.pickup)&&r.points.includes(selected.destination)):routes.find(r=>r.points.includes(driverPoint));
  if(!route){status.textContent='Choose a driver location or select a ride to display its route.';return;}
  const a=selected?route.points.indexOf(selected.pickup):0,b=selected?route.points.indexOf(selected.destination):route.points.length-1;
  const available=route.points.filter(n=>coord.has(n));const bounds=[];
  if(available.length>1){const full=available.map(n=>coord.get(n));L.polyline(full,{color:'#64748b',weight:4,dashArray:'7 7',opacity:.8}).addTo(lines);bounds.push(...full);}
  const journey=route.points.slice(Math.min(a,b),Math.max(a,b)+1).filter(n=>coord.has(n));if(b<a)journey.reverse();if(journey.length>1)L.polyline(journey.map(n=>coord.get(n)),{color:'#059669',weight:7,opacity:.9}).addTo(lines);
  stops.replaceChildren();route.points.forEach((n,i)=>{const button=document.createElement('button');button.type='button';button.className='farecare-pin-button';const dot=document.createElement('span');dot.className='farecare-pin-dot';dot.style.background=palette[names.indexOf(n)%palette.length];button.append(dot,document.createTextNode(`${n}${i<route.fares.length?' · next ₹'+route.fares[i]:''}${i>=Math.min(a,b)&&i<=Math.max(a,b)?' · ride path':''}`));button.addEventListener('click',()=>{if(coord.has(n)){map.setView(coord.get(n),15);markers.get(n).openPopup();}});stops.appendChild(button);});
  if(selected){status.textContent=`Ride FC${selected.id}: ${selected.pickup} → ${selected.destination}. Green line = selected ride fare-point sequence; dashed line = full common corridor. This is NOT a road-following route.`;}
  else status.textContent=`Showing all common stops on ${route.points[0]} → ${route.points.at(-1)}. Select a passenger request to highlight the Ride Initiator's path.`;
  if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:14});setTimeout(()=>map.invalidateSize(),80);
 }
 function nearby(){if(!gps)return;const list=[...coord].map(([name,ll])=>({name,km:distance(gps,ll)})).filter(x=>x.km<=15).sort((a,b)=>a.km-b.km);near.textContent=list.length?'Common stops within 15 km (straight-line): '+list.map(x=>`${x.name} (${x.km.toFixed(1)} km)`).join(' · '):'No mapped common stops within 15 km.';}
 document.addEventListener('farecare:driver-gps',e=>{gps=[e.detail.lat,e.detail.lng];if(gpsMarker)map.removeLayer(gpsMarker);gpsMarker=L.circleMarker(gps,{radius:11,color:'#1d4ed8',weight:3,fillColor:'#60a5fa',fillOpacity:1}).addTo(map).bindPopup('LIVE DRIVER LOCATION / PICKUP REFERENCE (browser GPS; approximate)');map.setView(gps,13);nearby();});
 document.addEventListener('farecare:driver-point',e=>{driverPoint=e.detail.name;if(!selected)render();});
 document.addEventListener('farecare:driver-ride',e=>{selected=e.detail;render();target.scrollIntoView({behavior:'smooth',block:'center'});});
 driverPoint=document.getElementById('driverPoint')?.value;
 render();
 for(let i=0;i<names.length;i++){
   const ll=configuredCoordinates[names[i]];
   if(!ll)continue;
   coord.set(names[i],ll);
   const marker=L.marker(ll,{icon:pin(i),title:names[i]}).addTo(map).bindPopup(names[i]);
   markers.set(names[i],marker);
   marker.on('click',()=>{const r=routes.find(x=>x.points.includes(names[i]));if(r){selected=null;driverPoint=names[i];render();}});
 }
 render();nearby();
})();
