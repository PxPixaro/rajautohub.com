(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clean = value => String(value ?? '').trim();
  const naturalCompare = (a,b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric:true, sensitivity:'base'});

  document.addEventListener('DOMContentLoaded', async () => {
    const mega = document.getElementById('categoryMega');
    const home = document.getElementById('homeCategoryPanel');
    if (!mega && !home) return;
    try {
      const [groupRows, productCategories] = await Promise.all([
        mega ? fetch('data/categories.json').then(check) : Promise.resolve([]),
        home ? fetch('data/product-categories.json').then(check) : Promise.resolve([])
      ]);
      const groups = (groupRows || []).map((row, index) => ({
        index,
        group: clean(row.group),
        description: clean(row.description),
        categories: [...new Set((row.categories || []).map(clean).filter(Boolean))].sort(naturalCompare),
        productCount: Number(row.productCount || 0)
      })).filter(row => row.group).sort((a,b)=>naturalCompare(a.group,b.group));
      const flatCategories = (productCategories || []).map((row,index)=>({
        index,
        name: clean(row.name),
        productCount: Number(row.productCount || 0)
      })).filter(row=>row.name).sort((a,b)=>naturalCompare(a.name,b.name));
      if (mega) renderMega(mega, groups);
      if (home) renderHomeCategories(home, flatCategories);
    } catch (error) {
      console.warn('Category menu could not load', error);
      document.querySelectorAll('.category-menu-loading').forEach(el => el.textContent = 'Categories unavailable');
    }
  });

  function check(response){ if(!response.ok) throw new Error(`${response.url}: ${response.status}`); return response.json(); }

  function renderMega(root, rows) {
    root.innerHTML = `
      <div class="category-mega-search"><input type="search" placeholder="Search group or category..." aria-label="Search category groups"></div>
      <div class="category-mega-layout">
        <div class="category-group-list" role="listbox"></div>
        <div class="category-subcategory-panel"></div>
      </div>`;
    const input = root.querySelector('input');
    const groupList = root.querySelector('.category-group-list');
    const categoryPanel = root.querySelector('.category-subcategory-panel');
    let visible = rows;
    let activeIndex = rows[0]?.index;

    const drawGroups = () => {
      const q = input.value.trim().toLowerCase();
      visible = rows.filter(row => !q || row.group.toLowerCase().includes(q) || row.description.toLowerCase().includes(q) || row.categories.some(cat => cat.toLowerCase().includes(q)));
      if (!visible.some(row => row.index === activeIndex)) activeIndex = visible[0]?.index;
      groupList.innerHTML = visible.length ? visible.map(row => `
        <button type="button" data-category-group="${row.index}" class="${row.index === activeIndex ? 'active' : ''}">
          <span>${esc(row.group)}</span><small>${row.categories.length} categories</small><i>›</i>
        </button>`).join('') : '<div class="category-menu-empty">No matching group or category.</div>';
      drawCategories();
    };
    const drawCategories = () => {
      const row = rows.find(item => item.index === activeIndex);
      if (!row) { categoryPanel.innerHTML = '<div class="category-menu-empty">Select a group.</div>'; return; }
      categoryPanel.innerHTML = `
        <div class="category-subcategory-head"><div><b>${esc(row.group)}</b><small>${esc(row.description || 'Product categories')}</small></div><a href="shop.html?search=${encodeURIComponent(row.group)}#shop">View all products →</a></div>
        <div class="category-subcategory-links">
          ${row.categories.length ? row.categories.map(cat => `<a href="shop.html?category=${encodeURIComponent(cat)}#shop">${esc(cat)}</a>`).join('') : '<span>No categories mapped yet.</span>'}
        </div>`;
    };
    groupList.addEventListener('mouseover', event => {
      const button = event.target.closest('[data-category-group]');
      if (!button) return;
      activeIndex = Number(button.dataset.categoryGroup);
      groupList.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      drawCategories();
    });
    groupList.addEventListener('click', event => {
      const button = event.target.closest('[data-category-group]');
      if (!button) return;
      activeIndex = Number(button.dataset.categoryGroup);
      drawGroups();
    });
    input.addEventListener('input', drawGroups);
    root.addEventListener('click', event => event.stopPropagation());
    drawGroups();
  }

  function renderHomeCategories(root, items) {
    const groupRoot = root.querySelector('#homeCategoryGroups');
    if (!groupRoot) return;
    groupRoot.innerHTML = `<div class="home-category-search"><input type="search" placeholder="Search categories..." aria-label="Search product categories"></div><div class="home-category-group-scroll home-flat-category-scroll"></div>`;
    const input = groupRoot.querySelector('input');
    const scroll = groupRoot.querySelector('.home-category-group-scroll');
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const visible = items.filter(item => !q || item.name.toLowerCase().includes(q));
      scroll.innerHTML = visible.length ? visible.map(item => `
        <a class="home-flat-category" href="shop.html?category=${encodeURIComponent(item.name)}#shop">
          <span>${esc(item.name)}</span><small>${Number(item.productCount||0).toLocaleString()}</small><i>›</i>
        </a>`).join('') : '<div class="category-menu-empty">No matching category.</div>';
    };
    input.addEventListener('input', draw);
    draw();
  }
})();
