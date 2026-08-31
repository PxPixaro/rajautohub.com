(() => {
  'use strict';
  const registry = new Map();
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const naturalCompare = (a,b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric:true, sensitivity:'base'});

  class SmartSelect {
    constructor(select){
      this.select=select;
      this.root=document.createElement('div');
      this.root.className='smart-select';
      this.root.innerHTML=`<button class="smart-select-toggle" type="button" aria-expanded="false"></button><div class="smart-select-menu" hidden><input class="smart-select-search" type="search" autocomplete="off" placeholder="Search options..."><div class="smart-select-options" role="listbox"></div></div>`;
      select.classList.add('smart-select-native');
      select.insertAdjacentElement('afterend',this.root);
      this.toggle=this.root.querySelector('.smart-select-toggle');
      this.menu=this.root.querySelector('.smart-select-menu');
      this.search=this.root.querySelector('.smart-select-search');
      this.options=this.root.querySelector('.smart-select-options');
      this.toggle.addEventListener('click',e=>{e.stopPropagation();this.menu.hidden?this.open():this.close();});
      this.search.addEventListener('input',()=>this.draw(this.search.value));
      this.options.addEventListener('click',e=>{
        const option=e.target.closest('[data-value]');
        if(!option)return;
        this.select.value=option.dataset.value;
        this.select.dispatchEvent(new Event('change',{bubbles:true}));
        this.refresh();
        this.close();
      });
      this.select.addEventListener('change',()=>this.refreshLabel());
      this.refresh();
    }
    open(){
      document.querySelectorAll('.smart-select.open').forEach(x=>{if(x!==this.root)x._instance?.close();});
      this.root.classList.add('open');
      this.menu.hidden=false;
      this.toggle.setAttribute('aria-expanded','true');
      this.search.value='';
      this.draw('');
      setTimeout(()=>this.search.focus(),0);
    }
    close(){
      this.root.classList.remove('open');
      this.menu.hidden=true;
      this.toggle.setAttribute('aria-expanded','false');
    }
    refresh(){
      const rows=[...this.select.options].map((o,index)=>({value:o.value,label:o.textContent.trim(),disabled:o.disabled,index}));
      this.items=rows.length?[rows[0],...rows.slice(1).sort((a,b)=>naturalCompare(a.label,b.label))]:[];
      this.refreshLabel();
      this.draw(this.search.value||'');
    }
    refreshLabel(){
      const selected=this.select.options[this.select.selectedIndex]||this.select.options[0];
      this.toggle.innerHTML=`<span>${esc(selected?.textContent?.trim()||'Select option')}</span><i>⌄</i>`;
    }
    draw(term){
      const q=String(term||'').trim().toLowerCase();
      const items=this.items.filter(x=>!q||x.label.toLowerCase().includes(q));
      this.options.innerHTML=items.length?items.map(x=>`<button type="button" role="option" data-value="${esc(x.value)}" class="${this.select.value===x.value?'selected':''}" ${x.disabled?'disabled':''}>${esc(x.label)}</button>`).join(''):'<div class="smart-select-empty">No matching option</div>';
    }
  }

  function init(target){
    const elements=typeof target==='string'?[...document.querySelectorAll(target)]:target instanceof Element?[target]:[...(target||[])];
    return elements.map(select=>{
      if(!select||select.tagName!=='SELECT')return null;
      if(registry.has(select))return registry.get(select);
      const instance=new SmartSelect(select);
      instance.root._instance=instance;
      registry.set(select,instance);
      return instance;
    }).filter(Boolean);
  }
  function refresh(target){
    if(typeof target==='string')document.querySelectorAll(target).forEach(refresh);
    else if(target instanceof Element){const instance=registry.get(target);instance?instance.refresh():init(target);}
  }
  function closeAll(){registry.forEach(x=>x.close());}
  document.addEventListener('click',e=>{if(!e.target.closest('.smart-select'))closeAll();});
  window.RAJSmartSelect={init,refresh,closeAll};
})();
