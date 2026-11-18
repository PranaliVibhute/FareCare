const API='http://127.0.0.1:8000';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=p=>'₹'+((p||0)/100).toLocaleString('en-IN',{maximumFractionDigits:2});
const notice=(msg,error=false)=>{ $('notice').textContent=msg;$('notice').className=error?'admin-error':'admin-ok';};
async function api(path,method='GET'){
 const res=await fetch(API+path,{method,headers:{'X-Admin-Key':$('key').value.trim()}});
 const body=await res.json();if(!res.ok)throw Error(body.detail||`HTTP ${res.status}`);return body;
}
async function load(){try{
 const [data,feeData]=await Promise.all([api('/admin/overview'),api('/admin/driver-fees')]);$('content').hidden=false;
 const labels={passengers:'Passengers',drivers:'Registered drivers',pending_drivers:'Pending approvals',rides:'Total rides',active_rides:'Active / requested rides',completed_rides:'Completed rides',recorded_fees_paise:'Recorded platform fees',recorded_payments_paise:'Recorded payments',outstanding_paise:'Outstanding fees'};
 $('metrics').innerHTML=Object.entries(labels).map(([k,label])=>`<div class="metric"><small>${label}</small><strong>${k.endsWith('_paise')?money(data.metrics[k]):safe(data.metrics[k])}</strong></div>`).join('');
 $('drivers').innerHTML=data.drivers.map(d=>`<tr><td>${safe(d.name)} <small>#${d.id}</small></td><td>${safe(d.vehicle)} (${safe(d.type)})</td><td class="status">${d.approved?'Approved':'Not approved'}</td><td><button class="smallbtn ${d.approved?'warn':''}" data-id="${d.id}" data-action="${d.approved?'suspend':'approve'}">${d.approved?'Suspend':'Approve'}</button></td></tr>`).join('')||'<tr><td colspan="4">No drivers registered</td></tr>';
 const feeLabels={paid:'Paid',unpaid:'Unpaid',penalty_due:'Penalty due (after 3 chances)',not_approved:'Awaiting approval',no_fees:'No fees yet'};
 $('feeCounts').innerHTML=Object.entries(feeLabels).map(([k,label])=>`<div class="metric"><small>${label}</small><strong>${feeData.counts[k]||0}</strong></div>`).join('');
 $('feeDrivers').innerHTML=feeData.drivers.map(d=>`<tr><td>${safe(d.name)} <small>#${d.driver_id} · ${safe(d.vehicle)}</small></td><td class="status">${safe(feeLabels[d.status]||d.status)}</td><td>${money(d.fee_paise)}</td><td>${money(d.paid_paise)}</td><td>${money(d.outstanding_paise)}</td><td>${d.grace_used}/3</td><td>${d.penalty_days} / ${money(d.penalty_paise)}</td><td>${d.last_payment?safe(new Date(d.last_payment).toLocaleString('en-IN')):'—'}</td></tr>`).join('')||'<tr><td colspan="8">No registered drivers. Example scenarios are displayed below.</td></tr>';
 $('rides').innerHTML=data.rides.map(r=>`<tr><td>#${r.id}</td><td>${safe(r.pickup)} → ${safe(r.destination)}</td><td>${safe(r.status)}</td><td>${safe(r.driver_user_id)}</td><td>${r.boarded?'Yes':'No'}</td><td>${money(r.fare_paise)}</td></tr>`).join('')||'<tr><td colspan="6">No rides yet</td></tr>';
 notice('Dashboard loaded. Data is read from the local backend.');
 }catch(e){$('content').hidden=true;notice(e.message,true);}}
$('load').addEventListener('click',load);$('refresh').addEventListener('click',load);
$('drivers').addEventListener('click',async e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;
 const action=b.dataset.action,id=b.dataset.id;
 if(!confirm(`${action==='approve'?'Approve':'Suspend'} driver #${id}?`))return;
 try{await api(`/admin/drivers/${id}/${action}`,'POST');await load();}catch(err){notice(err.message,true);}
});
