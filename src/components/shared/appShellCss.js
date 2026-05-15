export const APP_SHELL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#f4f8fd;--sur:#ffffff;--card:#ffffff;--card2:#f7fbff;
  --bdr:#dbe6f3;--bdr2:#cfdceb;--cy:#1a1a2e;--cy2:#2b2b48;
  --cg:#1a1a2e12;--cm:#1a1a2e32;--wh:#152033;
  --gr:#7b8aa3;--gr2:#66748d;--gr3:#42526b;
  --red:#ff5566;--grn:#00e08a;--yel:#ffcc44;--org:#ff8844;--pur:#a855f7;
  --fl:'Syne',sans-serif;--fh:'Inter',sans-serif;--fb:'Inter',sans-serif;--fm:'JetBrains Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--wh);font-family:var(--fb);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:var(--cy)!important;box-shadow:0 0 0 3px var(--cg)!important}
tbody tr{cursor:pointer;transition:.1s}tbody tr:hover td{background:#f7fbff!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
body.light .sidebar-inner{background:var(--sidebar-bg)!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important}
body.light aside *{border-color:#ffffff14!important}
body.light aside .nav-label{color:#e2e8f0!important}
body.light .card-wrap,.card{border-radius:12px}
body.light .card-wrap{box-shadow:0 1px 4px rgba(0,0,0,.07),0 2px 12px rgba(0,0,0,.04)!important;border:none!important}
body.light main{background:#f4f8fd}
body.light .stat-card{box-shadow:0 2px 8px rgba(0,0,0,.07);border:none}
body.light input,body.light select,body.light textarea{background:#ffffff;border-color:#cbd5e1;color:#0f172a}
body.light input:focus,body.light select:focus,body.light textarea:focus{border-color:#1a1a2e;box-shadow:0 0 0 3px rgba(26,26,46,.12)}
body.light button[class*="btn"]{transition:all .15s}
.va{animation:fadeUp .2s ease;width:100%;min-width:0}
.va>div{width:100%;min-width:0}
body.light{--bg:#f4f8fd;--sur:#ffffff;--card:#ffffff;--card2:#f7fbff;--bdr:#dbe6f3;--bdr2:#cfdceb;--wh:#152033;--gr:#7b8aa3;--gr2:#66748d;--gr3:#42526b;--sidebar:#10204f;--sidebar-text:#cbd5e1;--sidebar-active:#ffffff;--sidebar-active-bg:#1a1a2e}
body.light .sidebar-wrap{background:var(--sidebar-bg)!important}
body.light .sidebar-wrap *{border-color:#ffffff15!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important;box-shadow:2px 0 24px rgba(15,23,42,.24)}
body.light aside .nav-group-label{color:#94a3b8!important}
body.light aside,body.light aside button,body.light aside div,body.light aside span,body.light aside small{color:#e5edf7!important}
body.light aside [style*="color:var(--gr2)"]{color:#a9b8cb!important}
body.light aside [style*="color:var(--gr3)"]{color:#e5edf7!important}
body.light aside [style*="color:var(--wh)"]{color:#ffffff!important}
body.light aside .active-nav{background:#ffffff18!important;color:#ffffff!important}
body.light .topbar{background:#ffffff;border-bottom:1px solid #dbe6f3;box-shadow:0 1px 3px rgba(15,23,42,.05)}
@media(max-width:1024px){
  html{font-size:13px}
  [style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="repeat(6,1fr)"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  [style*="repeat(3,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="1fr 1fr 1fr"]{grid-template-columns:1fr 1fr!important}
  [style*="1fr 1fr"]{grid-template-columns:1fr!important}
}
@media(max-width:768px){
  aside{transform:translateX(-100%);transition:transform .25s ease!important;width:260px!important;z-index:300!important}
  aside.mob-open{transform:translateX(0)!important}
  main,.app-main{margin-left:0!important;width:100%!important;max-width:100%!important}
  .topbar{padding:0 14px!important;height:auto!important;min-height:60px;flex-wrap:wrap}
  .app-page{padding:14px!important}
  .app-breadcrumbs{min-width:0!important}
  .app-actions{width:100%;justify-content:flex-start;flex-wrap:wrap}
  .app-actions > *{max-width:100%}
  [style*="repeat(4,1fr)"],[style*="repeat(6,1fr)"],[style*="repeat(3,1fr)"],[style*="1fr 1fr 1fr"],[style*="1fr 1fr"]{grid-template-columns:1fr!important}
  [style*="width:260px"]{width:100%!important;max-width:100%!important}
  [style*="min-width:190"]{min-width:0!important}
  [style*="min-width:220"]{min-width:0!important}
  [style*="min-width:260"]{min-width:0!important}
  [style*="min-width:280"]{min-width:0!important}
  [style*="min-width:300"]{min-width:0!important}
  [style*="justify-content:space-between"][style*="width:260px"]{width:100%!important}
  .login-shell,.company-shell{padding:16px!important}
  .login-card,.company-card{width:100%!important;max-width:100%!important;padding:24px 18px!important}
  .search-wrap{max-width:none!important;width:100%!important}
  .toast-box{left:12px!important;right:12px!important;bottom:12px!important;max-width:none!important}
  .pager{flex-direction:column;align-items:flex-start!important;gap:12px}
  .ham-btn{display:flex!important}
  .modal-wrap{align-items:flex-end!important;padding:0!important}
  .modal-box{border-radius:16px 16px 0 0!important;width:100%!important;max-width:100%!important;max-height:92vh!important}
  table{min-width:640px}
  input,select,textarea{font-size:16px!important}
}
@media(max-width:1024px){
  .login-card{grid-template-columns:1fr!important;gap:14px!important}
  .login-form{order:-1;padding:30px 24px!important}
  .login-promo{min-height:auto!important;padding:26px!important}
  .login-promo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .login-promo-footer{grid-template-columns:1fr!important}
  .login-title{font-size:34px!important;max-width:none!important}
}
@media(max-width:640px){
  .login-shell{padding:12px!important;align-items:flex-start!important}
  .login-card{gap:12px!important}
  .login-form,.login-promo{border-radius:18px!important;box-shadow:0 12px 36px rgba(15,23,42,.14)!important}
  .login-form{padding:22px 16px!important}
  .login-promo{padding:20px 16px!important}
  .login-promo-grid{grid-template-columns:1fr!important}
  .login-title{font-size:28px!important;line-height:1.05!important}
  .login-subcopy{font-size:13px!important}
  .login-promo-copy{font-size:13px!important}
}
@media(min-width:769px){
  .mob-overlay{display:none!important}
  .ham-btn{display:none!important}
}
`;
