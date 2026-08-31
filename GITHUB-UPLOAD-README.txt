RAJ AUTO HUB - GITHUB PAGES READY
=================================

IMPORTANT: Is ZIP ke andar index.html ROOT level par hai.
Repository me koi extra outer folder mat banana.

GitHub par upload ke baad root aisa dikhna chahiye:
  index.html
  shop.html
  product.html
  styles.css
  home.css
  assets/
  data/
  ...

Recommended deployment:
1. ZIP ko computer par extract karo.
2. Extracted folder ke ANDAR ke sab files/folders repository root me upload/push karo.
3. GitHub repo -> Settings -> Pages.
4. Source: Deploy from a branch.
5. Branch: main, Folder: / (root), Save.
6. Published URL ko 1-5 minutes baad open/refresh karo.

If your repo is named rajautohub.com under user pxpixaro, expected Pages path is:
  https://pxpixaro.github.io/rajautohub.com/

Notes:
- Ye package static GitHub Pages version hai.
- Catalogue/search/cart/wishlist and static pages work from files in this package.
- Node.js/SQLite admin panel, real login, database orders/enquiries GitHub Pages par run nahi hote.
- My Account static demo modal kholta hai instead of server-only /login redirect.
- Company booklet PDF ko GitHub-friendly size me optimize kiya gaya hai, filename/link same rakha gaya hai.
