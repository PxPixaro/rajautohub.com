(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toUpperCase().replace(/\s+/g,' ');
  const naturalCompare=(a,b)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});
  const uniq=values=>[...new Set(values.map(clean).filter(Boolean))].sort(naturalCompare);
  const splitModelValues=value=>String(value??'').split(/[,;|\n]+/).map(clean).filter(Boolean);
  const modelMatches=(value,selected)=>!selected||splitModelValues(value).some(x=>norm(x)===norm(selected))||norm(value)===norm(selected);
  const SEGMENTS=['2 WHEEL','3 WHEEL','CAR','LCV','HCV','TRACTOR','EARTHMOVERS','AGRICULTURE PARTS'];
  let products=[],vehicleMap=[],visualMap=[],config={},selectedFile=null;

  document.addEventListener('DOMContentLoaded',init);

  async function init(){
    if(!$('#smartDiscovery'))return;
    try{
      const responses=await Promise.all([
        fetch('data/products.json').then(check),
        fetch('data/site-config.json').then(check).catch(()=>({})),
        fetch('data/vehicle-number-map.json').then(check).catch(()=>([])),
        fetch('data/visual-search-map.json').then(check).catch(()=>([]))
      ]);
      products=(responses[0]||[]).map((p,i)=>({...p,_id:p.id||`${p.code||'item'}-${i}`,_search:`${p.code||''} ${p.description||''} ${p.group||''} ${p.segment||''} ${p.vehicle||''} ${p.model||''} ${p.category||''} ${(p.categories||[]).join(' ')}`.toLowerCase()})).sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description));
      config=responses[1]||{};vehicleMap=normalizeVehicleMap(responses[2]);visualMap=Array.isArray(responses[3])?responses[3]:[];
      populateSegments();bindEvents();
      window.RAJSmartSelect?.init(['#smartSegment','#smartVehicle','#smartModel'].map(x=>document.querySelector(x)).filter(Boolean));
    }catch(error){
      console.warn('Smart search could not load',error);
      setMessage($('#registrationLookupResult'),'Smart search data could not load. Open the site through START_WEBSITE.bat.','error');
    }
  }

  function check(r){if(!r.ok)throw new Error(`${r.url}: ${r.status}`);return r.json();}
  function normalizeVehicleMap(data){
    if(Array.isArray(data))return data;
    if(data&&typeof data==='object')return Object.entries(data).map(([registration,value])=>({registration,...(value||{})}));
    return [];
  }
  function bindEvents(){
    $('#smartSegment')?.addEventListener('change',populateVehicles);
    $('#smartVehicle')?.addEventListener('change',populateModels);
    $('#smartSearchButton')?.addEventListener('click',searchMappedParts);
    $('#smartKeyword')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchMappedParts();}});
    $('#registrationSearchForm')?.addEventListener('submit',e=>{e.preventDefault();lookupRegistration();});
    $('#partImageButton')?.addEventListener('click',()=>$('#partImageInput')?.click());
    $('#partImageInput')?.addEventListener('change',onImageSelected);
    $('#partImageSearchButton')?.addEventListener('click',searchByImage);
    $('#clearPartImage')?.addEventListener('click',clearImage);
  }
  function populateSegments(){
    const values=uniq(SEGMENTS.concat(products.map(p=>p.segment)));
    $('#smartSegment').innerHTML='<option value="">Select Segment</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#smartSegment');populateVehicles();
  }
  function populateVehicles(){
    const segment=$('#smartSegment')?.value||'';
    const rows=products.filter(p=>!segment||norm(p.segment)===norm(segment));
    const values=uniq(rows.map(p=>p.vehicle));
    $('#smartVehicle').innerHTML='<option value="">Select Vehicle</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#smartVehicle');populateModels();
  }
  function populateModels(){
    const segment=$('#smartSegment')?.value||'',vehicle=$('#smartVehicle')?.value||'';
    const rows=products.filter(p=>(!segment||norm(p.segment)===norm(segment))&&(!vehicle||norm(p.vehicle)===norm(vehicle)));
    const values=uniq(rows.flatMap(p=>splitModelValues(p.model)));
    $('#smartModel').innerHTML='<option value="">Select Model</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#smartModel');
  }
  function searchMappedParts(){
    const params=new URLSearchParams();
    const segment=$('#smartSegment')?.value||'',vehicle=$('#smartVehicle')?.value||'',model=$('#smartModel')?.value||'',keyword=clean($('#smartKeyword')?.value);
    if(segment)params.set('segment',segment);if(vehicle)params.set('vehicle',vehicle);if(model)params.set('model',model);if(keyword)params.set('search',keyword);
    location.href='shop.html'+(params.toString()?`?${params}`:'')+'#shop';
  }

  async function lookupRegistration(){
    const raw=clean($('#registrationNumber')?.value);
    const registration=normalizeRegistration(raw);
    const result=$('#registrationLookupResult');
    if(registration.length<6){setMessage(result,'Please enter a valid vehicle registration number.','error');return;}
    setMessage(result,'Checking vehicle mapping…','');
    let match=vehicleMap.find(x=>normalizeRegistration(x.registration||x.number||x.vehicleNumber)===registration);
    if(!match&&clean(config.vehicleLookupApiUrl)){
      try{match=await callVehicleApi(registration);}catch(error){setMessage(result,`Vehicle lookup service error: ${error.message}`,'error');return;}
    }
    if(!match){
      setMessage(result,`No vehicle is mapped for ${raw.toUpperCase()}. Add it in DATA_INPUT/vehicle-number-map.json or connect an authorized vehicle lookup API.`,'error');return;
    }
    applyVehicleMatch(match);
    const title=clean(match.displayName||match.name)||[match.vehicle,match.model,match.year].filter(Boolean).join(' ')||registration;
    const count=countMatches(match);
    result.className='lookup-message success';
    result.innerHTML=`<b>${esc(title)}</b> identified. ${count.toLocaleString()} mapped catalogue products found. <button type="button" id="viewRegistrationProducts">View matching products →</button>`;
    $('#viewRegistrationProducts')?.addEventListener('click',searchMappedParts);
  }
  async function callVehicleApi(registration){
    const url=new URL(config.vehicleLookupApiUrl,location.href);url.searchParams.set('registration',registration);
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function applyVehicleMatch(match){
    const segment=findOptionValue('#smartSegment',match.segment);
    if(segment){$('#smartSegment').value=segment;populateVehicles();}
    const vehicle=findOptionValue('#smartVehicle',match.vehicle||match.make||match.maker);
    if(vehicle){$('#smartVehicle').value=vehicle;populateModels();}
    const model=findOptionValue('#smartModel',match.model||match.modelLine||match.variant);
    if(model)$('#smartModel').value=model;
    window.RAJSmartSelect?.refresh('#smartSegment');window.RAJSmartSelect?.refresh('#smartVehicle');window.RAJSmartSelect?.refresh('#smartModel');
  }
  function findOptionValue(selector,value){
    const target=norm(value);if(!target)return'';
    const options=[...($(selector)?.options||[])];
    return options.find(o=>norm(o.value)===target)?.value||options.find(o=>norm(o.value).includes(target)||target.includes(norm(o.value)))?.value||'';
  }
  function countMatches(match){
    return products.filter(p=>(!match.segment||norm(p.segment)===norm(match.segment))&&(!(match.vehicle||match.make)||norm(p.vehicle)===norm(match.vehicle||match.make))&&modelMatches(p.model,match.model)).length;
  }
  function normalizeRegistration(value){return norm(value).replace(/[^A-Z0-9]/g,'');}

  function onImageSelected(event){
    const file=event.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){setVisualStatus('Please choose an image file.','error');return;}
    selectedFile=file;
    const preview=$('#partImagePreview'),img=preview?.querySelector('img');
    if(preview&&img){img.src=URL.createObjectURL(file);preview.hidden=false;}
    setVisualStatus(`${file.name} selected. Click “Find Matching Parts”.`,'success');
    $('#visualSearchResults').innerHTML='';
  }
  function clearImage(){
    selectedFile=null;if($('#partImageInput'))$('#partImageInput').value='';
    const preview=$('#partImagePreview');if(preview)preview.hidden=true;
    $('#visualSearchResults').innerHTML='';setVisualStatus('','');
  }
  async function searchByImage(){
    const hint=clean($('#partImageHint')?.value);
    if(!selectedFile&&!hint){setVisualStatus('Upload a part image or enter a part name/number.','error');return;}
    setVisualStatus('Searching catalogue…','');$('#visualSearchResults').innerHTML='';
    let matches=[];
    if(selectedFile&&clean(config.visualSearchApiUrl)){
      try{matches=await callVisualApi(selectedFile,hint);}catch(error){setVisualStatus(`Visual search service error: ${error.message}`,'error');return;}
    }
    if(!matches.length)matches=matchManualVisualMap(selectedFile?.name||'',hint);
    if(!matches.length&&hint)matches=localTextMatches(hint);
    if(!matches.length&&selectedFile)matches=localTextMatches(fileNameTerms(selectedFile.name));
    if(!matches.length){
      setVisualStatus('Image upload is ready, but true photo matching needs a configured visual-search AI API or entries in DATA_INPUT/visual-search-map.json.','error');return;
    }
    renderVisualResults(matches.slice(0,Number(config.visualSearchMaxResults)||6));
    setVisualStatus(`${matches.length} possible matching catalogue item${matches.length===1?'':'s'} found.`,'success');
  }
  async function callVisualApi(file,hint){
    const body=new FormData();body.append('image',file);if(hint)body.append('hint',hint);
    const response=await fetch(config.visualSearchApiUrl,{method:'POST',body});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const codes=data.productCodes||data.codes||data.matches||[];
    return resolveProductMatches(codes);
  }
  function matchManualVisualMap(filename,hint){
    const hay=`${filename} ${hint}`.toLowerCase();
    const codes=[];
    for(const item of visualMap){
      const keys=[item.fileContains,item.match,item.keyword,item.label,...(item.keywords||[])].filter(Boolean).map(x=>String(x).toLowerCase());
      if(keys.some(k=>hay.includes(k)))codes.push(...(item.productCodes||item.codes||[]));
    }
    return resolveProductMatches(codes);
  }
  function resolveProductMatches(values){
    const ids=(Array.isArray(values)?values:[values]).map(v=>typeof v==='object'?(v.code||v.partNumber||v.id):v).filter(Boolean).map(norm);
    const seen=new Set();return products.filter(p=>ids.some(id=>norm(p.code)===id||norm(p._id)===id)).filter(p=>{if(seen.has(p._id))return false;seen.add(p._id);return true;});
  }
  function fileNameTerms(name){return String(name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\b(img|image|photo|camera|whatsapp|scan|screenshot|dsc)\b/ig,' ').trim();}
  function localTextMatches(query){
    const terms=String(query||'').toLowerCase().split(/\s+/).filter(x=>x.length>1);
    if(!terms.length)return[];
    return products.map(p=>({p,score:terms.reduce((n,t)=>n+(p._search.includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||naturalCompare(a.p.code,b.p.code)).slice(0,24).map(x=>x.p);
  }
  function renderVisualResults(items){
    $('#visualSearchResults').innerHTML=items.map(p=>`<a class="visual-match-card" href="product.html?id=${encodeURIComponent(p._id)}"><b>${esc(p.code||'PART')}</b><span>${esc(p.description||'Product')}</span><small>${esc(p.vehicle||'')} · ${esc(p.model||'')}</small></a>`).join('');
  }
  function setVisualStatus(message,type){const el=$('#visualSearchStatus');if(!el)return;el.className='visual-search-status'+(type?` ${type}`:'');el.textContent=message;}
  function setMessage(el,message,type){if(!el)return;el.className='lookup-message'+(type?` ${type}`:'');el.textContent=message;}
})();
