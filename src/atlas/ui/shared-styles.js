/**
 * Shared CSS across all Atlas views.
 * Dark theme, Linear-inspired, minimal.
 */
export function sharedStyles() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
     background:#0a0b0f;color:#e1e4ed;overflow:hidden;height:100vh;
     -webkit-font-smoothing:antialiased}
::selection{background:rgba(108,140,255,.3)}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#2a2e3a;border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#3a3f4f}

/* ── Header ── */
.header{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;
        background:#0f1117;border-bottom:1px solid #1c1f2a;height:44px;flex-shrink:0}
.header h1{font-size:0.9rem;font-weight:600;white-space:nowrap;
           background:linear-gradient(135deg,#6c8cff,#4ade80);-webkit-background-clip:text;
           -webkit-text-fill-color:transparent}
.header-nav{display:flex;gap:0.25rem;margin-left:0.75rem}
.nav-btn{background:none;border:1px solid transparent;border-radius:5px;color:#5a5f7a;
         cursor:pointer;font-size:0.7rem;padding:0.25rem 0.55rem;white-space:nowrap;
         transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:0.25rem}
.nav-btn:hover{color:#e1e4ed;background:#1a1d27;border-color:#2a2e3a}
.nav-btn.active{color:#6c8cff;border-color:#6c8cff;background:rgba(108,140,255,.08)}
.header-right{margin-left:auto;display:flex;align-items:center;gap:0.5rem}
.search-wrap{position:relative;width:220px}
.search-wrap input{width:100%;padding:0.3rem 0.5rem 0.3rem 1.6rem;background:#0a0b0f;
                   border:1px solid #1c1f2a;border-radius:5px;color:#e1e4ed;font-size:0.7rem;
                   outline:none;transition:border-color .15s}
.search-wrap input:focus{border-color:#6c8cff}
.search-wrap input::placeholder{color:#3a3f4f}
.search-icon{position:absolute;left:0.45rem;top:50%;transform:translateY(-50%);
             color:#3a3f4f;font-size:0.65rem;pointer-events:none}
.stats{display:flex;gap:0.4rem;font-size:0.6rem;color:#5a5f7a}
.stats span{background:#0a0b0f;padding:0.12rem 0.4rem;border-radius:4px;white-space:nowrap}
.stats .num{color:#6c8cff;font-weight:600}

/* ── Main layout ── */
.main{display:flex;height:calc(100vh - 44px);width:100%}
#viz{flex:1;background:#0a0b0f;cursor:grab;min-width:0;position:relative}
#viz:active{cursor:grabbing}

/* ── Sidebar / Inspector ── */
.sidebar{width:0;overflow:hidden;background:#0f1117;border-left:1px solid #1c1f2a;
         transition:width .2s ease;display:flex;flex-direction:column;flex-shrink:0}
.sidebar.open{width:340px}
.sidebar-header{padding:0.6rem 0.75rem;border-bottom:1px solid #1c1f2a;
                font-size:0.7rem;font-weight:600;color:#5a5f7a;
                display:flex;align-items:center;gap:0.5rem;flex-shrink:0}
.sidebar-body{flex:1;overflow-y:auto;padding:0.75rem;font-size:0.72rem}
.sidebar-body .prop-group{margin-bottom:0.75rem}
.sidebar-body .prop-label{color:#5a5f7a;font-size:0.6rem;text-transform:uppercase;
                          letter-spacing:.04em;margin-bottom:0.15rem}
.sidebar-body .prop-value{color:#e1e4ed;font-size:0.72rem;word-break:break-all}
.sidebar-body .prop-value.code{font-family:'SF Mono','Cascadia Code',monospace;font-size:0.65rem;color:#6c8cff}
.sidebar-body .divider{height:1px;background:#1c1f2a;margin:0.5rem 0}
.sidebar-close{background:none;border:none;color:#5a5f7a;cursor:pointer;font-size:0.7rem;margin-left:auto;padding:0.15rem}
.sidebar-close:hover{color:#e1e4ed}

/* ── D3 graph ── */
.node-label{font-size:9px;font-family:'SF Mono','Cascadia Code',monospace;pointer-events:none;fill:#5a5f7a;transition:opacity .2s}
.node-label.visible{fill:#e1e4ed;font-weight:500}
.node{transition:opacity .15s}
.node.dimmed{opacity:0.06}
.node.highlighted{opacity:1}
.node circle{stroke:#0a0b0f;stroke-width:1.5px;cursor:pointer;transition:r .1s,opacity .15s}
.node circle:hover{filter:brightness(1.3);stroke:#6c8cff}
.link{fill:none;stroke-opacity:0.15;transition:stroke-opacity .15s}
.link.highlighted{stroke-opacity:0.7!important}
.link.dimmed{stroke-opacity:0.02!important}

/* ── Tooltip ── */
.tooltip{position:absolute;background:#151822;border:1px solid #2a2e3a;border-radius:8px;
         padding:0.6rem 0.8rem;font-size:0.7rem;pointer-events:none;opacity:0;
         transition:opacity .12s;max-width:350px;box-shadow:0 4px 24px rgba(0,0,0,.6);z-index:100}
.tooltip.visible{opacity:1}
.tooltip .tt-title{font-weight:600;color:#e1e4ed;margin-bottom:0.2rem;font-size:0.8rem}
.tooltip .tt-file{color:#6c8cff;font-size:0.65rem;font-family:monospace}
.tooltip .tt-type{display:inline-block;background:rgba(108,140,255,.12);color:#6c8cff;
                  font-size:0.55rem;padding:0.08rem 0.35rem;border-radius:3px;text-transform:uppercase;
                  letter-spacing:.04em;margin-top:0.15rem}
.tooltip .tt-detail{color:#5a5f7a;font-size:0.65rem;margin-top:0.2rem}
.tooltip .tt-stats{display:flex;gap:0.5rem;margin-top:0.3rem;font-size:0.6rem}
.tooltip .tt-stat{color:#8b90a5}
.tooltip .tt-stat-num{color:#e1e4ed;font-weight:500}

/* ── Legend ── */
.legend{position:absolute;bottom:0.6rem;left:0.6rem;background:rgba(15,17,23,.92);
        border:1px solid #1c1f2a;border-radius:8px;padding:0.35rem 0.6rem;
        font-size:0.6rem;display:flex;gap:0.6rem;flex-wrap:wrap;backdrop-filter:blur(4px);z-index:10}
.legend-item{display:flex;align-items:center;gap:0.2rem;color:#5a5f7a}
.legend-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ── Minimap ── */
.minimap{position:absolute;bottom:0.6rem;right:0.6rem;width:160px;height:120px;
         background:rgba(15,17,23,.9);border:1px solid #1c1f2a;border-radius:6px;
         overflow:hidden;z-index:10;backdrop-filter:blur(4px)}
.minimap svg{width:100%;height:100%}
.minimap-viewport{fill:none;stroke:#6c8cff;stroke-width:1;stroke-opacity:0.6}

/* ── Breadcrumb ── */
.breadcrumb{display:flex;align-items:center;gap:0.25rem;font-size:0.65rem;
            color:#5a5f7a;padding:0.3rem 0.75rem;background:#0f1117;border-bottom:1px solid #1c1f2a;
            overflow-x:auto;flex-shrink:0;min-height:26px}
.breadcrumb a{color:#5a5f7a;text-decoration:none;cursor:pointer;transition:color .1s}
.breadcrumb a:hover{color:#6c8cff}
.breadcrumb .sep{color:#2a2e3a;margin:0 0.15rem}
.breadcrumb .current{color:#e1e4ed;font-weight:500}

/* ── Empty state ── */
.empty-state{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
             color:#3a3f4f;text-align:center;display:none;pointer-events:none}
.empty-state.visible{display:block}
.empty-state span{font-size:2rem;display:block;margin-bottom:0.5rem}
.empty-state p{font-size:0.75rem}

/* ── Search results ── */
.search-results{position:absolute;top:40px;left:0;width:100%;background:#151822;
                border:1px solid #2a2e3a;border-radius:6px;max-height:300px;overflow-y:auto;
                display:none;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,.4)}
.search-results.visible{display:block}
.search-result{padding:0.35rem 0.6rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;
               font-size:0.7rem;transition:background .1s}
.search-result:hover{background:rgba(108,140,255,.1)}
.search-result .sr-label{color:#e1e4ed;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.search-result .sr-file{color:#5a5f7a;font-size:0.6rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
.search-result .sr-type{font-size:0.55rem;color:#5a5f7a;background:#0a0b0f;padding:0.1rem 0.3rem;border-radius:3px}
.search-result .sr-badge{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ── Loading spinner ── */
.loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
.loading .spinner{width:24px;height:24px;border:2px solid #1c1f2a;border-top-color:#6c8cff;
                  border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 0.5rem}
@keyframes spin{to{transform:rotate(360deg)}}
.loading p{color:#5a5f7a;font-size:0.7rem}

/* ── Button ── */
.btn{background:#1c1f2a;border:1px solid transparent;border-radius:5px;color:#8b90a5;
     cursor:pointer;font-size:0.7rem;padding:0.3rem 0.6rem;transition:all .15s;
     white-space:nowrap;display:inline-flex;align-items:center;gap:0.25rem}
.btn:hover{background:#2a2e3a;color:#e1e4ed}
.btn-primary{background:rgba(108,140,255,.15);border-color:#6c8cff;color:#6c8cff}
.btn-primary:hover{background:rgba(108,140,255,.25)}
`;
}
