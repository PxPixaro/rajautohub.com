(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const naturalCompare=(a,b)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});
  const defaults=[
    {name:'Retail Partner',location:'Surat',rating:5,message:'Raj Agencies provides dependable product support and helps us source a wide range of parts through one channel.',createdAt:'2026-01-01'},
    {name:'Auto Parts Dealer',location:'Ahmedabad',rating:5,message:'The catalogue and WhatsApp service make it easier to request product details and availability.',createdAt:'2026-01-02'},
    {name:'Workshop Customer',location:'Gujarat',rating:5,message:'Professional coordination, broad segment coverage and responsive service for regular orders.',createdAt:'2026-01-03'},
    {name:'Channel Partner',location:'Western India',rating:5,message:'Strong product network and helpful team support across multiple automotive categories.',createdAt:'2026-01-04'}
  ];
  document.addEventListener('DOMContentLoaded',()=>{
    const form=$('#customerReviewForm'); if(!form)return;
    render();
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const data=new FormData(form);
      const review={
        name:String(data.get('name')||'').trim(),
        location:String(data.get('location')||'').trim(),
        rating:Number(data.get('rating')||0),
        message:String(data.get('message')||'').trim(),
        createdAt:new Date().toISOString()
      };
      if(!review.name||!review.location||!review.message||review.rating<1){setStatus('Please complete all review fields.','error');return;}
      const saved=load(); saved.push(review); save(saved); form.reset();
      if(review.rating>=4){setStatus('Thank you. Your positive review is now shown below.','success');render();}
      else setStatus('Thank you. Your review has been saved for moderation.','success');
    });
  });
  function load(){try{const value=JSON.parse(localStorage.getItem('rajCustomerReviews')||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
  function save(items){try{localStorage.setItem('rajCustomerReviews',JSON.stringify(items));}catch{}}
  function initials(name){return String(name||'R').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
  function render(){
    const root=$('#customerReviewGrid');if(!root)return;
    const items=[...defaults,...load()].filter(x=>Number(x.rating)>=4).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||naturalCompare(a.name,b.name)).slice(0,8);
    root.innerHTML=items.map(x=>`<article class="customer-review-card"><div class="review-stars">${'★'.repeat(Math.max(1,Math.min(5,Number(x.rating)||5)))}</div><p>${esc(x.message)}</p><div class="review-author"><span>${esc(initials(x.name))}</span><b>${esc(x.name)}<small>${esc(x.location)}</small></b></div></article>`).join('');
  }
  function setStatus(message,type){const el=$('#customerReviewStatus');if(!el)return;el.className='review-form-status '+(type||'');el.textContent=message;}
})();
