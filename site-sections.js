(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const naturalCompare=(a,b)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});

  document.addEventListener('DOMContentLoaded', async()=>{
    const needsAssets=$('[data-hero-image],[data-segment-grid],[data-certificate-carousel],[data-owner-grid],[data-segments-overview],[data-office-image],[data-engine-promo]');
    const needsGroups=$('[data-category-directory]');
    const needsProductCategories=$('[data-category-carousel]');
    try{
      const [assets,groups,productCategories]=await Promise.all([
        needsAssets?fetch('data/site-assets.json').then(check):Promise.resolve(null),
        needsGroups?fetch('data/categories.json').then(check):Promise.resolve(null),
        needsProductCategories?fetch('data/product-categories.json').then(check):Promise.resolve(null)
      ]);
      if(assets){renderMainImages(assets);renderHeroSlides(assets.heroSlides||[]);renderSegments(assets.segments||[]);renderOwners(assets.owners||[]);renderCertificates(assets.certificates||[]);}
      if(groups)renderGroupDirectory(groups);
      if(productCategories)renderProductCategoryCarousel(productCategories);
    }catch(e){console.error('Extra site sections could not load',e);}
  });

  function check(r){if(!r.ok)throw new Error(`${r.url}: ${r.status}`);return r.json();}
  function renderMainImages(a){$$('[data-segments-overview]').forEach(x=>{if(a.segmentsOverview)x.src=a.segmentsOverview;});$$('[data-office-image]').forEach(x=>{if(a.officeImage)x.src=a.officeImage;});$$('[data-engine-promo]').forEach(x=>{if(a.enginePromo)x.src=a.enginePromo;});}
  function renderHeroSlides(items){
    const images=$$('[data-hero-image]');
    images.forEach((img,index)=>{
      const item=items[index];
      if(!item)return;
      if(item.image)img.src=item.image;
      if(item.name)img.alt=item.name.replace(/[-_]+/g,' ');
    });
  }
  function renderSegments(items){items=[...items].sort((a,b)=>naturalCompare(a.name,b.name));$$('[data-segment-grid]').forEach(root=>{root.innerHTML=items.map(x=>`<a class="segment-card" href="shop.html?segment=${encodeURIComponent(x.name)}#shop"><img src="${esc(x.image)}" alt="${esc(x.name)}"><span><b>${esc(x.name)}</b><small>${Number(x.productCount||0).toLocaleString()} catalogue products</small></span></a>`).join('');});}
  function renderOwners(items){items=[...items].sort((a,b)=>naturalCompare(a.name,b.name));$$('[data-owner-grid]').forEach(root=>{root.innerHTML=items.map((x,index)=>`<article class="owner-card"><div class="owner-photo-frame"><img src="${esc(x.image)}" alt="${esc(x.name)}"><span>${esc(x.role||'Director')}</span></div><div class="owner-copy"><small>RAJ AGENCIES LEADERSHIP</small><h3>${esc(x.name)}</h3><p>Committed to quality, professional service and long-term relationships with customers and business partners.</p><div class="owner-values"><span>Quality</span><span>Service</span><span>Trust</span></div><b class="owner-index">0${index+1}</b></div></article>`).join('');});}

  function renderProductCategoryCarousel(items){
    items=[...items].sort((a,b)=>naturalCompare(a.name,b.name));
    $$('[data-category-carousel]').forEach(root=>{
      let page=0,timer;
      const per=6,total=Math.max(1,Math.ceil(items.length/per));
      const rail=root.querySelector('.product-category-rail');
      const scope=root.closest('section')||root.parentElement;
      const status=scope?.querySelector('.category-carousel-status');
      const draw=()=>{
        page=(page+total)%total;
        const start=page*per;
        let set=items.slice(start,start+per);
        if(set.length<per&&items.length)set=set.concat(items.slice(0,per-set.length));
        rail.innerHTML=set.map(x=>`<a class="product-category-card" href="shop.html?category=${encodeURIComponent(x.name)}#shop"><img src="${esc(x.image)}" alt="${esc(x.name)}"><b>${esc(x.name)}</b><small>${Number(x.productCount||0).toLocaleString()} products</small></a>`).join('');
        if(status)status.textContent=`${page+1} / ${total}`;
      };
      const start=()=>{clearInterval(timer);timer=setInterval(()=>{page++;draw();},4500);};
      scope?.querySelector('[data-category-prev]')?.addEventListener('click',()=>{page--;draw();start();});
      scope?.querySelector('[data-category-next]')?.addEventListener('click',()=>{page++;draw();start();});
      draw();start();root.addEventListener('mouseenter',()=>clearInterval(timer));root.addEventListener('mouseleave',start);
    });
  }

  function renderGroupDirectory(items){
    items=[...items].map(x=>({...x,categories:[...(x.categories||[])].sort(naturalCompare)})).sort((a,b)=>naturalCompare(a.group,b.group));
    $$('[data-category-directory]').forEach(root=>{
      const search=$('#groupCategorySearch');
      const pagination=$('#groupCategoryPagination');
      const per=10;
      let page=1,filtered=[...items];
      const draw=()=>{
        const total=Math.max(1,Math.ceil(filtered.length/per));if(page>total)page=total;
        const start=(page-1)*per;
        const set=filtered.slice(start,start+per);
        root.innerHTML=set.length?set.map(x=>`<article class="category-directory-card"><div><small>${Number(x.productCount||0).toLocaleString()} products</small><h3>${esc(x.group)}</h3><p>${esc(x.description||'Automotive spare parts and components')}</p></div><div class="category-tags">${(x.categories||[]).slice(0,4).map(c=>`<a href="shop.html?category=${encodeURIComponent(c)}#shop">${esc(c)}</a>`).join('')||'<span>Category mapping ready</span>'}</div></article>`).join(''):'<div class="home-loading">No matching group or category.</div>';
        drawPagination(total);
      };
      const drawPagination=total=>{
        if(!pagination)return;if(total<=1){pagination.innerHTML='';return;}
        const nums=[1];for(let i=Math.max(2,page-2);i<=Math.min(total-1,page+2);i++)nums.push(i);if(total>1)nums.push(total);
        let html=`<button type="button" data-group-page="${Math.max(1,page-1)}" ${page===1?'disabled':''}>‹</button>`,prev=0;
        [...new Set(nums)].forEach(n=>{if(prev&&n-prev>1)html+='<span>…</span>';html+=`<button type="button" class="${n===page?'active':''}" data-group-page="${n}">${n}</button>`;prev=n;});
        html+=`<button type="button" data-group-page="${Math.min(total,page+1)}" ${page===total?'disabled':''}>›</button>`;pagination.innerHTML=html;
        pagination.querySelectorAll('[data-group-page]').forEach(b=>b.addEventListener('click',()=>{page=Number(b.dataset.groupPage);draw();root.closest('section')?.scrollIntoView({behavior:'smooth',block:'start'});}));
      };
      search?.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();filtered=items.filter(x=>!q||`${x.group} ${x.description} ${(x.categories||[]).join(' ')}`.toLowerCase().includes(q));page=1;draw();});
      draw();
    });
  }

  function renderCertificates(items){items=[...items].sort((a,b)=>naturalCompare(a.title,b.title));$$('[data-certificate-carousel]').forEach(root=>{let page=0,timer;const per=4,total=Math.max(1,Math.ceil(items.length/per));const rail=root.querySelector('.certificate-rail'),status=root.querySelector('.certificate-status')||root.parentElement?.querySelector('.certificate-status');const draw=()=>{page=(page+total)%total;const start=page*per;let set=items.slice(start,start+per);if(set.length<per&&items.length)set=set.concat(items.slice(0,per-set.length));rail.innerHTML=set.map(x=>`<figure class="certificate-card"><img src="${esc(x.image)}" alt="${esc(x.title)}"><figcaption>${esc(x.title)}</figcaption></figure>`).join('');if(status)status.textContent=`${page+1} / ${total}`;};const start=()=>{clearInterval(timer);timer=setInterval(()=>{page++;draw();},Number(window.RAJ_SITE_CONFIG?.certificateRotationMs)||5000);};const scope=root.closest('section')||root.parentElement;scope?.querySelector('[data-cert-prev]')?.addEventListener('click',()=>{page--;draw();start();});scope?.querySelector('[data-cert-next]')?.addEventListener('click',()=>{page++;draw();start();});draw();start();root.addEventListener('mouseenter',()=>clearInterval(timer));root.addEventListener('mouseleave',start);});}
})();
