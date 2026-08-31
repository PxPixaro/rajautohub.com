(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', async()=>{
    try{
      const c=await fetch('data/site-config.json').then(r=>r.json());window.RAJ_SITE_CONFIG=c;
      document.querySelectorAll('.brand span b').forEach(x=>x.textContent=c.companyName||'RAJ AGENCIES');
      document.querySelectorAll('.brand span small').forEach(x=>x.textContent=c.tagline||'');
      document.querySelectorAll('img[src*="raj-logo"]').forEach(x=>{if(c.logo)x.src=c.logo;});
      document.querySelectorAll('a[href*="instagram.com"]').forEach(x=>x.href=c.instagram||x.href);
      document.querySelectorAll('a[href*="facebook.com"]').forEach(x=>x.href=c.facebook||x.href);
      document.querySelectorAll('a[href^="tel:"]').forEach(x=>x.href='tel:'+(c.customerCareTel||''));
      document.querySelectorAll('.nav-help b,.footer-phone').forEach(x=>x.textContent=c.customerCare||x.textContent);
      document.querySelectorAll('a[href*="wa.me/"]').forEach(x=>{const msg=x.href.includes('?')?'?'+x.href.split('?')[1]:'';x.href='https://wa.me/'+(c.whatsappNumber||'')+msg;});
      document.querySelectorAll('a[href^="mailto:"]').forEach(x=>{x.href='mailto:'+(c.email||'');x.textContent=c.email||x.textContent;});
      document.title=document.title.replace(/Raj Agencies/gi,c.companyName||'Raj Agencies');
    }catch(e){console.warn('Site config could not load',e);}
  });
})();
