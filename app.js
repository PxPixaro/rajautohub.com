(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const text = value => String(value ?? '').trim();
  const naturalCompare = (a,b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric:true, sensitivity:'base'});
  const uniq = arr => [...new Set(arr.map(text).filter(Boolean))].sort(naturalCompare);
  const splitModelValues = value => String(value ?? '').split(/[,;|\n]+/).map(text).filter(Boolean);
  const modelMatches = (value, selected) => !selected || splitModelValues(value).some(x => x.toUpperCase() === String(selected).trim().toUpperCase()) || String(value ?? '').trim().toUpperCase() === String(selected).trim().toUpperCase();
  const firstValue = (product, keys) => { if(!product||typeof product!=='object')return ''; for (const key of keys) { const value=product[key]; if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim(); } const wanted=new Set(keys.map(key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,''))); for(const [key,value] of Object.entries(product)){ if(wanted.has(String(key).toLowerCase().replace(/[^a-z0-9]/g,''))&&value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim(); } return ''; };
  const packageText = (value, unit) => { const clean=text(value); if(!clean)return ''; return /^[-+]?\d+(?:\.\d+)?$/.test(clean) ? `${clean} ${text(unit)||'PCS'}` : clean; };
  const stdPkgFor = p => packageText(firstValue(p,['stdPkg','std_pkg','stdPackage','standardPack','standardPkg','stdPack','stdPacking','standardPacking','stdPkgQty','standardQty','STD PKG','Std Pkg']),p?.unit);
  const crtPkgFor = p => packageText(firstValue(p,['crtPkg','crt_pkg','crtPackage','cartonPack','cartonPkg','crtPack','casePack','cartonPacking','crtPkgQty','cartonQty','caseQty','CRT PKG','Crt Pkg']),p?.unit);
  const setQuickText = (selector,value) => { const node=$(selector); if(node)node.textContent=value||'—'; };
  const setQuickOptional = (name,selector,value) => { const row=document.querySelector(`[data-optional-product-field="${name}"]`); const node=$(selector); if(node)node.textContent=value||'—'; if(row)row.hidden=!value; };
  const money = n => Number(n)>0 ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)) : 'Price on Request';
  const hash = value => { let h=2166136261; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return Math.abs(h>>>0); };
  const SEGMENTS = ['2 WHEEL','3 WHEEL','CAR','LCV','HCV','TRACTOR','EARTHMOVERS','AGRICULTURE PARTS'];
  const colorFor = p => ['Black','Blue','Red','Yellow'][hash(p.code+'c')%4];
  const ratingFor = p => 3.5 + (hash(p.code+'r')%16)/10;
  const stockFor = p => Number(p._price)>0;
  const saleFor = p => Number(p._mrp)>Number(p._price) && Number(p._price)>0;

  let products=[], categories=[], brandLogos=[], filtered=[], page=1, pageSize=25, gridMode='grid';
  let maxCatalogPrice=300000, brandPage=0, brandTimer=null;
  const selectedSegments=new Set(), selectedBrands=new Set(), selectedCategories=new Set(), selectedTemplateFilters=new Set();
  const state={minPrice:0,maxPrice:Infinity,stockOnly:false,saleOnly:false,search:'',vehicle:'',model:''};
  const brandAliasMap=new Map();
  let cart=loadStore('rajCart'), wishlist=loadStore('rajWishlist'), quickProduct=null;

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    $('#year').textContent=new Date().getFullYear();
    bindShell(); startCountdown(); updateStoredUI();
    try{
      const [p,c,b]=await Promise.all([
        fetch('data/products.json').then(checkJson),
        fetch('data/categories.json').then(checkJson),
        fetch('data/brands.json').then(checkJson)
      ]);
      const mappedProducts=window.RAJProductImages?await window.RAJProductImages.apply(p):p;
      products=mappedProducts.map((x,i)=>{
        const listRate=Number(x.listRate)||0, mrp=Number(x.mrp)||listRate;
        return {...x,_id:x.id||`${x.code||'product'}-${i}`,_price:mrp,_mrp:mrp,_listRate:listRate,_search:`${x.description} ${x.code} ${x.group} ${x.rawGroup} ${x.segment} ${x.vehicle} ${x.model} ${x.category} ${(x.categories||[]).join(' ')} ${x.hsn}`.toLowerCase()};
      }).sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description));
      categories=[...(c||[])].sort((a,b)=>naturalCompare(a.group,b.group)); brandLogos=[...(b||[])].sort((a,b)=>naturalCompare(a.name,b.name));
      maxCatalogPrice=Math.max(1000,Math.ceil(products.reduce((m,x)=>Math.max(m,x._price||0),0)/1000)*1000);
      state.maxPrice=maxCatalogPrice;
      initCatalog();
    }catch(err){
      console.error(err); $('#productGrid').innerHTML='<div class="loading">Catalogue files could not load. Please run the website through a local web server.</div>';
    }
  }
  function checkJson(r){if(!r.ok)throw new Error(`${r.url} ${r.status}`);return r.json();}

  function bindShell(){
    $('#categoryNavToggle')?.addEventListener('click',e=>{e.stopPropagation();$('#categoryMega').classList.toggle('show');});
    document.addEventListener('click',e=>{if(!e.target.closest('.category-nav'))$('#categoryMega')?.classList.remove('show');});
    $('#mobileMenuBtn')?.addEventListener('click',()=>openLayer($('#mobileMenu')));
    $('#pageOverlay')?.addEventListener('click',closeLayers);
    $$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>openLayer(document.getElementById(btn.dataset.open))));
    $$('[data-close]').forEach(btn=>btn.addEventListener('click',closeLayers));
    $('#mobileFilterOpen')?.addEventListener('click',openFilter); $('#bottomFilter')?.addEventListener('click',openFilter); $('#mobileFilterClose')?.addEventListener('click',closeLayers);
    $('#bottomSearch')?.addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('#headerSearch')?.focus(),350);});
    $('#mobileSearchBtn')?.addEventListener('click',()=>{const q=$('#mobileSearch').value.trim();closeLayers();if(q){state.search=q;$('#catalogSearch').value=q;applyFilters();$('#shop').scrollIntoView({behavior:'smooth'});}});
    $('#loginForm')?.addEventListener('submit',e=>{e.preventDefault();toast('Login interface ready. Connect your live customer backend to activate it.');closeLayers();});
    $('#newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();toast('Thank you. Subscription saved in demo mode.');e.currentTarget.reset();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers();});
  }

  function initCatalog(){
    const segmentCounts=new Map(),categoryCounts=new Map();
    products.forEach(p=>{segmentCounts.set(p.segment,(segmentCounts.get(p.segment)||0)+1);(p.categories||[p.category]).forEach(c=>categoryCounts.set(c,(categoryCounts.get(c)||0)+1));});
    brandAliasMap.clear();
    brandLogos.forEach(brand=>brandAliasMap.set(brand.name,new Set([brand.name,...(brand.aliases||[])].map(text))));
    $('#segmentFilter').innerHTML='<option value="">Select Segment</option>'+SEGMENTS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    $('#segmentChecks').innerHTML=SEGMENTS.map(x=>`<label><input type="checkbox" value="${esc(x)}"> ${esc(x)} <small>${Number(segmentCounts.get(x)||0).toLocaleString()}</small></label>`).join('');
    $('#brandChecks').innerHTML=brandLogos.map(brand=>`<label data-label="${esc(String(brand.name).toLowerCase())}"><input type="checkbox" value="${esc(brand.name)}"> ${esc(brand.name)} <small>${Number(brand.productCount||0).toLocaleString()}</small></label>`).join('');
    const catNames=uniq(categories.flatMap(c=>c.categories||[]));
    $('#categoryChecks').innerHTML=catNames.map(x=>`<label data-label="${esc(x.toLowerCase())}"><input type="checkbox" value="${esc(x)}"> ${esc(x)} <small>${Number(categoryCounts.get(x)||0).toLocaleString()}</small></label>`).join('');
    $('#headerCategory').innerHTML='<option value="">All Categories</option>'+catNames.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    $('#priceLabel').textContent=`₹0 — ${money(maxCatalogPrice)}`;
    $('#maxPrice').placeholder=`Max ${maxCatalogPrice.toLocaleString('en-IN')}`;
    renderBrandCarousel(); startBrandCarousel(); populateVehicles();
    window.RAJSmartSelect?.init(['#headerCategory','#segmentFilter','#vehicleFilter','#modelFilter'].map(x=>document.querySelector(x)).filter(Boolean));
    applyUrlParams(); bindCatalog(); applyFilters();
  }

  function bindCatalog(){
    $('#mainSearchForm').addEventListener('submit',e=>{e.preventDefault();state.search=$('#headerSearch').value.trim();$('#catalogSearch').value=state.search;selectedCategories.clear();const c=$('#headerCategory').value;if(c)selectedCategories.add(c);syncChecks();hideSuggestions();applyFilters();$('#shop').scrollIntoView({behavior:'smooth'});});
    $('#headerSearch').addEventListener('input',debounce(showSuggestions,140)); $('#headerSearch').addEventListener('focus',showSuggestions);
    document.addEventListener('click',e=>{if(!e.target.closest('.main-search'))hideSuggestions();});
    $('#catalogSearch').addEventListener('input',debounce(()=>{state.search=$('#catalogSearch').value.trim();applyFilters();},180));
    $('#catalogSearchBtn').addEventListener('click',()=>{state.search=$('#catalogSearch').value.trim();applyFilters();});
    $('#segmentFilter').addEventListener('change',populateVehicles); $('#vehicleFilter').addEventListener('change',populateModels);
    $('#vehicleFindBtn').addEventListener('click',()=>{const s=$('#segmentFilter').value,v=$('#vehicleFilter').value,m=$('#modelFilter').value;selectedSegments.clear();if(s)selectedSegments.add(s);state.vehicle=v;state.model=m;syncChecks();applyFilters();closeLayers();});
    $('#segmentChecks').addEventListener('change',e=>{if(!e.target.matches('input'))return;e.target.checked?selectedSegments.add(e.target.value):selectedSegments.delete(e.target.value);applyFilters();});
    $('#segmentSearch')?.addEventListener('input',e=>filterCheckLabels('#segmentChecks',e.target.value));
    $('#brandChecks').addEventListener('change',e=>{if(!e.target.matches('input'))return;e.target.checked?selectedBrands.add(e.target.value):selectedBrands.delete(e.target.value);applyFilters();});
    $('#categoryChecks').addEventListener('change',e=>{if(!e.target.matches('input'))return;e.target.checked?selectedCategories.add(e.target.value):selectedCategories.delete(e.target.value);applyFilters();});
    $('#brandSearch')?.addEventListener('input',e=>filterCheckLabels('#brandChecks',e.target.value));
    $('#categorySearch')?.addEventListener('input',e=>filterCheckLabels('#categoryChecks',e.target.value));
    $$('[data-template-filter]').forEach(input=>input.addEventListener('change',()=>{input.checked?selectedTemplateFilters.add(input.value):selectedTemplateFilters.delete(input.value);applyFilters();}));
    $$('[data-template-category]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();selectedTemplateFilters.clear();selectedTemplateFilters.add(link.dataset.templateCategory);syncChecks();applyFilters();$('#shop').scrollIntoView({behavior:'smooth'});}));
    $('#priceFilterBtn').addEventListener('click',()=>{state.minPrice=Math.max(0,Number($('#minPrice').value)||0);state.maxPrice=Math.max(state.minPrice,Number($('#maxPrice').value)||maxCatalogPrice);$('#priceLabel').textContent=`${money(state.minPrice)} — ${money(state.maxPrice)}`;applyFilters();});
    $('#stockOnly').addEventListener('change',e=>{state.stockOnly=e.target.checked;applyFilters();}); $('#saleOnly').addEventListener('change',e=>{state.saleOnly=e.target.checked;applyFilters();});
    $$('input[name=color]').forEach(i=>i.addEventListener('change',applyFilters));
    $('#sortSelect').addEventListener('change',()=>{sortProducts(filtered,$('#sortSelect').value);page=1;render();});
    $('#pageSize').value=String(pageSize);$('#pageSize').addEventListener('change',e=>{pageSize=Number(e.target.value);page=1;render();}); $('#gridView').addEventListener('click',()=>setView('grid')); $('#listView').addEventListener('click',()=>setView('list'));
    $('#resetFilters').addEventListener('click',resetFilters); $('#productGrid').addEventListener('click',handleProductClick);
    $('#pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;page=Number(b.dataset.page);render();$('#shop').scrollIntoView({behavior:'smooth'});});
    $('#brandPrev')?.addEventListener('click',()=>changeBrandPage(-1)); $('#brandNext')?.addEventListener('click',()=>changeBrandPage(1));
    $('#brandRail').addEventListener('click',e=>{const b=e.target.closest('[data-brand]');if(!b)return;selectedBrands.clear();selectedBrands.add(b.dataset.brand);syncChecks();applyFilters();$('#shop').scrollIntoView({behavior:'smooth'});});
    $('#quickAddCart').addEventListener('click',()=>{if(quickProduct)addToCart(quickProduct);});
  }
  function filterCheckLabels(root,q){q=String(q).toLowerCase();$$(`${root} label`).forEach(l=>{const hay=(l.dataset.label||l.textContent||'').toLowerCase();l.hidden=!hay.includes(q);});}

  function applyUrlParams(){const p=new URLSearchParams(location.search),q=p.get('search')||p.get('q')||'',s=p.get('segment')||'',v=p.get('vehicle')||'',m=p.get('model')||'',c=p.get('category')||'';if(q){state.search=q;$('#headerSearch').value=q;$('#catalogSearch').value=q;}if(c)selectedCategories.add(c);if(SEGMENTS.includes(s)){selectedSegments.add(s);$('#segmentFilter').value=s;populateVehicles();}if(v){state.vehicle=v;$('#vehicleFilter').value=v;populateModels();}if(m){state.model=m;$('#modelFilter').value=m;}window.RAJSmartSelect?.refresh('#segmentFilter');window.RAJSmartSelect?.refresh('#vehicleFilter');window.RAJSmartSelect?.refresh('#modelFilter');syncChecks();}
  function populateVehicles(){const s=$('#segmentFilter').value;const rows=s?products.filter(p=>p.segment===s):products;const vals=uniq(rows.map(p=>p.vehicle));$('#vehicleFilter').innerHTML='<option value="">Select Vehicle</option>'+vals.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('#modelFilter').innerHTML='<option value="">Select Model</option>';window.RAJSmartSelect?.refresh('#vehicleFilter');window.RAJSmartSelect?.refresh('#modelFilter');}
  function populateModels(){const s=$('#segmentFilter').value,v=$('#vehicleFilter').value;const rows=products.filter(p=>(!s||p.segment===s)&&(!v||p.vehicle===v));const vals=uniq(rows.flatMap(p=>splitModelValues(p.model)));$('#modelFilter').innerHTML='<option value="">Select Model</option>'+vals.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');window.RAJSmartSelect?.refresh('#modelFilter');}

  function applyFilters(){
    const q=state.search.toLowerCase(), colors=new Set($$('input[name=color]:checked').map(i=>i.value));
    filtered=products.filter(p=>{
      const templateOK=!selectedTemplateFilters.size||[...selectedTemplateFilters].some(t=>fuzzyMatch(t,p));
      const priceOK=(p._price===0&&state.minPrice===0)||p._price>=state.minPrice;
      return (!q||p._search.includes(q))&&templateOK&&(!selectedSegments.size||selectedSegments.has(p.segment))&&brandMatches(p)&&(!selectedCategories.size||[...selectedCategories].some(c=>(p.categories||[p.category]).includes(c)))&&(!state.vehicle||p.vehicle===state.vehicle)&&modelMatches(p.model,state.model)&&priceOK&&p._price<=state.maxPrice&&(!state.stockOnly||stockFor(p))&&(!state.saleOnly||saleFor(p))&&(!colors.size||colors.has(colorFor(p)));
    });
    sortProducts(filtered,$('#sortSelect').value);page=1;render();renderActiveFilters();
  }
  function brandMatches(p){if(!selectedBrands.size)return true;return [...selectedBrands].some(name=>{const aliases=brandAliasMap.get(name)||new Set([name]);return aliases.has(text(p.group))||aliases.has(text(p.rawGroup));});}
  function fuzzyMatch(term,p){const t=String(term).toLowerCase(),map={'headlights & lighting':['light','lamp','head','indicator'],'interior accessories':['seat','door','handle','lock','mirror'],'tires & wheels':['tyre','tire','wheel','rim','hub'],'tools & equipment':['tool','kit','jack','spanner'],'auto safety & security':['lock','security','brake'],'garage tools':['tool','jack','grease'],'battery and adhesives':['battery','adhesive','sealant'],'oils & fluids':['oil','grease','coolant','fluid'],'motor oils':['oil'],'alloy wheels':['wheel','rim']};return (map[t]||t.split(/\s+/).filter(x=>x.length>3)).some(k=>p._search.includes(k));}
  function sortProducts(a,mode){a.sort((x,y)=>{if(mode==='priceAsc')return x._price-y._price;if(mode==='priceDesc')return y._price-x._price;if(mode==='rating')return ratingFor(y)-ratingFor(x);if(mode==='popularity')return hash(y.code+'pop')-hash(x.code+'pop');if(mode==='name')return naturalCompare(x.description,y.description);return naturalCompare(x.code,y.code)||naturalCompare(x.description,y.description);});}

  function render(){const total=Math.max(1,Math.ceil(filtered.length/pageSize));if(page>total)page=total;const start=(page-1)*pageSize,items=filtered.slice(start,start+pageSize);$('#resultSummary').textContent=filtered.length?`Showing ${start+1}–${Math.min(start+pageSize,filtered.length)} of ${filtered.length.toLocaleString()} products`:'No products found';$('#productGrid').classList.toggle('list-view',gridMode==='list');$('#productGrid').innerHTML=items.length?items.map(productCard).join(''):'<div class="loading">No products found. Clear filters or search another part number.</div>';renderPagination(total);}
  function productCard(p){
    const rating=ratingFor(p),stdPkg=stdPkgFor(p),crtPkg=crtPkgFor(p);
    return `<article class="product-card" data-id="${esc(p._id)}"><div class="product-media" role="button" tabindex="0" title="Click to view product details"><span class="badge blue part-number-badge">${esc(p.code||'PART NO.')}</span>${window.RAJProductImages?window.RAJProductImages.markup(p,'shop'):(p.image?`<img class="product-real-image" src="${esc(p.image)}" alt="${esc(p.description)}">`:window.RAJProductImages?.fallbackMarkup('shop')||'')}<div class="card-actions"><button type="button" data-action="wishlist" title="Wishlist">♡</button><button type="button" data-action="compare" title="Compare">⇄</button><button type="button" data-action="quick" title="Quick view">⌕</button></div></div><div class="product-body"><div class="product-brand">${esc(p.group)}</div><h3 class="product-title"><a href="product.html?id=${encodeURIComponent(p._id)}">${esc(p.description)}</a></h3><div class="product-rating">${stars(rating)} <span>${rating.toFixed(1)}</span></div><div class="product-price"><span class="card-price-label">MRP</span><b>${money(p._mrp)}</b></div><div class="stock">${p._mrp?'MRP Available':'Price Available on Request'}</div><ul class="product-features"><li>Part No.: ${esc(p.code||'—')}</li><li>HSN: ${esc(p.hsn||'—')} · GST: ${esc(p.gst||0)}%</li><li>Segment: ${esc(p.segment)} · Vehicle: ${esc(p.vehicle)}</li><li>Model: ${esc(p.model)}</li><li>Unit: ${esc(p.unit||'PCS')}</li>${stdPkg?`<li>Std. Pkg.: ${esc(stdPkg)}</li>`:''}${crtPkg?`<li>Crt. Pkg.: ${esc(crtPkg)}</li>`:''}</ul><button class="product-add" type="button" data-action="cart">Add to cart / Enquire</button></div></article>`;
  }
  function stars(r){return '★'.repeat(Math.round(r))+'☆'.repeat(5-Math.round(r));}
  function renderPagination(total){if(total<=1){$('#pagination').innerHTML='';return;}const nums=[1];for(let i=Math.max(2,page-2);i<=Math.min(total-1,page+2);i++)nums.push(i);nums.push(total);let html=`<button type="button" data-page="${Math.max(1,page-1)}" ${page===1?'disabled':''}>‹ Previous</button>`,prev=0;[...new Set(nums)].forEach(n=>{if(prev&&n-prev>1)html+='<span>…</span>';html+=`<button type="button" class="${n===page?'active':''}" data-page="${n}">${n}</button>`;prev=n;});html+=`<button type="button" data-page="${Math.min(total,page+1)}" ${page===total?'disabled':''}>Next ›</button>`;$('#pagination').innerHTML=html;}

  function renderActiveFilters(){const tags=[];selectedSegments.forEach(x=>tags.push(['segment',x]));selectedBrands.forEach(x=>tags.push(['brand',x]));selectedCategories.forEach(x=>tags.push(['category',x]));selectedTemplateFilters.forEach(x=>tags.push(['template',x]));if(state.search)tags.push(['search',`Search: ${state.search}`]);if(state.vehicle)tags.push(['vehicle',state.vehicle]);if(state.model)tags.push(['model',state.model]);$('#activeFilters').innerHTML=tags.map(([t,l])=>`<button class="active-filter" data-remove-type="${t}" data-remove-value="${esc(l.replace(/^Search: /,''))}">${esc(l)} <b>×</b></button>`).join('');$$('.active-filter').forEach(b=>b.addEventListener('click',()=>removeFilter(b.dataset.removeType,b.dataset.removeValue)));}
  function removeFilter(t,v){if(t==='segment')selectedSegments.delete(v);if(t==='brand')selectedBrands.delete(v);if(t==='category')selectedCategories.delete(v);if(t==='template')selectedTemplateFilters.delete(v);if(t==='search'){state.search='';$('#catalogSearch').value='';$('#headerSearch').value='';}if(t==='vehicle'){state.vehicle='';$('#vehicleFilter').value='';}if(t==='model'){state.model='';$('#modelFilter').value='';}syncChecks();applyFilters();}
  function syncChecks(){$$('#segmentChecks input').forEach(i=>i.checked=selectedSegments.has(i.value));$$('#brandChecks input').forEach(i=>i.checked=selectedBrands.has(i.value));$$('#categoryChecks input').forEach(i=>i.checked=selectedCategories.has(i.value));$$('[data-template-filter]').forEach(i=>i.checked=selectedTemplateFilters.has(i.value));}
  function resetFilters(){selectedSegments.clear();selectedBrands.clear();selectedCategories.clear();selectedTemplateFilters.clear();Object.assign(state,{minPrice:0,maxPrice:maxCatalogPrice,stockOnly:false,saleOnly:false,search:'',vehicle:'',model:''});$('#catalogSearch').value='';$('#headerSearch').value='';$('#minPrice').value='';$('#maxPrice').value='';$('#priceLabel').textContent=`₹0 — ${money(maxCatalogPrice)}`;$('#stockOnly').checked=false;$('#saleOnly').checked=false;$$('input[name=color]').forEach(i=>i.checked=false);$('#segmentFilter').value='';populateVehicles();window.RAJSmartSelect?.refresh('#segmentFilter');syncChecks();applyFilters();}
  function setView(v){gridMode=v==='list'?'list':'grid';$('#gridView').classList.toggle('active',gridMode==='grid');$('#listView').classList.toggle('active',gridMode==='list');render();}

  function handleProductClick(e){
    const card=e.target.closest('.product-card'); if(!card)return;
    const p=products.find(x=>String(x._id)===card.dataset.id); if(!p)return;
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='cart')addToCart(p);
    else if(action==='wishlist')addToWishlist(p);
    else if(action==='compare')toast(`${p.code}: added to comparison list.`);
    else if(action==='quick')openQuick(p);
    else if(e.target.closest('.product-media')&&!e.target.closest('a,button'))openQuick(p);
  }
  function openQuick(p){
    quickProduct=p;
    window.RAJProductImages?.setElementImage($('.quick-image'),p,'quick');
    setQuickText('#quickBrand',p.group||'RAJ AGENCIES');
    setQuickText('#quickTitle',p.description||'Product');
    setQuickText('#quickPrice',money(p._mrp));
    setQuickText('#quickCode',p.code||'—');
    setQuickText('#quickTax',`${p.hsn||'—'} · GST ${Number(p.gst)||0}%`);
    setQuickText('#quickUnit',p.unit||'PCS');
    setQuickText('#quickCategory',p.category||'General Automotive Parts');
    setQuickText('#quickSegment',p.segment||'—');
    setQuickText('#quickVehicle',p.vehicle||'—');
    setQuickText('#quickModel',p.model||'—');
    setQuickOptional('std','#quickStdPkg',stdPkgFor(p));
    setQuickOptional('crt','#quickCrtPkg',crtPkgFor(p));
    setQuickText('#quickDescription',`${p.description||'Product'} — catalogue reference for ${p.vehicle||'the selected vehicle'}${p.model?` / ${p.model}`:''}.`);
    $('#quickWhatsApp').href=`https://wa.me/918128242316?text=${encodeURIComponent(`Hello Raj Agencies, I need details for ${p.code} - ${p.description}`)}`;
    openLayer($('#quickView'));
  }
  function addToCart(p){const found=cart.find(x=>x.id===p._id);if(found)found.qty++;else cart.push({id:p._id,code:p.code,title:p.description,description:p.description,group:p.group,image:p.image||'',price:p._price,qty:1});saveStore('rajCart',cart);updateStoredUI();toast(`${p.code||'Product'} added to cart.`);}
  function addToWishlist(p){if(!wishlist.some(x=>x.id===p._id))wishlist.push({id:p._id,code:p.code,title:p.description,description:p.description,group:p.group,image:p.image||'',price:p._price});saveStore('rajWishlist',wishlist);updateStoredUI();toast(`${p.code||'Product'} saved to wishlist.`);}
  function updateStoredUI(){const qty=cart.reduce((s,x)=>s+(x.qty||1),0),total=cart.reduce((s,x)=>s+(x.price||0)*(x.qty||1),0);$('#cartCount').textContent=qty;$('#cartTotal').textContent=money(total);$('#drawerCartTotal').textContent=money(total);$('#wishlistCount').textContent=wishlist.length;$('#utilityWishlistCount').textContent=wishlist.length;$('#cartItems').innerHTML=cart.length?cart.map(x=>`<div class="drawer-product"><div class="drawer-product-img">${window.RAJProductImages?window.RAJProductImages.markup(x,'drawer',{alt:x.description||x.title||'Product image'}):'<img src="assets/raj-group-product-fallback.png" alt="Raj Group">'}</div><div><b>${esc(x.title)}</b><small>${x.qty} × ${money(x.price)}</small></div><button type="button" data-remove-cart="${esc(x.id)}">×</button></div>`).join(''):'<div class="empty-state">No products in the cart.</div>';$('#wishlistItems').innerHTML=wishlist.length?wishlist.map(x=>`<div class="drawer-product"><div class="drawer-product-img">${window.RAJProductImages?window.RAJProductImages.markup(x,'drawer',{alt:x.description||x.title||'Product image'}):'<img src="assets/raj-group-product-fallback.png" alt="Raj Group">'}</div><div><b>${esc(x.title)}</b><small>${money(x.price)}</small></div><button type="button" data-remove-wishlist="${esc(x.id)}">×</button></div>`).join(''):'<div class="empty-state">Your wishlist is empty.</div>';$$('[data-remove-cart]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.removeCart);saveStore('rajCart',cart);updateStoredUI();});$$('[data-remove-wishlist]').forEach(b=>b.onclick=()=>{wishlist=wishlist.filter(x=>x.id!==b.dataset.removeWishlist);saveStore('rajWishlist',wishlist);updateStoredUI();});}

  function showSuggestions(){const el=$('#searchSuggestions'),q=$('#headerSearch').value.trim().toLowerCase();if(q.length<2){hideSuggestions();return;}const items=products.filter(p=>p._search.includes(q)).sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description)).slice(0,7);el.innerHTML=items.length?items.map(p=>`<a class="suggestion" href="?search=${encodeURIComponent(p.code||p.description)}#shop"><div class="suggestion-img">${window.RAJProductImages?window.RAJProductImages.markup(p,'suggestion',{alt:p.description||''}):(p.image?`<img src="${esc(p.image)}" alt="">`:"IMAGE")}</div><div><b>${esc(p.description)}</b><small>${esc(p.group)} · ${esc(p.code)}</small></div><em>${money(p._price)}</em></a>`).join(''):'<div class="suggestion"><div></div><div><b>No matching product</b><small>Try a brand, HSN or part number.</small></div></div>';el.classList.add('show');}
  function hideSuggestions(){$('#searchSuggestions')?.classList.remove('show');}

  function renderBrandCarousel(){if(!brandLogos.length)return;const size=12,total=Math.ceil(brandLogos.length/size);brandPage=(brandPage+total)%total;const start=brandPage*size;let items=brandLogos.slice(start,start+size);$('#brandRail').innerHTML=items.map(b=>`<button class="brand-logo-card" type="button" data-brand="${esc(b.name)}"><img src="${esc(b.image)}" alt="${esc(b.name)} logo"><b>${esc(b.name)}</b><small>${Number(b.productCount||0).toLocaleString()} products</small></button>`).join('');if($('#brandPageStatus'))$('#brandPageStatus').textContent=`${brandPage+1} / ${total}`;}
  function changeBrandPage(n){brandPage+=n;renderBrandCarousel();startBrandCarousel();}
  function startBrandCarousel(){clearInterval(brandTimer);brandTimer=setInterval(()=>{brandPage++;renderBrandCarousel();},4500);}

  function startCountdown(){const end=Date.now()+7*86400000+9*3600000;const tick=()=>{const d=Math.max(0,end-Date.now()),vals=[Math.floor(d/86400000),Math.floor(d/3600000)%24,Math.floor(d/60000)%60,Math.floor(d/1000)%60];['days','hours','mins','secs'].forEach((id,i)=>{const el=$(`#${id}`);if(el)el.textContent=String(vals[i]).padStart(2,'0');});};tick();setInterval(tick,1000);}
  function openFilter(){const f=$('#filterSidebar');f.classList.add('show');$('#pageOverlay').classList.add('show');document.body.style.overflow='hidden';}
  function openLayer(el){if(!el)return;closeLayers();el.classList.add('show');el.setAttribute('aria-hidden','false');if(!el.classList.contains('modal')&&!el.classList.contains('quick-view'))$('#pageOverlay').classList.add('show');document.body.style.overflow='hidden';}
  function closeLayers(){$$('.drawer,.modal,.quick-view,.mobile-menu,.filter-sidebar').forEach(x=>{x.classList.remove('show');x.setAttribute('aria-hidden','true');});$('#pageOverlay').classList.remove('show');document.body.style.overflow='';}
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400);}
  function loadStore(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function saveStore(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function debounce(fn,w){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),w);};}
})();
