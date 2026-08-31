(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
  const money = value => Number(value) > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value))
    : 'Price on Request';
  const load = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
  const firstValue = (product, keys) => { if(!product||typeof product!=='object')return ''; for (const key of keys) { const value=product[key]; if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim(); } const wanted=new Set(keys.map(key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,''))); for(const [key,value] of Object.entries(product)){ if(wanted.has(String(key).toLowerCase().replace(/[^a-z0-9]/g,''))&&value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim(); } return ''; };
  const packageText = (value, unit) => { const clean=String(value??'').trim(); if(!clean)return ''; return /^[-+]?\d+(?:\.\d+)?$/.test(clean) ? `${clean} ${String(unit||'PCS').trim()}` : clean; };
  const stdPkgFor = p => packageText(firstValue(p,['stdPkg','std_pkg','stdPackage','standardPack','standardPkg','stdPack','stdPacking','standardPacking','stdPkgQty','standardQty','STD PKG','Std Pkg']),p?.unit);
  const crtPkgFor = p => packageText(firstValue(p,['crtPkg','crt_pkg','crtPackage','cartonPack','cartonPkg','crtPack','casePack','cartonPacking','crtPkgQty','cartonQty','caseQty','CRT PKG','Crt Pkg']),p?.unit);
  const setOptionalDetail = (name,selector,value) => { const row=document.querySelector(`[data-detail-optional="${name}"]`); setText(selector,value||'—'); if(row)row.hidden=!value; };

  document.addEventListener('DOMContentLoaded', () => {
    $$('.current-year').forEach(node => { node.textContent = new Date().getFullYear(); });
    $('#simpleMenuBtn')?.addEventListener('click', () => $('#simpleMobileMenu')?.classList.toggle('show'));
    $('#contactPageForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      window.open(`https://wa.me/918128242316?text=${encodeURIComponent(`Website enquiry\nName: ${form.name.value}\nPhone: ${form.phone.value}\nCompany: ${form.company.value}\nMessage: ${form.message.value}`)}`, '_blank');
    });
    $('#trackingForm')?.addEventListener('submit', event => {
      event.preventDefault();
      $('#trackingResult').innerHTML = '<div class="info-panel"><h3>Tracking interface ready</h3><p>Connect the ERP/API to display live order and dispatch status.</p></div>';
    });
    $('#checkoutForm')?.addEventListener('submit', event => {
      event.preventDefault();
      alert('Checkout interface is ready. Connect payment gateway and ERP for live orders.');
    });
    initCartPage();
    initProductPage();
    initTabs();
  });

  function initCartPage() {
    const box = $('#cartPageItems');
    if (!box) return;
    let cart = load('rajCart');
    const render = () => {
      const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
      box.innerHTML = cart.length ? cart.map(item => {
        const image = window.RAJProductImages
          ? window.RAJProductImages.markup(item, 'drawer', { alt: item.title || item.description || 'Product image' })
          : 'IMAGE';
        return `<div class="cart-row"><div class="cart-row-img">${image}</div><div><b>${esc(item.title || item.description || 'Product')}</b><small>${esc(item.code || '')}</small></div><div>${item.qty || 1} × ${money(item.price)}</div><div><button type="button" data-remove="${esc(item.id)}">Remove</button></div></div>`;
      }).join('') : '<div class="empty-state">Your cart is empty. Add products from the shop catalogue.</div>';
      setText('#cartPageSubtotal', money(total));
      setText('#cartPageTotal', money(total));
      $$('[data-remove]').forEach(button => {
        button.onclick = () => {
          cart = cart.filter(item => String(item.id) !== String(button.dataset.remove));
          save('rajCart', cart);
          render();
        };
      });
    };
    render();
  }

  async function initProductPage() {
    const root = $('#productPage');
    if (!root) return;
    try {
      const response = await fetch('data/products.json');
      if (!response.ok) throw new Error(`products ${response.status}`);
      const rows = await response.json();
      const products = window.RAJProductImages ? await window.RAJProductImages.apply(rows) : rows;
      const requestedId = new URLSearchParams(location.search).get('id');
      const product = products.find(item => String(item.id) === String(requestedId)) ||
        products.find(item => String(item.code) === String(requestedId)) || products[0];
      if (!product) throw new Error('No product found');

      const listRate = Number(product.listRate) || 0;
      const mrp = Number(product.mrp) || listRate;
      const price = mrp;
      setText('#detailTitle', product.description || product.code || 'Product');
      setText('#detailBrand', product.group || 'RAJ AGENCIES');
      setText('#detailPrice', money(price));
      setText('#detailCode', product.code || 'N/A');
      setText('#detailCategory', product.category || 'General Automotive Parts');
      setText('#detailHsn', product.hsn || 'N/A');
      setText('#detailGst', `${Number(product.gst) || 0}%`);
      setText('#detailUnit', product.unit || 'PCS');
      setText('#detailMrp', mrp ? money(mrp) : 'Price on Request');
      setOptionalDetail('std','#detailStdPkg',stdPkgFor(product));
      setOptionalDetail('crt','#detailCrtPkg',crtPkgFor(product));
      setText('#detailSegment', product.segment || 'HCV');
      setText('#detailVehicle', product.vehicle || 'COMMON');
      setText('#detailModel', product.model || 'ALL MODELS');
      setText('#detailDescription', `${product.description || 'Product'}. Catalogue details include part number, HSN, GST, MRP, packaging, segment, vehicle and model reference.`);

      const imageBox = $('#detailImage');
      if (window.RAJProductImages) {
        window.RAJProductImages.setElementImage(imageBox, product, 'detail');
      } else if (imageBox && product.image) {
        imageBox.innerHTML = `<img class="detail-product-image" src="${esc(product.image)}" alt="${esc(product.description)}">`;
        imageBox.classList.add('has-product-image');
      }

      const whatsapp = $('#detailWhatsApp');
      if (whatsapp) whatsapp.href = `https://wa.me/918128242316?text=${encodeURIComponent(`Hello Raj Agencies, I need details for ${product.code} - ${product.description}`)}`;
      const addButton = $('#detailAddCart');
      if (addButton) addButton.onclick = () => {
        const cart = load('rajCart');
        const id = product.id || product.code;
        const found = cart.find(item => String(item.id) === String(id));
        if (found) found.qty = (Number(found.qty) || 1) + 1;
        else cart.push({ id, code: product.code, title: product.description, description: product.description, image: product.image || '', price, qty: 1 });
        save('rajCart', cart);
        alert('Product added to cart.');
      };
    } catch (error) {
      console.error(error);
      root.innerHTML = '<div class="empty-state">Product catalogue could not load. Please run through a local web server.</div>';
    }
  }

  function initTabs() {
    $$('[data-tab]').forEach(button => button.addEventListener('click', () => {
      $$('[data-tab]').forEach(item => item.classList.toggle('active', item === button));
      $$('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === button.dataset.tab));
    }));
  }
})();
