const API="http://127.0.0.1:8000";
const getSession=()=>{try{return JSON.parse(sessionStorage.getItem("farecare_session"))}catch{return null}};
const setSession=s=>sessionStorage.setItem("farecare_session",JSON.stringify(s));
const money=p=>"₹"+(p/100).toLocaleString("en-IN",{maximumFractionDigits:2});
const el=id=>document.getElementById(id);
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(text,bad=false){const m=el("message");if(m){m.textContent=text;m.className="message"+(bad?" error":"")}}
async function request(path,method="GET",body){const res=await fetch(API+path,{method,headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Error(typeof data.detail==="string"?data.detail:JSON.stringify(data.detail||data));return data}
function fail(e){message("API error: "+e.message,true)}
// FareCare: initiator starts at a private-auto demo quote, reduced only when joining passengers board.
async function setupFarePoints(){
 const data=await request("/routes");
 const routes=data.routes||[];
 if(!routes.length)throw Error("No configured fare routes found");
 const pickup=el("pickup"),destination=el("destination");
 if(!pickup||!destination)throw Error("Booking form fare-point fields are missing. Refresh the page.");
 const pickupSearch=el("pickupSearch"),destinationSearch=el("destinationSearch");
 const alphabetical=(a,b)=>a.localeCompare(b,"en",{sensitivity:"variant"});
 const allPickups=[...new Set(routes.flatMap(r=>r.points))].sort(alphabetical);
 const isSharedAuto=new URLSearchParams(location.search).get("vehicle")?.toLowerCase()!=="sedan" && new URLSearchParams(location.search).get("vehicle")?.toLowerCase()!=="xuv" && new URLSearchParams(location.search).get("vehicle")?.toLowerCase()!=="parcel";
 let allowedPickups=null;
 const norm=s=>String(s).trim().toLocaleLowerCase("en"); // Case-insensitive prefix filtering
 function allowedNames(){return allowedPickups===null?allPickups:allPickups.filter(n=>allowedPickups.has(n));}
 function applyNearby(e){
  if(!isSharedAuto)return;
  const {within15km,locationAvailable}=e.detail||{};
  // Nearby GPS results are suggestions, not a hard restriction on fare anchors.
  // Geocoding can be delayed or fail, and the passenger's GPS position can lie
  // between fare points. Never make the destination selector unusable.
  allowedPickups=null;
  // GPS location can be roadside; do not discard the manually selected fare anchor.
  // Distance filtering is informative, not proof of road-route eligibility.
  updatePickups();
  const radius=el("radiusStatus");
  if(radius)radius.textContent=locationAvailable
    ? `${(within15km||[]).length} nearby mapped point(s) within 15 km. Select your route's pickup fare anchor below; all configured anchors remain available.`
    : "Select your pickup fare anchor to enable downstream drop-offs.";
 }
 document.addEventListener("farecare:nearby",applyNearby);
 // Map pins select drop-off points; do not silently change the pickup.
 document.addEventListener("farecare:select-dropoff",e=>{
  const name=e.detail?.name;
  if(!pickup.value){
   const status=el("mapStatus");if(status)status.textContent="First select the nearest pickup fare anchor from the dropdown; then choose a destination pin in either direction.";
   pickup.focus();
   return;
  }
  if(!destinationsFor(pickup.value).includes(name)){
   const status=el("mapStatus");if(status)status.textContent=`${name} is not a valid drop-off on the selected route from ${pickup.value}.`;
   return;
  }
  if(destinationSearch)destinationSearch.value="";
  updateDestinations();destination.value=name;render();
  const status=el("mapStatus");if(status)status.textContent=`Drop-off selected: ${name}. Fare updated below.`;
  destination.scrollIntoView({behavior:"smooth",block:"center"});
 });

 function fill(select,values,current,placeholder){
  select.replaceChildren();
  const blank=new Option(placeholder,"");select.add(blank);
  values.forEach(name=>select.add(new Option(name,name)));
  if(values.includes(current))select.value=current;
 }
 function destinationsFor(point){
  return [...new Set(routes.flatMap(r=>{const i=r.points.indexOf(point);return i>=0?[...r.points.slice(0,i),...r.points.slice(i+1)]:[]}))].sort(alphabetical);
 }
 function render(){
  const p=pickup.value,d=destination.value;
  const route=routes.find(r=>r.points.indexOf(p)>=0&&r.points.indexOf(d)!==r.points.indexOf(p));
  const summary=el("corridorSummary"),stops=el("corridorStops");
  if(!summary||!stops)return;
  if(!route){summary.textContent="Select a valid pickup and drop-off main fare point";stops.replaceChildren();return;}
  const a=route.points.indexOf(p),b=route.points.indexOf(d);
  const lo=Math.min(a,b),hi=Math.max(a,b);
  const price=route.segment_paise.slice(lo,hi).reduce((sum,n)=>sum+n,0);
  summary.textContent=(el("journeyKind")?.value==="joiner"?`Ride Joiner segment fare: ${money(price)}`:`Ride Initiator: private-auto demo quote ₹100; shared-auto minimum ${money(price)}. Boarded joiners reduce the private fare, never below this minimum.`);
  const step=b>a?1:-1;const journey=[];for(let j=a;;j+=step){journey.push(j);if(j===b)break;}
  stops.innerHTML=journey.map((idx,i)=>`<div class="corridor-stop"><span class="corridor-pin">${i+1}</span><div class="corridor-stop-body"><strong>${escapeHtml(route.points[idx])}</strong>${i<journey.length-1?`<div class="corridor-segment">To ${escapeHtml(route.points[idx+step])}<b>${money(route.segment_paise[Math.min(idx,idx+step)])}</b></div>`:""}</div></div>`).join("");
 }
 function updateDestinations(){
  const valid=destinationsFor(pickup.value);
  const q=norm(destinationSearch?.value||"");
  const old=destination.value;
  fill(destination,valid.filter(name=>norm(name).startsWith(q)),old,"Select drop-off point");
  render();
 }
 function updatePickups(){
  const q=norm(pickupSearch?.value||"");
  const old=pickup.value;
  fill(pickup,allowedNames().filter(name=>norm(name).startsWith(q)),old,"Select pickup point");
  updateDestinations();
 }
 pickupSearch?.addEventListener("input",updatePickups);
 destinationSearch?.addEventListener("input",updateDestinations);
 pickup.addEventListener("change",()=>{if(destinationSearch)destinationSearch.value="";updateDestinations()});
 destination.addEventListener("change",render);
 fill(pickup,allowedNames(),"","Select pickup point");
 fill(destination,[],"","Select pickup first");
 render();
}

document.addEventListener("DOMContentLoaded",()=>{
 const params=new URLSearchParams(location.search),vehicle=(params.get("vehicle")||"auto").toLowerCase();
 const vehicles={auto:["Auto","Auto.png"],sedan:["Sedan","Sedan.png"],xuv:["XUV","XUV.png"],parcel:["Parcel","Parcel.png"]};
 if(el("bookingTitle")){const [label,img]=vehicles[vehicle]||vehicles.auto;el("bookingTitle").textContent=label+" booking";el("vehicleImage").src="images/"+img;if(vehicle==="parcel"){el("passengers").closest("label").hidden=true;el("ridePreference").closest("label").hidden=true}}
 document.querySelectorAll("[data-role]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-role]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");const role=btn.dataset.role;el("signupRole").value=role;el("driverFields").hidden=role!=="driver";el("passengerGender").hidden=role!=="passenger";el("signupGender").required=role==="passenger";["licence","vehicleReg"].forEach(id=>el(id).required=role==="driver")}));
 if(el("signupForm"))el("signupForm").addEventListener("submit",async e=>{e.preventDefault();const role=el("signupRole").value;try{const data=await request("/auth/signup","POST",{name:el("name").value,email:el("signupEmail").value.trim(),phone:el("phone").value,password:el("signupPassword").value,role,gender:role==="passenger"?el("signupGender").value:null,licence_number:role==="driver"?el("licence").value:null,vehicle_registration:role==="driver"?el("vehicleReg").value:null,vehicle_type:role==="driver"?el("vehicleType").value:null});message("Account created in backend. Please log in."+(data.approval_required?" Driver approval is pending.":""));setTimeout(()=>location.href="login.html",1100)}catch(err){fail(err)}});
 if(el("loginForm"))el("loginForm").addEventListener("submit",async e=>{e.preventDefault();try{const role=el("role").value;const data=await request("/auth/login","POST",{email:el("email").value.trim(),password:el("password").value,role});setSession(data);location.href=role==="driver"?"driver.html":"passenger.html"}catch(err){fail(err)}});
 if(el("corridorPanel"))setupFarePoints().catch(fail);
 if(el("bookingForm")){
   let gpsPickup=null, mapDropoff=null;
   const kind=()=>document.querySelector('input[name="journeyKind"]:checked')?.value||"initiator";
   function updateKind(){
     const joining=kind()==="joiner";
     el("actualDropoff").disabled=joining;
     el("actualDropoff").value=joining?"":el("actualDropoff").value;
     el("actualDropoffLabel").hidden=joining;
     el("chooseMapDrop").hidden=joining;
     el("pickupLocationStatus").textContent=gpsPickup?`GPS pickup recorded (${gpsPickup.lat.toFixed(5)}, ${gpsPickup.lng.toFixed(5)}). Select the pricing anchor below.`:(joining?"Ride Joiner: use current location, then select a fare anchor and a drop-off from the list. Route eligibility requires driver verification.":"Ride Initiator: use current location or enter a pickup landmark, then select a fare anchor for pricing.");
   }
   document.querySelectorAll('input[name="journeyKind"]').forEach(x=>x.addEventListener("change",updateKind));
   el("usePickupLocation").addEventListener("click",()=>{
     if(!navigator.geolocation){message("Browser geolocation is unavailable.",true);return;}
     el("pickupLocationStatus").textContent="Requesting GPS location…";
     navigator.geolocation.getCurrentPosition(pos=>{
       gpsPickup={lat:pos.coords.latitude,lng:pos.coords.longitude};
       el("actualPickup").value=`GPS: ${gpsPickup.lat.toFixed(6)}, ${gpsPickup.lng.toFixed(6)}`;
       document.dispatchEvent(new CustomEvent("farecare:pickup-gps",{detail:gpsPickup}));
       updateKind();
     },err=>{el("pickupLocationStatus").textContent="Location failed: "+err.message;},{enableHighAccuracy:true,timeout:12000});
   });
   el("chooseMapDrop").addEventListener("click",()=>{document.dispatchEvent(new CustomEvent("farecare:enable-map-drop"));el("dropoffGpsStatus").textContent="Click anywhere on the map to choose Ride Initiator's destination."});
   document.addEventListener("farecare:map-drop",e=>{if(kind()!=="initiator")return;mapDropoff=e.detail;el("actualDropoff").value=`Map: ${mapDropoff.lat.toFixed(6)}, ${mapDropoff.lng.toFixed(6)}`;el("dropoffGpsStatus").textContent="Map destination saved. Select the corresponding downstream fare anchor for pricing."});
   const pinkCheckbox=el('pinkMode');
   const pinkSession=getSession();
   if(pinkSession?.gender!=='woman'){
     pinkCheckbox.disabled=true;
     el('pinkModeNotice').textContent='Pink Mode unavailable: this passenger account is not registered as a woman. Existing accounts without gender must be updated.';
   }
   updateKind();
   const today=new Date();el("travelDate").min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;el("bookingForm").insertAdjacentHTML("beforeend",'<label><input id="pinkMode" type="checkbox" style="width:auto"> Pink Mode (women-only ride matching)</label><p id="pinkModeNotice" class="muted">Pink Mode is available only to passenger accounts registered as women.</p>');el("bookingForm").addEventListener("submit",async e=>{e.preventDefault();const s=getSession();if(!s||s.role!=="passenger"){message("Please sign up and log in as a passenger before booking.",true);return}try{
    if(!gpsPickup){message("Use your current GPS location as pickup before booking.",true);return;}
    if(!el("pickup").value||!el("destination").value){message("Select a valid fare anchor and a drop-off from the dropdown; typing alone is not selection.",true);return;}
    const anchorResponse=await request("/routes/pickup-anchors");
    const anchorName=Object.keys(anchorResponse.coordinates).find(n=>n.toLowerCase()===el("pickup").value.toLowerCase());
    if(!anchorName){message("Choose a configured pickup point.",true);return;}
    const hav=(a,b,c,d)=>{const rad=Math.PI/180,dy=(c-a)*rad,dx=(d-b)*rad,h=Math.sin(dy/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dx/2)**2;return 12742*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
    const point=anchorResponse.coordinates[anchorName],km=hav(gpsPickup.lat,gpsPickup.lng,point.lat,point.lng);
    if(km>1.0){const near=Object.entries(anchorResponse.coordinates).map(([name,p])=>({name,km:hav(gpsPickup.lat,gpsPickup.lng,p.lat,p.lng)})).sort((a,b)=>a.km-b.km)[0];message(`Pickup unavailable: ${anchorName} is ${km.toFixed(1)} km away. Maximum distance: 1 km. Nearest stop: ${near.name} (${near.km.toFixed(1)} km).`,true);return;}
    const data=await request("/rides","POST",{user_id:s.user_id,vehicle,pickup:el("pickup").value,destination:el("destination").value,date:el("travelDate").value,time:el("travelTime").value,passengers:vehicle==="parcel"?1:Number(el("passengers").value),preference:vehicle==="parcel"?"private":el("ridePreference").value,actual_pickup:el("actualPickup").value,actual_dropoff:kind()==="joiner"?"":el("actualDropoff").value,pink_mode:el("pinkMode").checked,journey_kind:kind(),pickup_lat:gpsPickup.lat,pickup_lng:gpsPickup.lng,dropoff_lat:kind()==="initiator"?mapDropoff?.lat:null,dropoff_lng:kind()==="initiator"?mapDropoff?.lng:null});message(`Booking #${data.ride.id} saved. ${kind()==="joiner"?"Roadside pickup is NOT GPS-route verified; driver must verify location before acceptance.":""}  ${data.matched?"Compatible passenger found!":"Awaiting driver review."} Initial fare: ${money(data.ride.estimated_share_paise)}. Ride Initiator pays less only after joiners board; never below their shared-auto minimum. Driver must manually accept after simulated route checks.`)}catch(err){fail(err)}})}
 if(el("bookingHistory")){const s=getSession();if(!s){el("bookingHistory").textContent="Log in to see bookings."}else request("/rides/user/"+s.user_id).then(data=>{el("bookingHistory").innerHTML=data.rides.length?data.rides.map(r=>`<article class="history-item"><div><strong>${escapeHtml(r.vehicle.toUpperCase())} · ${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</strong><small>${escapeHtml(r.date)} ${escapeHtml(r.time)}${r.actual_pickup?" · Pickup: "+escapeHtml(r.actual_pickup):""}${r.actual_dropoff?" · Drop-off: "+escapeHtml(r.actual_dropoff):""} · ${r.passengers} passenger(s) · ${escapeHtml(r.status||"requested")} · Current payable ${money(r.estimated_share_paise)}${r.boarded?" · Boarded":""}</small></div><span>FC${r.id}</span></article>`).join(""):"<p>No bookings yet.</p>"}).catch(err=>el("bookingHistory").textContent=err.message)}
 if(el("ledger")){const s=getSession();if(!s||s.role!=="driver"){el("ledger").textContent="Log in as a driver to view billing.";el("payBtn").disabled=true}else request("/drivers/"+s.user_id+"/billing").then(d=>{el("balance").textContent=money(d.balance_paise);el("graceUsed").textContent=d.grace_used;el("graceBar").style.width=(d.grace_used/3*100)+"%";el("graceText").textContent=d.grace_remaining+" grace chances remaining";el("ledger").innerHTML=d.fees.map(f=>`<div class="ledger-row"><span>${escapeHtml(f.date)}</span><span>Fee ${money(f.fee_paise)} + penalty ${money(f.penalty_paise)}; paid ${money(f.paid_paise)}</span></div>`).join("");el("payBtn").disabled=true;el("payBtn").textContent="Payments disabled in demo"}).catch(err=>{el("ledger").textContent=err.message;el("payBtn").disabled=true})}
 document.querySelectorAll('a[href="login.html"]').forEach(a=>{if(a.textContent.trim().toLowerCase()==="logout")a.addEventListener("click",()=>sessionStorage.removeItem("farecare_session"))});
});

// Local hackathon driver dispatch simulation; requires a driver session.
if(document.getElementById('dispatchRequests')){
 const sess=getSession(), msg=document.getElementById('dispatchMessage');
 const say=(x,bad=false)=>{msg.textContent=x;msg.className='message'+(bad?' error':'')};
 const routePoints=[['PCMC Metro Station','I-Venus / Physics Wallah','Chapekar Chowk','Walhekarwadi'],['K-Town Gate','Mukai Chowk','Ravet Chowk'],['VIT Pune Gate','Bibwewadi','Swargate','Mandai']];
 const pointNames=routePoints.flat();
 const locationQueries=['PCMC Metro Station, Pimpri Chinchwad, Maharashtra, India','Physics Wallah Chinchwad Station, Pune, Maharashtra, India','Chapekar Chowk, Chinchwad, Maharashtra, India','Walhekarwadi, Pimpri Chinchwad, Maharashtra, India','K Town Gate, Ravet, Pune, Maharashtra, India','Mukai Chowk, Ravet, Pune, Maharashtra, India','Ravet Chowk, Ravet, Pune, Maharashtra, India','Vishwakarma Institute of Technology Bibwewadi Main Gate, Pune, Maharashtra, India','Bibwewadi, Pune, Maharashtra, India','Swargate, Pune, Maharashtra, India','Mahatma Phule Mandai, Pune, Maharashtra, India'];
 const routeFor=point=>routePoints.find(route=>route.includes(point));
 const kmBetween=(a,b)=>{const toRad=Math.PI/180,dy=(b[0]-a[0])*toRad,dx=(b[1]-a[1])*toRad;const h=Math.sin(dy/2)**2+Math.cos(a[0]*toRad)*Math.cos(b[0]*toRad)*Math.sin(dx/2)**2;return 12742*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
 const gpsStatus=document.getElementById('driverGpsStatus');
 let liveGps=false, lastGpsAt=0, watchId=null, lastAnchor=null, lastAnchorUpdate=0;
 const gpsButton=document.getElementById('driverGpsBtn');
 const driverSelect=document.getElementById('driverPoint');
 const actionReady=()=>liveGps&&Date.now()-lastGpsAt<60000;
 const setDispatchReady=()=>{
  const ready=actionReady();
  document.getElementById('progressBtn').disabled=!ready;
  document.getElementById('refreshRequests').disabled=!ready;
  driverSelect.disabled=true; // Position is GPS-derived; cannot be manually spoofed in this demo.
  document.querySelectorAll('.dispatch-action').forEach(b=>{b.disabled=!ready || (b.dataset.action==='accept' && b.dataset.eligible==='false');});
 };
 async function matchAnchor(driver){
  let anchors=[];
  for(let i=0;i<pointNames.length;i++){
   try{
    const key='fcgeo:v2:'+locationQueries[i];let ll=JSON.parse(sessionStorage.getItem(key)||'null');
    if(!ll){const response=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(locationQueries[i]));if(response.ok){const data=await response.json();if(data.length){ll=[Number(data[0].lat),Number(data[0].lon)];sessionStorage.setItem(key,JSON.stringify(ll));}}await new Promise(resolve=>setTimeout(resolve,1100));}
    if(ll)anchors.push({name:pointNames[i],distance:kmBetween(driver,ll)});
   }catch(e){}
  }
  anchors.sort((a,b)=>a.distance-b.distance);
  if(!anchors.length){gpsStatus.textContent='Live GPS active, but stop coordinates could not load. Check internet access.';return;}
  const best=anchors[0];
  if(best.distance>15){gpsStatus.textContent=`Live GPS active; closest stop ${best.name} is ${best.distance.toFixed(1)} km away (outside 15 km). Dispatch unavailable.`;liveGps=false;setDispatchReady();return;}
  lastAnchor=best.name;
  driverSelect.value=best.name;
  document.dispatchEvent(new CustomEvent('farecare:driver-point',{detail:{name:best.name}}));
  gpsStatus.textContent=`Live GPS active · nearest fare anchor: ${best.name} (${best.distance.toFixed(1)} km). GPS is not road matching; confirm route before any pickup.`;
  // Explicitly sync GPS-derived fare anchor with demo dispatch state.
  try{await request('/dispatch/progress','POST',{driver_user_id:sess.user_id,point:best.name});await refreshDispatch();}
  catch(e){say('GPS matched, but simulated dispatch update failed: '+e.message,true);}
 }
 function beginTracking(){
  if(!sess||sess.role!=='driver'){gpsStatus.textContent='Log in as a driver first.';return;}
  if(!navigator.geolocation){gpsStatus.textContent='Geolocation is unavailable. Driver dispatch is disabled.';return;}
  if(watchId!==null)return;
  gpsStatus.textContent='Requesting continuous GPS permission…';
  watchId=navigator.geolocation.watchPosition(pos=>{
   const driver=[pos.coords.latitude,pos.coords.longitude];
   lastGpsAt=Date.now();liveGps=true;
   document.dispatchEvent(new CustomEvent('farecare:driver-gps',{detail:{lat:driver[0],lng:driver[1],accuracy:pos.coords.accuracy}}));
   setDispatchReady();
   if(Date.now()-lastAnchorUpdate>30000){lastAnchorUpdate=Date.now();matchAnchor(driver);}
  },err=>{liveGps=false;lastGpsAt=0;watchId=null;setDispatchReady();gpsStatus.textContent='GPS permission or tracking failed: '+err.message+'. Driver dispatch is disabled until GPS works.';},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
 }
 gpsButton.addEventListener('click',beginTracking);
 setDispatchReady();
 setInterval(()=>{setDispatchReady();if(!actionReady()&&liveGps)gpsStatus.textContent='GPS update is stale. Waiting for a fresh location before dispatch.';},5000);
 document.getElementById('driverSameRouteOnly').addEventListener('change',refreshDispatch);

 async function refreshDispatch(){
  if(!sess||sess.role!=='driver'){say('Log in as a driver first.',true);return;}
  try{
   const [pending,assigned]=await Promise.all([request('/dispatch/requests/'+sess.user_id),request('/dispatch/assigned/'+sess.user_id)]);
   if(!lastAnchor){document.getElementById('driverPoint').value=pending.driver_point;}else{document.getElementById('driverPoint').value=lastAnchor;}document.dispatchEvent(new CustomEvent('farecare:driver-point',{detail:{name:driverSelect.value}}));
   const selectedRoute=routeFor(lastAnchor||pending.driver_point);
   const visibleRequests=document.getElementById('driverSameRouteOnly').checked?pending.requests.filter(r=>selectedRoute&&selectedRoute.includes(r.pickup)&&selectedRoute.includes(r.destination)):pending.requests;
   const fmt=r=>`<button type="button" class="driver-view-route" data-pickup="${escapeHtml(r.pickup)}" data-destination="${escapeHtml(r.destination)}" data-ride-id="${r.id}">Show route on map</button> <strong>FC${r.id} · ${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</strong><p class="tiny">${escapeHtml(r.date)} ${escapeHtml(r.time)} · ${r.passengers} seat(s) · ${money(r.estimated_share_paise)} current fare · ${escapeHtml(r.status||'requested')}</p>`;
   document.getElementById('dispatchRequests').innerHTML=visibleRequests.length?visibleRequests.map(r=>`<div class="ledger-row" style="display:block;padding:12px;border-bottom:1px solid #ddd">${fmt(r)}<p class="tiny">Actual pickup: ${escapeHtml(r.actual_pickup||'main point')} · Drop-off: ${escapeHtml(r.actual_dropoff||'main point')}</p><p class="tiny">${escapeHtml(r.reason)}</p>${r.parent_ride_id?`<p class="tiny">Joining confirmed ride FC${r.parent_ride_id}</p>`:''}${r.requires_extension_consent?`<label style="display:block;margin:8px 0"><input type="checkbox" class="extension-consent" data-id="${r.id}"> I agree to continue beyond the Ride Initiator's home to this Ride Joiner's downstream destination (demo route)</label>`:''}<button class="btn dispatch-action" data-id="${r.id}" data-action="accept" data-eligible="${r.eligible}" ${r.eligible?'':'disabled'}>Accept</button> <button class="btn dispatch-action" data-id="${r.id}" data-action="reject">Reject</button></div>`).join(''):'<p>No pending requests on this route. Uncheck the route filter to see other requests.</p>';
   document.getElementById('assignedRides').innerHTML=assigned.rides.length?assigned.rides.map(r=>`<div class="ledger-row" style="display:block;padding:12px;border-bottom:1px solid #ddd">${fmt(r)}${r.status==='confirmed'?`${!r.boarded?`<button class="btn dispatch-action" data-id="${r.id}" data-action="board">Confirm boarding</button>`:''} <button class="btn dispatch-action" data-id="${r.id}" data-action="complete">Mark completed</button>`:''}</div>`).join(''):'<p>No accepted rides yet.</p>';
   setDispatchReady();
  }catch(e){say(e.message,true)}
 }
 document.getElementById('progressBtn').addEventListener('click',async()=>{if(!actionReady()){say('Enable live GPS first.',true);return;}try{await request('/dispatch/progress','POST',{driver_user_id:sess.user_id,point:document.getElementById('driverPoint').value});say('Simulated position updated.');refreshDispatch()}catch(e){say(e.message,true)}});
 document.getElementById('refreshRequests').addEventListener('click',refreshDispatch);
 document.getElementById('driverPoint').addEventListener('change',e=>document.dispatchEvent(new CustomEvent('farecare:driver-point',{detail:{name:e.target.value}})));
 document.addEventListener('click',e=>{const b=e.target.closest('.driver-view-route');if(b)document.dispatchEvent(new CustomEvent('farecare:driver-ride',{detail:{pickup:b.dataset.pickup,destination:b.dataset.destination,id:b.dataset.rideId}}));});
 document.addEventListener('click',async e=>{const btn=e.target.closest('.dispatch-action');if(!btn)return;if(!actionReady()){say('A fresh GPS location is required.',true);return;}if(btn.dataset.action==='accept'&&btn.dataset.eligible==='false'){say('Cannot accept: pickup is behind your GPS-matched fare anchor. The passenger must request an eligible pickup.',true);return;}btn.disabled=true;try{await request(`/dispatch/rides/${btn.dataset.id}/${btn.dataset.action}`,'POST',{driver_user_id:sess.user_id,continue_beyond_initiator:btn.dataset.action==='accept'&&!!document.querySelector(`.extension-consent[data-id="${btn.dataset.id}"]:checked`)});say('Ride '+btn.dataset.action+' successful (simulation).');refreshDispatch()}catch(err){say(err.message,true);refreshDispatch()}});
 refreshDispatch();
 beginTracking();
 setInterval(()=>{if(document.visibilityState==='visible')refreshDispatch()},5000);
}

// Local hackathon-only driver login autofill. No automatic submission.
if(document.getElementById("fillDemoDriver")){document.getElementById("fillDemoDriver").addEventListener("click",()=>{document.getElementById("email").value="driver.demo@example.com";document.getElementById("password").value="FareCareDemo#2026";document.getElementById("role").value="driver";});}
