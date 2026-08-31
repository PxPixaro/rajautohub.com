(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalize = value => String(value ?? '').trim();
  const naturalCompare = (a,b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric:true, sensitivity:'base'});
  const uniq = arr => [...new Set(arr.map(normalize).filter(Boolean))].sort(naturalCompare);
  const splitModelValues = value => String(value ?? '').split(/[,;|\n]+/).map(normalize).filter(Boolean);
  const modelMatches = (value, selected) => !selected || splitModelValues(value).some(x => x.toUpperCase() === String(selected).trim().toUpperCase()) || String(value ?? '').trim().toUpperCase() === String(selected).trim().toUpperCase();
  const firstValue = (product, keys) => { if(!product||typeof product!=='object')return ''; for (const key of keys) { const value=product[key]; if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim(); } const wanted=new Set(keys.map(key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,''))); for(const [key,value] of Object.entries(product)){ if(wanted.has(String(key).toLowerCase().replace(/[^a-z0-9]/g,''))&&value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim(); } return ''; };
  const packageText = (value, unit) => { const clean=normalize(value); if(!clean)return ''; return /^[-+]?\d+(?:\.\d+)?$/.test(clean) ? `${clean} ${normalize(unit)||'PCS'}` : clean; };
  const stdPkgFor = p => packageText(firstValue(p,['stdPkg','std_pkg','stdPackage','standardPack','standardPkg','stdPack','stdPacking','standardPacking','stdPkgQty','standardQty','STD PKG','Std Pkg']),p?.unit);
  const crtPkgFor = p => packageText(firstValue(p,['crtPkg','crt_pkg','crtPackage','cartonPack','cartonPkg','crtPack','casePack','cartonPacking','crtPkgQty','cartonQty','caseQty','CRT PKG','Crt Pkg']),p?.unit);
  const setQuickText = (selector,value) => { const node=$(selector); if(node)node.textContent=value||'—'; };
  const setQuickOptional = (name,selector,value) => { const row=document.querySelector(`[data-optional-product-field="${name}"]`); const node=$(selector); if(node)node.textContent=value||'—'; if(row)row.hidden=!value; };
  const hash = value => { let h=2166136261; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return Math.abs(h>>>0); };
  const money = n => Number(n)>0 ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)) : 'Price on Request';
  const priceFor = p => Number(p.mrp)||Number(p.listRate)||0;
  const oldPriceFor = p => priceFor(p);
  const ratingFor = p => (3.5 + (hash(p.code+'r')%16)/10).toFixed(1);
  const stockFor = p => priceFor(p)>0;
  const saleFor = p => oldPriceFor(p)>priceFor(p)&&priceFor(p)>0;
  const discountFor = p => saleFor(p)?Math.max(1,Math.round((1-priceFor(p)/oldPriceFor(p))*100)):0;
  const SEGMENTS=['2 WHEEL','3 WHEEL','CAR','LCV','HCV','TRACTOR','EARTHMOVERS','AGRICULTURE PARTS'];

  let products=[], categories=[], productCategories=[], brandLogos=[], cart=loadStore('rajCart'), wishlist=loadStore('rajWishlist'), quickProduct=null;
  let activeSlide=0, sliderTimer=null, partnerPage=0, partnerTimer=null, featuredPage=1, featuredCategory='', featuredBrand='', featuredSegment='', featuredVehicle='', featuredModel='';
  const FEATURED_PAGE_SIZE=25;

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    $('#year').textContent = new Date().getFullYear();
    bindShell();
    bindSlider();
    startCountdown();
    updateStoredUI();
    try{
      const [p,c,pc,b]=await Promise.all([
        fetch('data/products.json').then(r=>{if(!r.ok)throw new Error('products');return r.json();}),
        fetch('data/categories.json').then(r=>{if(!r.ok)throw new Error('categories');return r.json();}),
        fetch('data/product-categories.json').then(r=>{if(!r.ok)throw new Error('product categories');return r.json();}),
        fetch('data/brands.json').then(r=>{if(!r.ok)throw new Error('brands');return r.json();})
      ]);
      const mappedProducts=window.RAJProductImages?await window.RAJProductImages.apply(p):p;
      products=mappedProducts.map((x,i)=>({...x,_id:x.id||`${x.code||'item'}-${i}`,_search:`${x.description} ${x.group} ${x.code} ${x.hsn} ${x.segment} ${x.vehicle} ${x.model} ${x.category} ${(x.categories||[]).join(' ')}`.toLowerCase()})).sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description));
      categories=[...(c||[])].sort((a,b)=>naturalCompare(a.group,b.group));
      productCategories=[...(pc||[])].sort((a,b)=>naturalCompare(a.name,b.name));
      brandLogos=[...(b||[])].sort((a,b)=>naturalCompare(a.name,b.name));
      hydrateHome();
    }catch(err){
      console.warn(err);
      const demo=demoProducts();
      const mappedDemo=window.RAJProductImages?await window.RAJProductImages.apply(demo):demo;
      products=mappedDemo.map((x,i)=>({...x,_id:x.code||`demo-${i}`}));
      categories=[{group:'Demo Catalogue',categories:['Automotive Parts']}]; productCategories=[{name:'Automotive Parts',productCount:products.length,image:'assets/raj-logo.png'}];
      hydrateHome();
      toast('Demo catalogue loaded. Run through a local server for the complete Excel data.');
    }
  }

  function bindShell(){
    $('#categoryNavToggle')?.addEventListener('click',e=>{e.stopPropagation();$('#categoryMega')?.classList.toggle('show');});
    document.addEventListener('click',e=>{if(!e.target.closest('.category-nav'))$('#categoryMega')?.classList.remove('show');});
    $('#mobileMenuBtn')?.addEventListener('click',()=>openLayer($('#mobileMenu')));
    $('#pageOverlay')?.addEventListener('click',closeLayers);
    $$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>openLayer(document.getElementById(btn.dataset.open))));
    $$('[data-close]').forEach(btn=>btn.addEventListener('click',closeLayers));
    $('#bottomSearch')?.addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('#headerSearch')?.focus(),350);});
    $('#mobileSearchBtn')?.addEventListener('click',()=>goSearch($('#mobileSearch')?.value));
    $('#mainSearchForm')?.addEventListener('submit',e=>{e.preventDefault();goSearch($('#headerSearch')?.value,$('#headerCategory')?.value);});
    $('#headerSearch')?.addEventListener('input',debounce(showSuggestions,120));
    $('#headerSearch')?.addEventListener('focus',showSuggestions);
    $('#loginForm')?.addEventListener('submit',e=>{e.preventDefault();toast('Demo login submitted. Connect a backend to activate accounts.');closeLayers();});
    $('#newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();toast('Subscription saved in demo mode.');e.currentTarget.reset();});
    $('#homeSegment')?.addEventListener('change',populateVehicles);
    $('#homeVehicle')?.addEventListener('change',populateModels);
    $('#homeFindParts')?.addEventListener('click',findParts);
    $('#featuredBrandToggle')?.addEventListener('click',e=>{e.stopPropagation();const menu=$('#featuredBrandMenu');menu.hidden=!menu.hidden;if(!menu.hidden)setTimeout(()=>$('#featuredBrandSearch')?.focus(),0);});
    $('#featuredBrandSearch')?.addEventListener('input',renderFeaturedBrandOptions);
    $('#featuredBrandOptions')?.addEventListener('click',e=>{const b=e.target.closest('[data-brand]');if(!b)return;featuredBrand=b.dataset.brand;featuredCategory='';featuredSegment='';featuredVehicle='';featuredModel='';featuredPage=1;$('#featuredBrandToggle span').textContent=featuredBrand||'All Brands';$('#featuredBrandMenu').hidden=true;const adv=$('#featuredAdvancedSearch');if(adv)adv.hidden=!featuredBrand;populateFeaturedAdvanced();renderFeatured();});
    $('#featuredSegment')?.addEventListener('change',()=>{featuredSegment=$('#featuredSegment').value;featuredVehicle='';featuredModel='';featuredPage=1;populateFeaturedAdvanced();renderFeatured();});
    $('#featuredVehicle')?.addEventListener('change',()=>{featuredVehicle=$('#featuredVehicle').value;featuredModel='';featuredPage=1;populateFeaturedAdvanced();renderFeatured();});
    $('#featuredModel')?.addEventListener('change',()=>{featuredModel=$('#featuredModel').value;featuredPage=1;renderFeatured();});
    $('#featuredClearAdvanced')?.addEventListener('click',()=>{featuredSegment='';featuredVehicle='';featuredModel='';featuredPage=1;populateFeaturedAdvanced();renderFeatured();});
    $('#featuredCategoryToggle')?.addEventListener('click',e=>{e.stopPropagation();const menu=$('#featuredCategoryMenu');menu.hidden=!menu.hidden;if(!menu.hidden)setTimeout(()=>$('#featuredCategorySearch')?.focus(),0);});
    $('#featuredCategorySearch')?.addEventListener('input',renderFeaturedCategoryOptions);
    $('#featuredCategoryOptions')?.addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;featuredCategory=b.dataset.category;featuredPage=1;$('#featuredCategoryToggle span').textContent=featuredCategory||'All Product Categories';$('#featuredCategoryMenu').hidden=true;renderFeatured();});
    document.addEventListener('click',e=>{if(!e.target.closest('#featuredCategoryPicker'))$('#featuredCategoryMenu')?.setAttribute('hidden','');if(!e.target.closest('#featuredBrandPicker'))$('#featuredBrandMenu')?.setAttribute('hidden','');});
    document.addEventListener('click',handleDocumentClick);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers();});
  }

  function hydrateHome(){
    const groups=uniq(productCategories.map(x=>x.name).concat(categories.flatMap(x=>x.categories||[])));
    $('#headerCategory').innerHTML='<option value="">All Categories</option>'+groups.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    populateSegments();
    window.RAJSmartSelect?.init(['#headerCategory','#homeSegment','#homeVehicle','#homeModel'].map(x=>document.querySelector(x)).filter(Boolean));
    if(!featuredBrand){
      featuredBrand=uniq(products.map(p=>p.group))[0]||'';
      const label=$('#featuredBrandToggle span'); if(label)label.textContent=featuredBrand||'All Brands';
      const advanced=$('#featuredAdvancedSearch'); if(advanced)advanced.hidden=!featuredBrand;
    }
    renderFeaturedBrandOptions();
    renderFeaturedCategoryOptions();
    populateFeaturedAdvanced();
    renderFeatured();
    renderHorizontalDeals();
    renderPartners();
  }

  function populateSegments(){
    $('#homeSegment').innerHTML='<option value="">Select Segment</option>'+SEGMENTS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#homeSegment');
    populateVehicles();
  }
  function populateVehicles(){
    const segment=$('#homeSegment')?.value||'';
    const vehicles=uniq(products.filter(p=>!segment||p.segment===segment).map(p=>p.vehicle));
    $('#homeVehicle').innerHTML='<option value="">Select Vehicle</option>'+vehicles.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#homeVehicle');
    populateModels();
  }
  function populateModels(){
    const segment=$('#homeSegment')?.value||'', vehicle=$('#homeVehicle')?.value||'';
    const models=uniq(products.filter(p=>(!segment||p.segment===segment)&&(!vehicle||p.vehicle===vehicle)).flatMap(p=>splitModelValues(p.model)));
    $('#homeModel').innerHTML='<option value="">Select Model</option>'+models.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    window.RAJSmartSelect?.refresh('#homeModel');
  }
  function findParts(){
    const params=new URLSearchParams();
    const segment=$('#homeSegment').value,vehicle=$('#homeVehicle').value,model=$('#homeModel').value;
    if(segment)params.set('segment',segment);if(vehicle)params.set('vehicle',vehicle);if(model)params.set('model',model);
    location.href='shop.html'+(params.toString()?`?${params}`:'')+'#shop';
  }


  function renderFeaturedBrandOptions(){
    const root=$('#featuredBrandOptions');if(!root)return;
    const q=($('#featuredBrandSearch')?.value||'').trim().toLowerCase();
    const names=uniq(products.map(p=>p.group));
    const filtered=names.filter(x=>!q||x.toLowerCase().includes(q));
    root.innerHTML=`<button type="button" data-brand="" class="${featuredBrand?'':'active'}">All Brands <small>${products.length.toLocaleString()}</small></button>`+
      filtered.map(name=>`<button type="button" data-brand="${esc(name)}" class="${featuredBrand===name?'active':''}">${esc(name)} <small>${products.filter(p=>p.group===name).length.toLocaleString()}</small></button>`).join('');
  }
  function populateFeaturedAdvanced(){
    const adv=$('#featuredAdvancedSearch');if(adv)adv.hidden=!featuredBrand;
    const base=featuredBrand?products.filter(p=>p.group===featuredBrand):products;
    const segments=uniq(base.map(p=>p.segment));
    const seg=$('#featuredSegment'),veh=$('#featuredVehicle'),mod=$('#featuredModel');
    if(seg){seg.innerHTML='<option value="">All Segments</option>'+segments.map(x=>`<option value="${esc(x)}" ${x===featuredSegment?'selected':''}>${esc(x)}</option>`).join('');}
    const vehicles=uniq(base.filter(p=>!featuredSegment||p.segment===featuredSegment).map(p=>p.vehicle));
    if(veh){veh.innerHTML='<option value="">All Vehicles</option>'+vehicles.map(x=>`<option value="${esc(x)}" ${x===featuredVehicle?'selected':''}>${esc(x)}</option>`).join('');}
    const models=uniq(base.filter(p=>(!featuredSegment||p.segment===featuredSegment)&&(!featuredVehicle||p.vehicle===featuredVehicle)).flatMap(p=>splitModelValues(p.model)));
    if(mod){mod.innerHTML='<option value="">All Models</option>'+models.map(x=>`<option value="${esc(x)}" ${x===featuredModel?'selected':''}>${esc(x)}</option>`).join('');}
  }

  function renderFeaturedCategoryOptions(){
    const root=$('#featuredCategoryOptions');if(!root)return;
    const q=($('#featuredCategorySearch')?.value||'').trim().toLowerCase();
    const items=productCategories.filter(x=>!q||String(x.name).toLowerCase().includes(q)).sort((a,b)=>naturalCompare(a.name,b.name));
    root.innerHTML=`<button type="button" data-category="" class="${featuredCategory?'':'active'}">All Product Categories <small>${products.length.toLocaleString()}</small></button>`+
      items.map(x=>`<button type="button" data-category="${esc(x.name)}" class="${featuredCategory===x.name?'active':''}">${esc(x.name)} <small>${Number(x.productCount||0).toLocaleString()}</small></button>`).join('');
  }
  function renderFeatured(){
    const all=products.filter(p=>{
      if(featuredBrand&&p.group!==featuredBrand)return false;
      if(featuredCategory&&!((p.categories||[p.category]).some(c=>String(c).toLowerCase()===featuredCategory.toLowerCase())||String(p.category||'').toLowerCase()===featuredCategory.toLowerCase()))return false;
      if(featuredSegment&&p.segment!==featuredSegment)return false;
      if(featuredVehicle&&p.vehicle!==featuredVehicle)return false;
      if(featuredModel&&!modelMatches(p.model,featuredModel))return false;
      return true;
    }).slice().sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description));
    const total=Math.max(1,Math.ceil(all.length/FEATURED_PAGE_SIZE));if(featuredPage>total)featuredPage=total;
    const start=(featuredPage-1)*FEATURED_PAGE_SIZE;
    const list=all.slice(start,start+FEATURED_PAGE_SIZE);
    $('#featuredProducts').innerHTML=list.length?list.map(p=>productCard(p)).join(''):'<div class="home-loading">No products mapped to this category yet.</div>';
    renderFeaturedPagination(total);
    const view=$('#featuredViewAll');if(view){const q=new URLSearchParams();if(featuredBrand)q.set('brand',featuredBrand);if(featuredCategory)q.set('category',featuredCategory);if(featuredSegment)q.set('segment',featuredSegment);if(featuredVehicle)q.set('vehicle',featuredVehicle);if(featuredModel)q.set('model',featuredModel);view.href='shop.html'+(q.toString()?`?${q}`:'')+'#shop';}
    renderFeaturedBrandOptions();
    renderFeaturedCategoryOptions();
  }
  function renderFeaturedPagination(total){
    const root=$('#featuredPagination');if(!root)return;if(total<=1){root.innerHTML='';return;}
    const nums=[1];for(let i=Math.max(2,featuredPage-2);i<=Math.min(total-1,featuredPage+2);i++)nums.push(i);if(total>1)nums.push(total);
    let html=`<button type="button" data-featured-page="${Math.max(1,featuredPage-1)}" ${featuredPage===1?'disabled':''}>‹</button>`,prev=0;
    [...new Set(nums)].forEach(n=>{if(prev&&n-prev>1)html+='<span>…</span>';html+=`<button type="button" class="${n===featuredPage?'active':''}" data-featured-page="${n}">${n}</button>`;prev=n;});
    html+=`<button type="button" data-featured-page="${Math.min(total,featuredPage+1)}" ${featuredPage===total?'disabled':''}>›</button>`;root.innerHTML=html;
    root.querySelectorAll('[data-featured-page]').forEach(b=>b.addEventListener('click',()=>{featuredPage=Number(b.dataset.featuredPage);renderFeatured();$('#featured').scrollIntoView({behavior:'smooth',block:'start'});}));
  }
  function renderDeals(){
    const saleItems=products.filter(saleFor);const list=saleItems.slice(0,4).length===4?saleItems.slice(0,4):pickProducts('',4,24);
    $('#dealProducts').innerHTML=list.map((p,i)=>dealCard(p,42+i*11)).join('');
  }
  function renderHorizontalDeals(){
    const priced=products.filter(p=>priceFor(p)>0);
    const source=priced.length?priced:products;
    const list=[...source].sort((a,b)=>{
      const salesDiff=(Number(b.sales)||0)-(Number(a.sales)||0);
      if(salesDiff)return salesDiff;
      return hash(String(b.code||'')+'best-seller')-hash(String(a.code||'')+'best-seller');
    }).slice(0,5);
    $('#horizontalDeals').innerHTML=list.map(p=>productCard(p)).join('');
  }
  function renderPartners(){
    if(!brandLogos.length)return;
    brandLogos.sort((a,b)=>naturalCompare(a.name,b.name));
    const size=16,total=Math.max(1,Math.ceil(brandLogos.length/size));
    const draw=()=>{
      partnerPage=(partnerPage+total)%total;
      const startIndex=partnerPage*size;
      const visibleCount=Math.min(size,brandLogos.length);
      const items=Array.from({length:visibleCount},(_,i)=>brandLogos[(startIndex+i)%brandLogos.length]);
      $('#partnerRail').innerHTML=items.map(x=>`<a class="partner-logo-card" href="shop.html?search=${encodeURIComponent((x.aliases&&x.aliases[0])||x.name)}#shop"><img src="${esc(x.image)}" alt="${esc(x.name)} logo"><b>${esc(x.name)}</b><small>${Number(x.productCount||0).toLocaleString()} products</small></a>`).join('');
      if($('#partnerPageStatus'))$('#partnerPageStatus').textContent=`${partnerPage+1} / ${total}`;
    };
    $('#partnerPrev')?.addEventListener('click',()=>{partnerPage--;draw();start();});
    $('#partnerNext')?.addEventListener('click',()=>{partnerPage++;draw();start();});
    const start=()=>{clearInterval(partnerTimer);partnerTimer=setInterval(()=>{partnerPage++;draw();},4500);};
    draw();start();
  }

  function pickProducts(term,count,offset=0){
    const q=String(term||'').toLowerCase();
    const priced=products.filter(p=>priceFor(p)>0);
    let list=q?priced.filter(p=>p._search.includes(q)||fuzzy(q,p)):priced;
    if(list.length<count)list=priced.length?priced:products;
    const selected=[]; const step=Math.max(1,Math.floor(list.length/(count+offset+2)));
    for(let i=0;i<count;i++)selected.push(list[(offset+i*step)%list.length]);
    return selected.filter(Boolean);
  }
  function fuzzy(term,p){
    const maps={brake:['brake','lining','disc','drum'],oil:['oil','grease','coolant','fluid'],wheel:['wheel','hub','rim','tyre','tire'],tool:['tool','spanner','kit','jack','washer'],engine:['engine','piston','fly wheel','bearing'],light:['lamp','light','bulb','indicator']};
    const hay=`${p.description} ${p.group}`.toLowerCase();
    return (maps[term]||term.split(/\s+/)).some(k=>k&&hay.includes(k));
  }

  function productCard(p){
    const price=priceFor(p),old=oldPriceFor(p),kind=kindFor(p);
    return `<article class="home-product-card" data-id="${esc(p._id)}">
      <span class="home-badge blue part-number-badge">${esc(p.code||'PART NO.')}</span>
      <div class="home-product-media" role="button" tabindex="0" title="Click to view product details">${window.RAJProductImages?window.RAJProductImages.markup(p,'home'):(p.image?`<img class="home-product-real-image" src="${esc(p.image)}" alt="${esc(p.description)}">`:`<i class="home-product-icon ${kind.cls}">${kind.text}</i><small>Image placeholder</small>`)}<div class="home-card-actions"><button type="button" data-action="wish" title="Wishlist">♡</button><button type="button" data-action="quick" title="Quick view">⌕</button></div></div>
      <div class="home-product-body"><div class="home-product-brand">${esc(p.group||'RAJ AGENCIES')}</div><h3 class="home-product-title"><a href="product.html?id=${encodeURIComponent(p._id)}">${esc(p.description||'Automotive spare part')}</a></h3><div class="home-rating">★★★★★ <span>${ratingFor(p)}</span></div><div class="home-price"><span class="card-price-label">MRP</span><b>${money(price)}</b></div><div class="home-stock">Part: ${esc(p.code||'—')} · HSN ${esc(p.hsn||'—')} · GST ${esc(p.gst||0)}%</div><button class="home-add" type="button" data-action="cart">Add to cart</button></div>
    </article>`;
  }
  function dealCard(p,sold){
    const price=priceFor(p),old=oldPriceFor(p),kind=kindFor(p),available=100-sold;
    return `<article class="deal-card home-product-card" data-id="${esc(p._id)}"><span class="home-badge blue part-number-badge">${esc(p.code||'PART NO.')}</span><div class="home-product-media" role="button" tabindex="0" title="Click to view product details">${window.RAJProductImages?window.RAJProductImages.markup(p,'home'):(p.image?`<img class="home-product-real-image" src="${esc(p.image)}" alt="${esc(p.description)}">`:`<i class="home-product-icon ${kind.cls}">${kind.text}</i><small>Image placeholder</small>`)}<div class="home-card-actions"><button type="button" data-action="wish">♡</button><button type="button" data-action="quick">⌕</button></div></div><div class="home-product-body"><div class="home-product-brand">${esc(p.group)}</div><h3 class="home-product-title"><a href="product.html?id=${encodeURIComponent(p._id)}">${esc(p.description)}</a></h3><div class="home-rating">★★★★★ <span>${ratingFor(p)}</span></div><div class="home-price"><span class="card-price-label">MRP</span><b>${money(price)}</b></div><div class="deal-progress"><i style="width:${sold}%"></i></div><div class="deal-meta"><span>Available: ${available}</span><span>Sold: ${sold}</span></div><button class="home-add" type="button" data-action="cart">Add to cart</button></div></article>`;
  }
  function kindFor(p){
    const h=`${p.description} ${p.group}`.toLowerCase();
    if(/wheel|hub|rim|tyre|tire/.test(h))return{cls:'kind-wheel',text:''};
    if(/brake|disc|drum|lining/.test(h))return{cls:'kind-brake',text:''};
    if(/oil|grease|coolant|fluid/.test(h))return{cls:'kind-oil',text:'RAJ'};
    if(/lamp|light|bulb|indicator/.test(h))return{cls:'kind-light',text:''};
    if(/engine|piston|bearing|fly/.test(h))return{cls:'kind-engine',text:'⚙'};
    return{cls:'kind-engine',text:'⚙'};
  }
  function badgeFor(p){return{text:p.code||'PART NO.',cls:'blue part-number-badge'};}

  function handleDocumentClick(e){
    const card=e.target.closest('[data-id]');
    const product=card?products.find(x=>String(x._id)===String(card.dataset.id)):null;
    const action=e.target.closest('[data-action]');
    if(action&&product){
      if(action.dataset.action==='cart')addToCart(product);
      if(action.dataset.action==='wish')toggleWishlist(product);
      if(action.dataset.action==='quick')openQuick(product);
      return;
    }
    const media=e.target.closest('.home-product-media');
    if(media&&product&&!e.target.closest('a,button'))openQuick(product);
  }

  function showSuggestions(){
    const el=$('#searchSuggestions'); if(!el||!products.length)return;
    const q=$('#headerSearch').value.trim().toLowerCase(); if(q.length<2){hideSuggestions();return;}
    const items=products.filter(p=>p._search.includes(q)).sort((a,b)=>naturalCompare(a.code,b.code)||naturalCompare(a.description,b.description)).slice(0,6);
    if(!items.length){el.innerHTML='<div class="suggestion"><div></div><div><b>No matching items</b><small>Try a brand, item code or product description.</small></div></div>';el.classList.add('show');return;}
    el.innerHTML=items.map(p=>`<a class="suggestion" href="shop.html?search=${encodeURIComponent(p.description)}#shop"><div class="suggestion-img">${window.RAJProductImages?window.RAJProductImages.markup(p,'suggestion',{alt:p.description||''}):(p.image?`<img src="${esc(p.image)}" alt="">`:"IMAGE")}</div><div><b>${esc(p.description)}</b><small>${esc(p.group)} · ${esc(p.code)}</small></div><em>${money(priceFor(p))}</em></a>`).join('');
    el.classList.add('show');
  }
  function hideSuggestions(){$('#searchSuggestions')?.classList.remove('show');}
  function goSearch(query,category){
    const q=normalize(query)||normalize(category); const params=new URLSearchParams(); if(q)params.set('search',q);
    location.href='shop.html'+(params.toString()?`?${params}`:'')+'#shop';
  }

  function addToCart(p){
    const existing=cart.find(x=>x.id===p._id); if(existing)existing.qty+=1;else cart.push({id:p._id,code:p.code,description:p.description,title:p.description,group:p.group,image:p.image||'',price:priceFor(p),qty:1});
    saveStore('rajCart',cart);updateStoredUI();toast(`${p.description} added to cart.`);
  }
  function toggleWishlist(p){
    const idx=wishlist.findIndex(x=>x.id===p._id);
    if(idx>=0){wishlist.splice(idx,1);toast('Removed from wishlist.');}else{wishlist.push({id:p._id,code:p.code,description:p.description,title:p.description,group:p.group,image:p.image||'',price:priceFor(p)});toast('Added to wishlist.');}
    saveStore('rajWishlist',wishlist);updateStoredUI();
  }
  function updateStoredUI(){
    const qty=cart.reduce((s,x)=>s+(x.qty||1),0), total=cart.reduce((s,x)=>s+(x.price||0)*(x.qty||1),0);
    if($('#cartCount'))$('#cartCount').textContent=qty;if($('#cartTotal'))$('#cartTotal').textContent=money(total);if($('#drawerCartTotal'))$('#drawerCartTotal').textContent=money(total);
    if($('#wishlistCount'))$('#wishlistCount').textContent=wishlist.length;if($('#utilityWishlistCount'))$('#utilityWishlistCount').textContent=wishlist.length;
    renderDrawerItems();
  }
  function renderDrawerItems(){
    const cartEl=$('#cartItems'),wishEl=$('#wishlistItems');
    if(cartEl)cartEl.innerHTML=cart.length?cart.map((x,i)=>`<div class="drawer-product"><div class="drawer-product-img">${window.RAJProductImages?window.RAJProductImages.markup(x,'drawer',{alt:x.description||x.title||'Product image'}):'<img src="assets/raj-group-product-fallback.png" alt="Raj Group">'}</div><div><b>${esc(x.description||x.title||'Product')}</b><small>${x.qty||1} × ${money(x.price)}</small></div><button data-remove-cart="${i}" type="button">×</button></div>`).join(''):'<div class="empty-state">No products in the cart.</div>';
    if(wishEl)wishEl.innerHTML=wishlist.length?wishlist.map((x,i)=>`<div class="drawer-product"><div class="drawer-product-img">${window.RAJProductImages?window.RAJProductImages.markup(x,'drawer',{alt:x.description||x.title||'Product image'}):'<img src="assets/raj-group-product-fallback.png" alt="Raj Group">'}</div><div><b>${esc(x.description||x.title||'Product')}</b><small>${esc(x.group||'')} · ${money(x.price)}</small></div><button data-remove-wish="${i}" type="button">×</button></div>`).join(''):'<div class="empty-state">Your wishlist is empty.</div>';
    $$('[data-remove-cart]').forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.removeCart),1);saveStore('rajCart',cart);updateStoredUI();});
    $$('[data-remove-wish]').forEach(b=>b.onclick=()=>{wishlist.splice(Number(b.dataset.removeWish),1);saveStore('rajWishlist',wishlist);updateStoredUI();});
  }
  function openQuick(p){
    quickProduct=p;
    window.RAJProductImages?.setElementImage($('.quick-image'),p,'quick');
    setQuickText('#quickBrand',p.group||'RAJ AGENCIES');
    setQuickText('#quickTitle',p.description||'Product');
    setQuickText('#quickPrice',money(priceFor(p)));
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
    $('#quickWhatsApp').href=`https://wa.me/918128242316?text=${encodeURIComponent(`Hi, I want details for ${p.description} (${p.code}).`)}`;
    $('#quickAddCart').onclick=()=>addToCart(p);
    openLayer($('#quickView'),false);
  }

  function bindSlider(){
    $('#heroPrev')?.addEventListener('click',()=>showSlide(activeSlide-1));
    $('#heroNext')?.addEventListener('click',()=>showSlide(activeSlide+1));
    $$('#heroDots button').forEach((b,i)=>b.addEventListener('click',()=>showSlide(i)));
    const slider=$('#heroSlider'); slider?.addEventListener('mouseenter',()=>clearInterval(sliderTimer));slider?.addEventListener('mouseleave',startSlider);
    startSlider();
  }
  function showSlide(index){
    const slides=$$('.hero-slide'),dots=$$('#heroDots button');if(!slides.length)return;activeSlide=(index+slides.length)%slides.length;
    slides.forEach((s,i)=>s.classList.toggle('active',i===activeSlide));dots.forEach((d,i)=>d.classList.toggle('active',i===activeSlide));
  }
  function startSlider(){clearInterval(sliderTimer);sliderTimer=setInterval(()=>showSlide(activeSlide+1),Number(window.RAJ_SITE_CONFIG?.heroRotationMs)||6000);}

  function startCountdown(){
    const end=Date.now()+7*24*60*60*1000+9*60*60*1000;
    const tick=()=>{const diff=Math.max(0,end-Date.now()),d=Math.floor(diff/86400000),h=Math.floor(diff/3600000)%24,m=Math.floor(diff/60000)%60,s=Math.floor(diff/1000)%60;setText('days',pad(d));setText('hours',pad(h));setText('mins',pad(m));setText('secs',pad(s));setText('dealDays',pad(d));setText('dealHours',pad(h));setText('dealMins',pad(m));setText('dealSecs',pad(s));};
    tick();setInterval(tick,1000);
  }
  function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function pad(n){return String(n).padStart(2,'0');}

  function openLayer(el,overlay=true){if(!el)return;closeLayers();el.classList.add('show');el.setAttribute('aria-hidden','false');if(overlay&&!el.classList.contains('modal')&&!el.classList.contains('quick-view'))$('#pageOverlay')?.classList.add('show');document.body.style.overflow='hidden';}
  function closeLayers(){$$('.drawer,.modal,.quick-view,.mobile-menu').forEach(x=>{x.classList.remove('show');x.setAttribute('aria-hidden','true');});$('#pageOverlay')?.classList.remove('show');document.body.style.overflow='';}
  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2300);}
  function loadStore(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
  function saveStore(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function debounce(fn,wait){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait)}}

  function demoProducts(){
    const rows=[['AAYUB','AA1004','Fly Wheel Assembly for Tata 407','HCV','TATA','407'],['ALLIED','ALB2201','Premium Brake Lining Set','HCV, LCV','ASHOK LEYLAND','Multiple'],['BLUE BIRD','BB1540','Heavy Duty Diesel Engine Oil','UNIVERSAL','COMMON','All Models'],['SPICER-N','SDUJ0055L106','Universal Joint Kit SPL55','HCV','JCB','30X / 909'],['ASK','ASK4007','Commercial Vehicle Brake Lining','HCV','TATA','407'],['ASHWAMEGH','AWC20','Long Life Coolant Concentrate','UNIVERSAL','COMMON','All Models'],['ATOP','ATSW125','Spring Washer Industrial Pack','UNIVERSAL','COMMON','Multiple'],['ALLIED','ABP331','Disc Brake Pad Set','LCV','MAHINDRA','Bolero'],['AAYUB','AA1005','Front Wheel Assembly 12 Hole','HCV','TATA','1613 Turbo'],['BLUE BIRD','BBG500','Multipurpose Automotive Grease','UNIVERSAL','COMMON','All Models'],['SPICER-N','SPCR890','Propeller Shaft Component','HCV','TATA','1109'],['ALLIED','ABR220','Brake Rotor Assembly','LCV','FORCE','Traveller'],['APPOLO','APP901','Engine Packing Kit','TRACTOR','MAHINDRA','575'],['BRAVO','BRV411','Automotive Hardware Kit','UNIVERSAL','COMMON','Multiple'],['AAYUB','AA1007','Wheel Assembly Euro IV','HCV','TATA','1109 BS6'],['BLUE BIRD','BBT90','Transmission Oil Premium','TRACTOR','COMMON','All Models']];
    return rows.map(([group,code,description,segment,vehicle,model])=>({group,code,description,segment,vehicle,model,unit:'PCS'}));
  }
})();
