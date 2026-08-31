(() => {
  'use strict';

  const IMAGE_ROOT = 'assets/products/';
  const FALLBACK_LOGO = 'assets/raj-group-product-fallback.png';
  const EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'avif'];
  let manifestPromise;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const normalizeKey = value => String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[×*]/g, ' x ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const codeAliases = value => {
    const raw = String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const withX = raw.replace(/[×*]/g, 'x').replace(/[^a-z0-9]/g, '');
    const withoutX = withX.replace(/([0-9])x(?=[0-9])/g, '$1');
    const plain = raw.replace(/[^a-z0-9]/g, '');
    return [...new Set([withX, withoutX, plain].filter(Boolean))];
  };

  function urlForFileName(fileName) {
    return IMAGE_ROOT + String(fileName)
      .split(/[\\/]+/)
      .filter(Boolean)
      .map(part => encodeURIComponent(part))
      .join('/');
  }

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(`data/product-image-map.json?v=${Date.now()}`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : {})
        .catch(error => {
          console.warn('Product image map could not load:', error);
          return {};
        });
    }
    return manifestPromise;
  }

  function manifestImage(product, manifest) {
    if (!manifest || typeof manifest !== 'object') return '';
    const id = String(product?.id ?? product?._id ?? '');
    const code = normalizeKey(product?.code);
    const description = normalizeKey(product?.description ?? product?.title);
    const direct = (manifest.byId && manifest.byId[id]) ||
      (manifest.byCode && manifest.byCode[code]) ||
      (manifest.byDescription && manifest.byDescription[description]);
    if (direct) return direct;
    for (const alias of codeAliases(product?.code)) {
      const image = manifest.byCodeCompact && manifest.byCodeCompact[alias];
      if (image) return image;
    }
    return '';
  }

  async function apply(products) {
    const rows = Array.isArray(products) ? products : [];
    const manifest = await loadManifest();
    return rows.map(product => {
      if (!product || typeof product !== 'object') return product;
      const image = product.image || manifestImage(product, manifest);
      return image
        ? { ...product, image, _imageMapChecked: true }
        : { ...product, _imageMapChecked: true };
    });
  }

  function fallbackCandidates(product) {
    if (product?._imageMapChecked) return [];
    const code = String(product?.code ?? '').trim();
    if (!code) return [];
    const result = [];
    for (const extension of EXTENSIONS) result.push(urlForFileName(`${code}.${extension}`));
    return result;
  }

  function candidates(product) {
    const result = [];
    const add = value => {
      const candidate = String(value ?? '').trim();
      if (candidate && !result.includes(candidate)) result.push(candidate);
    };
    add(product?.image);
    fallbackCandidates(product).forEach(add);
    return result;
  }

  function classFor(type) {
    if (type === 'shop') return 'product-real-image';
    if (type === 'home') return 'home-product-real-image';
    if (type === 'detail') return 'detail-product-image';
    return '';
  }

  function fallbackMarkup(type) {
    const typeClass = classFor(type);
    const classes = [typeClass, 'raj-product-fallback-logo'].filter(Boolean).join(' ');
    return `<img${classes ? ` class="${classes}"` : ''} src="${FALLBACK_LOGO}" alt="Raj Group" data-raj-fallback-logo="true" loading="lazy" decoding="async">`;
  }

  function markup(product, type = 'shop', options = {}) {
    const paths = candidates(product);
    if (!paths.length) return fallbackMarkup(type);
    const src = paths.shift();
    const encoded = encodeURIComponent(JSON.stringify(paths));
    const cssClass = options.className ?? classFor(type);
    const alt = options.alt ?? product?.description ?? product?.title ?? product?.code ?? 'Product image';
    return `<img${cssClass ? ` class="${escapeHtml(cssClass)}"` : ''} src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" data-raj-product-image="true" data-product-image-candidates="${escapeHtml(encoded)}" data-product-image-fallback="${escapeHtml(type)}" loading="lazy" decoding="async">`;
  }

  function syncImageContainer(image) {
    if (!(image instanceof HTMLImageElement)) return;
    const parent = image.parentElement;
    if (!parent) return;
    parent.classList.add('raj-image-container');
    const isFallback = image.hasAttribute('data-raj-fallback-logo');
    const isReal = image.hasAttribute('data-raj-product-image') && !isFallback;
    parent.classList.toggle('has-real-product-image', isReal);
    parent.classList.toggle('has-fallback-logo', isFallback);
    if (parent.classList.contains('product-gallery-main')) {
      parent.classList.toggle('has-product-image', isReal || isFallback);
    }
  }

  function enhance(root = document) {
    if (!root?.querySelectorAll) return;
    if (root instanceof HTMLImageElement) syncImageContainer(root);
    root.querySelectorAll('img[data-raj-product-image], img[data-raj-fallback-logo]').forEach(syncImageContainer);
  }

  function setElementImage(container, product, type = 'quick', options = {}) {
    if (!container) return;
    container.classList.remove('has-real-product-image', 'has-fallback-logo');
    container.innerHTML = markup(product, type, options);
    enhance(container);
  }

  document.addEventListener('load', event => {
    if (event.target instanceof HTMLImageElement) syncImageContainer(event.target);
  }, true);

  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-product-image-candidates')) return;
    let remaining = [];
    try {
      remaining = JSON.parse(decodeURIComponent(image.dataset.productImageCandidates || ''));
    } catch (_) {}
    const next = remaining.shift();
    if (next) {
      image.dataset.productImageCandidates = encodeURIComponent(JSON.stringify(remaining));
      image.src = next;
      return;
    }
    const type = image.dataset.productImageFallback || '';
    const parent = image.parentElement;
    image.outerHTML = fallbackMarkup(type);
    enhance(parent);
  }, true);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLImageElement) syncImageContainer(node);
        else if (node instanceof Element) enhance(node);
      });
    }
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => enhance(document), { once: true });

  window.RAJProductImages = {
    apply,
    candidates,
    enhance,
    fallbackMarkup,
    loadManifest,
    markup,
    normalizeKey,
    setElementImage
  };
})();
