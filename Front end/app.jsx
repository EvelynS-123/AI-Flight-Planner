const { useState } = React;

/* =============================================================
   SVG FILTER DEFS — 全局蜡笔/水粉纹理滤镜
   feTurbulence 产生纸张颗粒，feDisplacementMap 扰动笔触边缘
   ============================================================= */
function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{position:"absolute"}}>
      <defs>
        {/* 蜡笔纸张颗粒纹理 */}
        <filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended"/>
          <feComposite in="blended" in2="SourceGraphic" operator="in"/>
        </filter>
        {/* 水粉笔触扭曲 — 用于山峦、树木边缘 */}
        <filter id="gouache" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="turbulence" baseFrequency="0.035 0.06" numOctaves="3" seed="2" result="warp"/>
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        {/* 轻微扭曲 — 用于云朵软边 */}
        <filter id="softedge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="8" result="warp"/>
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  );
}

/* =============================================================
   手绘水粉云朵 — 不规则轮廓 + softedge 滤镜
   ============================================================= */
function SketchCloud({ width = 220, opacity = 1, style = {} }) {
  return (
    <svg width={width} height={width * 0.48} viewBox="0 0 220 105"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ ...style, opacity }} filter="url(#softedge)">
      {/* 主云体 — 多层叠加模拟水粉厚涂 */}
      <ellipse cx="110" cy="72" rx="100" ry="30" fill="white" fillOpacity="0.72"/>
      <ellipse cx="72"  cy="58" rx="52"  ry="38" fill="white" fillOpacity="0.78"/>
      <ellipse cx="148" cy="54" rx="44"  ry="34" fill="white" fillOpacity="0.72"/>
      <ellipse cx="110" cy="46" rx="38"  ry="32" fill="white" fillOpacity="0.82"/>
      <ellipse cx="84"  cy="36" rx="28"  ry="24" fill="white" fillOpacity="0.75"/>
      <ellipse cx="134" cy="33" rx="24"  ry="20" fill="white" fillOpacity="0.68"/>
      {/* 蜡笔高光笔触 */}
      <path d="M75 52 C85 48 100 50 110 52" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
      <path d="M88 38 C96 35 108 36 116 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.45"/>
      {/* 云朵阴影底部 */}
      <ellipse cx="110" cy="80" rx="88" ry="12" fill="#C8DFF0" fillOpacity="0.22"/>
    </svg>
  );
}

/* =============================================================
   大飞机 SVG — 天空中的主角，水粉填色风格
   ============================================================= */
function BigPlane({ style = {} }) {
  return (
    <svg width="880" height="320" viewBox="0 0 220 80"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={style} filter="url(#gouache)">
      {/* 机身 */}
      <path d="M20 42 C28 38 60 34 110 33 C155 32 185 35 200 40 C208 43 205 50 195 52 C165 56 120 56 70 54 C45 53 22 50 20 42Z"
        fill="white" fillOpacity="0.88"/>
      {/* 机身蜡笔阴影 */}
      <path d="M40 50 C80 52 140 52 185 49" stroke="#D0E8F4" strokeWidth="3" strokeLinecap="round" opacity="0.55"/>
      <path d="M50 46 C90 47 150 47 190 44" stroke="#D0E8F4" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      {/* 机头 */}
      <path d="M195 40 C208 40 216 44 214 47 C212 50 202 52 195 52Z"
        fill="white" fillOpacity="0.9"/>
      {/* 主翼 — 下方大翼 */}
      <path d="M100 50 C110 50 125 52 140 68 C148 76 145 80 138 78 C120 72 104 60 100 56Z"
        fill="white" fillOpacity="0.80"/>
      <path d="M108 55 C120 60 132 68 138 74" stroke="#C8DFF0" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      {/* 尾翼 */}
      <path d="M26 42 C22 36 18 26 22 24 C26 22 34 30 38 38Z"
        fill="white" fillOpacity="0.78"/>
      <path d="M28 38 C26 32 24 26 26 25" stroke="#C8DFF0" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      {/* 水平尾翼 */}
      <path d="M26 48 C20 52 14 56 12 54 C10 52 18 46 26 46Z"
        fill="white" fillOpacity="0.72"/>
      {/* 发动机 */}
      <ellipse cx="120" cy="57" rx="10" ry="5" fill="#D8EDF8" fillOpacity="0.8"/>
      <ellipse cx="145" cy="63" rx="8"  ry="4" fill="#D8EDF8" fillOpacity="0.75"/>
      {/* 窗户 */}
      {[145,158,171,184].map((x,i) => (
        <ellipse key={i} cx={x} cy="43" rx="4" ry="3"
          fill="#B8D8F0" fillOpacity="0.5"/>
      ))}
      {/* 飞机尾迹 */}
      <path d="M18 44 C8 43 -10 44 -30 46" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M18 47 C5 47 -15 48 -35 50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.28"/>
    </svg>
  );
}

/* =============================================================
   完整风景插画 — 占据页面底部全宽
   包含：远山 / 近山 / 湖面 / 树林 / 草地 / 蜡笔笔触纹理
   ============================================================= */
function SceneryIllustration() {
  return (
    <svg width="100%" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice"
      fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── 远景雪山（最浅，最高） ── */}
      <g filter="url(#gouache)">
        <path d="M0 360 L0 200
          C60 195 100 155 140 130 C160 118 175 135 200 128
          C230 120 255 88 290 72 C310 63 325 82 350 85
          C375 88 395 64 425 55 C448 47 462 68 490 72
          C515 76 535 52 562 44 C585 37 602 60 628 65
          C655 70 675 46 705 39 C728 33 745 55 772 60
          C798 65 820 40 850 33 C875 27 895 52 922 58
          C950 64 972 38 1002 32 C1028 27 1050 52 1080 56
          C1108 60 1135 36 1200 28 L1200 360Z"
          fill="#CCDFE8" fillOpacity="0.5"/>
        {/* 雪顶白色 */}
        <path d="M290 72 C300 65 310 70 318 66 C310 75 298 80 290 80Z" fill="white" fillOpacity="0.6"/>
        <path d="M425 55 C435 48 444 53 452 49 C444 58 433 63 425 63Z" fill="white" fillOpacity="0.55"/>
        <path d="M850 33 C862 26 872 31 880 27 C872 36 860 41 850 41Z" fill="white" fillOpacity="0.5"/>
        {/* 蜡笔高光笔触 */}
        <path d="M140 130 C150 125 162 128 170 124" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <path d="M562 44 C572 40 582 43 590 39" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      </g>

      {/* ── 中景青绿山丘（有植被感的蓝绿色） ── */}
      <g filter="url(#gouache)">
        <path d="M0 360 L0 250
          C40 245 75 220 108 204 C128 195 145 210 168 202
          C195 193 220 168 252 158 C272 151 288 168 312 164
          C338 160 358 138 388 130 C410 124 425 144 452 148
          C478 152 498 130 525 124 C548 119 565 140 592 144
          C618 148 640 125 668 119 C692 114 710 136 738 140
          C762 144 785 120 812 114 C836 109 855 132 882 136
          C908 140 932 116 960 110 C985 105 1005 128 1035 132
          C1062 136 1088 112 1120 106 C1148 101 1175 124 1200 128 L1200 360Z"
          fill="#A8C8A0" fillOpacity="0.55"/>
        {/* 植被笔触 — 参差树影感 */}
        <path d="M108 204 C116 200 126 203 134 199" stroke="#88A888" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <path d="M252 158 C262 153 274 157 282 152" stroke="#88A888" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <path d="M525 124 C536 119 548 123 557 118" stroke="#88A888" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <path d="M812 114 C823 109 835 113 844 108" stroke="#88A888" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      </g>

      {/* ── 湖面 / 水体（中央，反光效果） ── */}
      <g filter="url(#softedge)">
        {/* 湖体 */}
        <ellipse cx="600" cy="290" rx="340" ry="52" fill="#B8D8EC" fillOpacity="0.62"/>
        <ellipse cx="600" cy="288" rx="320" ry="44" fill="#C8E4F4" fillOpacity="0.5"/>
        {/* 水面反光笔触 */}
        <path d="M310 285 C360 281 420 283 480 285" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.55"/>
        <path d="M400 292 C460 289 530 290 600 292" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <path d="M650 288 C710 285 770 286 820 288" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <path d="M700 295 C740 293 780 294 820 295" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/>
        {/* 山倒影 */}
        <path d="M420 295 C450 302 480 306 510 304 C530 302 545 297 560 299 C575 301 590 308 610 306 C630 304 650 297 670 299 C690 302 710 308 730 305 C755 302 775 295 800 295"
          stroke="#88B8D0" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
      </g>

      {/* ── 近景树林（左侧） ── */}
      <g filter="url(#gouache)">
        {/* 树干 */}
        <rect x="45"  y="230" width="8"  height="80" rx="3" fill="#8BA888" fillOpacity="0.7"/>
        <rect x="80"  y="218" width="10" height="92" rx="3" fill="#7A9878" fillOpacity="0.75"/>
        <rect x="118" y="225" width="8"  height="85" rx="3" fill="#8BA888" fillOpacity="0.68"/>
        <rect x="155" y="235" width="7"  height="75" rx="3" fill="#7A9878" fillOpacity="0.65"/>
        {/* 针叶树冠 — 三角叠加模拟松树 */}
        <path d="M30 238 C45 200 60 238Z" fill="#6A9868" fillOpacity="0.72"/>
        <path d="M36 252 C45 212 54 252Z" fill="#7AAA78" fillOpacity="0.65"/>
        <path d="M64 224 C80 182 96 224Z" fill="#6A9868" fillOpacity="0.75"/>
        <path d="M70 240 C80 198 90 240Z" fill="#7AAA78" fillOpacity="0.62"/>
        <path d="M102 232 C118 190 134 232Z" fill="#6A9868" fillOpacity="0.70"/>
        <path d="M108 248 C118 206 128 248Z" fill="#7AAA78" fillOpacity="0.60"/>
        <path d="M140 240 C155 202 170 240Z" fill="#6A9868" fillOpacity="0.68"/>
        {/* 蜡笔笔触感 */}
        <path d="M40 220 C50 215 62 218 70 214" stroke="#5A8858" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
        <path d="M105 200 C115 196 128 199 136 195" stroke="#5A8858" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
      </g>

      {/* ── 近景树林（右侧） ── */}
      <g filter="url(#gouache)">
        <rect x="1040" y="228" width="8"  height="82" rx="3" fill="#8BA888" fillOpacity="0.7"/>
        <rect x="1075" y="215" width="10" height="95" rx="3" fill="#7A9878" fillOpacity="0.72"/>
        <rect x="1112" y="222" width="8"  height="88" rx="3" fill="#8BA888" fillOpacity="0.68"/>
        <rect x="1148" y="232" width="7"  height="78" rx="3" fill="#7A9878" fillOpacity="0.65"/>
        <path d="M1025 235 C1040 196 1055 235Z" fill="#6A9868" fillOpacity="0.72"/>
        <path d="M1031 250 C1040 210 1049 250Z" fill="#7AAA78" fillOpacity="0.62"/>
        <path d="M1060 222 C1075 180 1090 222Z" fill="#6A9868" fillOpacity="0.74"/>
        <path d="M1066 238 C1075 196 1084 238Z" fill="#7AAA78" fillOpacity="0.60"/>
        <path d="M1097 230 C1112 188 1127 230Z" fill="#6A9868" fillOpacity="0.70"/>
        <path d="M1103 246 C1112 204 1121 246Z" fill="#7AAA78" fillOpacity="0.58"/>
        <path d="M1133 238 C1148 200 1163 238Z" fill="#6A9868" fillOpacity="0.67"/>
      </g>

      {/* ── 近景草地（最前，最深绿） ── */}
      <g filter="url(#gouache)">
        <path d="M0 360 L0 318
          C50 312 120 308 200 310 C300 312 380 308 460 312
          C520 315 560 310 600 312 C640 314 700 310 780 312
          C860 314 940 308 1040 312 C1120 315 1168 310 1200 312 L1200 360Z"
          fill="#90B880" fillOpacity="0.65"/>
        {/* 草地前沿水粉笔触（参差感） */}
        <path d="M0 316 C30 312 70 316 110 313" stroke="#78A068" strokeWidth="3" strokeLinecap="round" opacity="0.45"/>
        <path d="M200 311 C250 307 310 311 360 308" stroke="#78A068" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
        <path d="M480 313 C530 309 580 312 630 310" stroke="#78A068" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
        <path d="M750 311 C800 307 860 311 920 308" stroke="#78A068" strokeWidth="2.5" strokeLinecap="round" opacity="0.38"/>
        <path d="M1050 312 C1100 308 1150 311 1200 309" stroke="#78A068" strokeWidth="2.5" strokeLinecap="round" opacity="0.38"/>
        {/* 草叶点缀 */}
        <path d="M160 313 C162 305 165 313" stroke="#68984C" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <path d="M400 310 C402 302 405 310" stroke="#68984C" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
        <path d="M680 312 C682 303 685 312" stroke="#68984C" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
        <path d="M950 310 C952 302 955 310" stroke="#68984C" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
      </g>

    </svg>
  );
}

/* =============================================================
   导航小飞机图标
   ============================================================= */
function SketchPlane({ size = 28, color = "#7AAEC8", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={style}>
      <path d="M24 14 L8 6 L10 13 L4 14 L10 15 L8 22 Z"
        fill={color} fillOpacity="0.85"
        stroke={color} strokeWidth="0.5" strokeLinejoin="round"/>
      <path d="M10 14 L20 14" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.45"/>
    </svg>
  );
}

/* =============================================================
   手绘花朵装饰
   ============================================================= */
function SketchFlower({ size = 48, color = "#B8CEE0", style = {} }) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style}>
      {petals.map((deg, i) => {
        const rad = (deg - 90) * Math.PI / 180;
        const cx = 24 + 12 * Math.cos(rad);
        const cy = 24 + 12 * Math.sin(rad);
        return (
          <ellipse key={i} cx={cx} cy={cy} rx="5.5" ry="3.5"
            transform={`rotate(${deg}, ${cx}, ${cy})`}
            fill={color} fillOpacity="0.62"/>
        );
      })}
      <circle cx="24" cy="24" r="5" fill={color} fillOpacity="0.88"/>
      <circle cx="24" cy="24" r="2.5" fill="white" fillOpacity="0.55"/>
    </svg>
  );
}

/* =============================================================
   目的地卡片数据
   ============================================================= */
const DESTINATIONS = [
  { city:"Tokyo",     tagline:"Wander through lantern-lit alleys", bg:"#D4E8F4", accent:"#3A7A9C", rotate:"-2deg",  emoji:"🗼" },
  { city:"Dubai",     tagline:"Where the desert kisses the clouds", bg:"#F4EAD4", accent:"#B07030", rotate:"1.5deg", emoji:"🌅" },
  { city:"Amsterdam", tagline:"Tulips, canals & slow mornings",     bg:"#D8EED8", accent:"#4A8C50", rotate:"-1deg",  emoji:"🌷" },
  { city:"Singapore", tagline:"A layover worth extending",          bg:"#D0EEE8", accent:"#35928C", rotate:"2deg",   emoji:"🌿" },
];

function DestCard({ city, tagline, bg, accent, rotate, emoji }) {
  return (
    <div className="dest-card" style={{ background: bg, transform:`rotate(${rotate})` }}>
      <div className="dest-card__top"/>
      <div className="dest-card__emoji">{emoji}</div>
      <h3 className="dest-card__city" style={{ color: accent }}>{city}</h3>
      <p className="dest-card__tagline">{tagline}</p>
      <div className="dest-card__stamp-edge"/>
    </div>
  );
}


/* =============================================================
   Landing Page
   ============================================================= */
function LandingPage({ onStart }) {
  return (
    <div className="landing">
      <GlobalDefs/>

      {/* ── 天空背景层：云朵 + 大飞机 ── */}
      <div className="sky-layer" aria-hidden="true">
        {/* 大飞机 — 天空主角，右侧偏上，4倍尺寸 */}
        <BigPlane style={{
          position:"absolute", top:"2%", right:"-4%",
          transform:"scaleX(-1) rotate(-3deg)",
          opacity: 0.88
        }}/>
        {/* 多层云朵 */}
        <SketchCloud width={300} opacity={0.88} style={{ position:"absolute", top:"3%",  left:"1%"   }}/>
        <SketchCloud width={210} opacity={0.78} style={{ position:"absolute", top:"7%",  right:"28%" }}/>
        <SketchCloud width={170} opacity={0.70} style={{ position:"absolute", top:"16%", left:"20%"  }}/>
        <SketchCloud width={250} opacity={0.62} style={{ position:"absolute", top:"24%", right:"14%" }}/>
        <SketchCloud width={180} opacity={0.52} style={{ position:"absolute", top:"38%", left:"5%"   }}/>
        <SketchCloud width={230} opacity={0.45} style={{ position:"absolute", top:"50%", right:"2%"  }}/>
        <SketchCloud width={155} opacity={0.38} style={{ position:"absolute", top:"62%", left:"38%"  }}/>
        {/* 花朵装饰 */}
        <SketchFlower size={60} color="#B8D0E8" style={{ position:"absolute", top:"5%",  left:"44%", opacity:0.38, transform:"rotate(12deg)"  }}/>
        <SketchFlower size={44} color="#C8DCEC" style={{ position:"absolute", top:"32%", left:"3%",  opacity:0.32, transform:"rotate(-8deg)"  }}/>
        <SketchFlower size={52} color="#A8C4DC" style={{ position:"absolute", top:"58%", right:"8%", opacity:0.28, transform:"rotate(6deg)"   }}/>
      </div>

      {/* ── 风景插画层（页面底部） ── */}
      <div className="scenery-layer" aria-hidden="true">
        <SceneryIllustration/>
      </div>

      {/* ── 导航 pill bar ── */}
      <nav className="nav-pill">
        <div className="nav-pill__logo">
          <SketchPlane size={22} color="#5A9CC0"/>
        </div>
        <div className="nav-pill__links">
          <a href="#features">Features</a>
          <a href="#destinations">Destinations</a>
          <a href="#about">About</a>
        </div>
        <button className="btn-sketch" onClick={onStart}>Start Planning</button>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__text">
            <h1 className="hero__title">AI Flight Planner</h1>
            <p className="hero__sub">
              Turn your layover into a&nbsp;<em>personalized</em>&nbsp;travel experience.
            </p>
            <p className="hero__desc">
              Find connecting flights optimized for your budget, travel style,
              and stopover city — chosen by AI, tailored for you.
            </p>
            <button className="btn-sketch btn-sketch--large" onClick={onStart}>
              <SketchPlane size={20} color="white" style={{ marginRight:"6px" }}/>
              Start Planning
            </button>
            <p className="hero__caption">✈ &nbsp;Trusted by explorers in 40+ countries</p>
          </div>

        </div>
      </section>

      {/* ── Feature chips ── */}
      <section id="features" className="section-features">
        <div className="features-row">
          {[
            { icon:"💰", label:"Price-Aware",   desc:"Never overpay for a layover connection" },
            { icon:"🗺️",  label:"City Explorer", desc:"Discover stopovers worth the journey"   },
            { icon:"⚡",  label:"Time-Smart",    desc:"Balance flight time & city exploration" },
          ].map(f => (
            <div className="feature-chip sketch-card" key={f.label}>
              <span className="feature-chip__icon">{f.icon}</span>
              <div>
                <div className="feature-chip__label">{f.label}</div>
                <div className="feature-chip__desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Popular Stopovers ── */}
      <section id="destinations" className="section-destinations">
        <h2 className="section-title">Popular Stopovers</h2>
        <p className="section-sub">These cities are loved by travelers like you</p>
        <div className="dest-grid">
          {DESTINATIONS.map(d => <DestCard key={d.city} {...d}/>)}
        </div>
      </section>

      {/* ── 手写引用语 ── */}
      <section className="section-quote">
        <div className="quote-text">
          <em>
            "Slow down, breathe deeply,<br/>
            and let the journey surprise you."
          </em>
        </div>
        <SketchFlower size={52} color="#C8D8EC" style={{ opacity:0.65, marginLeft:"1.5rem", flexShrink:0 }}/>
      </section>

      {/* ── CTA Banner ── */}
      <section className="section-cta">
        <div className="cta-inner sketch-card">
          <div>
            <h2 className="cta-title">Your personalized journey starts here.</h2>
            <p className="cta-sub">Tell us where you're headed — we'll handle the rest.</p>
          </div>
          <button className="btn-sketch btn-sketch--large" onClick={onStart}>
            <SketchPlane size={20} color="white" style={{ marginRight:"6px" }}/>
            Start Planning
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <SketchPlane size={16} color="#8AAEC8"/>
        <span>AI Flight Transfer Planner &nbsp;·&nbsp; University Engineering Design Project</span>
      </footer>
    </div>
  );
}


/* =============================================================
   Preference Input Page — 完整多段表单
   ============================================================= */

const INTERESTS = [
  { id:"food",       emoji:"🍜", label:"Food"       },
  { id:"culture",    emoji:"🏛️", label:"Culture"    },
  { id:"nature",     emoji:"🌿", label:"Nature"     },
  { id:"shopping",   emoji:"🛍️", label:"Shopping"   },
  { id:"technology", emoji:"💻", label:"Technology" },
  { id:"nightlife",  emoji:"🌙", label:"Nightlife"  },
  { id:"relaxation", emoji:"🧘", label:"Relaxation" },
];

const TRAVEL_STYLES = [
  { id:"cheapest",  icon:"💰", title:"Cheapest",  desc:"Prioritize the lowest ticket price."        },
  { id:"balanced",  icon:"⚖️", title:"Balanced",  desc:"Balance price, convenience, and experience." },
  { id:"adventure", icon:"🌍", title:"Adventure", desc:"Prioritize meaningful stopover experiences." },
];

function PreferencePage({ onBack, onSubmit }) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    ageRange: "",
    gender: "",
    nationality: "",
    interests: [],
    budget: "",
    travelStyle: "balanced",
  });

  const update = (key, val) => setForm(prev => ({...prev, [key]: val}));

  const toggleInterest = (id) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(x => x !== id)
        : [...prev.interests, id]
    }));
  };

  return (
    <div className="pref-page">
      <GlobalDefs/>

      {/* 天空背景 */}
      <div className="sky-layer" aria-hidden="true">
        <SketchCloud width={280} opacity={0.75} style={{ position:"absolute", top:"2%", left:"2%" }}/>
        <SketchCloud width={200} opacity={0.6}  style={{ position:"absolute", top:"6%", right:"5%" }}/>
        <SketchCloud width={160} opacity={0.5}  style={{ position:"absolute", top:"14%", left:"30%" }}/>
        <SketchFlower size={48} color="#B8D0E8" style={{ position:"absolute", top:"4%", right:"20%", opacity:0.35, transform:"rotate(10deg)" }}/>
        <SketchFlower size={38} color="#C8DCEC" style={{ position:"absolute", top:"18%", left:"6%", opacity:0.28, transform:"rotate(-8deg)" }}/>
      </div>

      {/* 导航 */}
      <nav className="nav-pill">
        <div className="nav-pill__logo">
          <SketchPlane size={22} color="#5A9CC0"/>
        </div>
        <div className="nav-pill__links">
          <a href="#" onClick={(e)=>{e.preventDefault();onBack()}}>Home</a>
          <a href="#flight">Flight</a>
          <a href="#profile">Profile</a>
          <a href="#style">Style</a>
        </div>
        <button className="btn-sketch" onClick={onBack}>← Back</button>
      </nav>

      {/* 表单主体 */}
      <div className="pref-container">
        {/* 页面标题 */}
        <div className="pref-header">
          <h1 className="pref-header__title">Let's plan your perfect trip</h1>
          <p className="pref-header__sub">Tell us a bit about yourself and where you'd like to go.</p>
        </div>

        {/* ── Section 1: Flight Info ── */}
        <section id="flight" className="pref-section sketch-card">
          <div className="pref-section__icon">✈️</div>
          <h2 className="pref-section__title">Flight Information</h2>
          <p className="pref-section__desc">Where are you flying from and to?</p>
          <div className="pref-form-grid">
            <div className="form-field">
              <label className="form-label">Origin City</label>
              <input className="form-input" type="text" placeholder="e.g. San Francisco"
                value={form.origin} onChange={e => update("origin", e.target.value)}/>
            </div>
            <div className="form-field">
              <label className="form-label">Destination City</label>
              <input className="form-input" type="text" placeholder="e.g. Seoul"
                value={form.destination} onChange={e => update("destination", e.target.value)}/>
            </div>
          </div>
        </section>

        {/* ── Section 2: Personal Profile ── */}
        <section id="profile" className="pref-section sketch-card">
          <div className="pref-section__icon">👤</div>
          <h2 className="pref-section__title">Personal Profile</h2>
          <p className="pref-section__desc">Help us personalize your recommendations.</p>
          <div className="pref-form-grid pref-form-grid--3">
            <div className="form-field">
              <label className="form-label">Age Range</label>
              <select className="form-input" value={form.ageRange}
                onChange={e => update("ageRange", e.target.value)}>
                <option value="">Select...</option>
                <option value="18-24">18 – 24</option>
                <option value="25-34">25 – 34</option>
                <option value="35-44">35 – 44</option>
                <option value="45-54">45 – 54</option>
                <option value="55+">55+</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.gender}
                onChange={e => update("gender", e.target.value)}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Nationality</label>
              <input className="form-input" type="text" placeholder="e.g. Chinese"
                value={form.nationality} onChange={e => update("nationality", e.target.value)}/>
            </div>
          </div>
        </section>

        {/* ── Section 3: Travel Interests ── */}
        <section className="pref-section sketch-card">
          <div className="pref-section__icon">🎯</div>
          <h2 className="pref-section__title">Travel Interests</h2>
          <p className="pref-section__desc">What do you enjoy most when exploring a new city? (Select multiple)</p>
          <div className="interest-grid">
            {INTERESTS.map(item => (
              <button key={item.id}
                className={`interest-chip ${form.interests.includes(item.id) ? "interest-chip--active" : ""}`}
                onClick={() => toggleInterest(item.id)}>
                <span className="interest-chip__emoji">{item.emoji}</span>
                <span className="interest-chip__label">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Section 4: Budget ── */}
        <section className="pref-section sketch-card">
          <div className="pref-section__icon">💵</div>
          <h2 className="pref-section__title">Budget</h2>
          <p className="pref-section__desc">What's your total travel budget for this trip?</p>
          <div className="pref-form-grid">
            <div className="form-field">
              <label className="form-label">Total Budget (USD)</label>
              <input className="form-input" type="number" placeholder="e.g. 1500"
                value={form.budget} onChange={e => update("budget", e.target.value)}/>
            </div>
          </div>
        </section>

        {/* ── Section 5: Travel Style ── */}
        <section id="style" className="pref-section sketch-card">
          <div className="pref-section__icon">🧳</div>
          <h2 className="pref-section__title">Travel Style</h2>
          <p className="pref-section__desc">How do you like to travel?</p>
          <div className="style-grid">
            {TRAVEL_STYLES.map(s => (
              <button key={s.id}
                className={`style-card ${form.travelStyle === s.id ? "style-card--active" : ""}`}
                onClick={() => update("travelStyle", s.id)}>
                <span className="style-card__icon">{s.icon}</span>
                <span className="style-card__title">{s.title}</span>
                <span className="style-card__desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Submit ── */}
        <div className="pref-submit">
          <button className="btn-sketch btn-sketch--large" onClick={onSubmit}>
            <SketchPlane size={20} color="white" style={{ marginRight:"8px" }}/>
            Generate My Recommendation
          </button>
          <p className="pref-submit__hint">Our AI will analyze your preferences and find the best routes.</p>
        </div>
      </div>
    </div>
  );
}


/* =============================================================
   海边沙滩背景插画 — 水粉蜡笔风格
   层次：海天渐变 / 远处礁石 / 海浪 / 沙滩 / 近景椰树 / 贝壳
   ============================================================= */
function BeachIllustration() {
  return (
    <svg width="100%" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice"
      fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── 海面（深蓝绿，水粉厚涂） ── */}
      <g filter="url(#gouache)">
        <rect x="0" y="0" width="1200" height="200" fill="#A8CCE0" fillOpacity="0.55"/>
        {/* 远海色块叠加，模拟水粉厚涂的颜色变化 */}
        <path d="M0 0 L0 80 C200 75 400 78 600 76 C800 74 1000 77 1200 75 L1200 0Z"
          fill="#8ABCD8" fillOpacity="0.45"/>
        <path d="M0 60 C150 55 350 60 550 57 C750 54 950 58 1200 56 L1200 0 L0 0Z"
          fill="#9EC8E0" fillOpacity="0.3"/>
        {/* 海面反光笔触 */}
        <path d="M80 40 C130 37 190 39 240 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.45"/>
        <path d="M350 35 C410 32 480 34 540 35" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.38"/>
        <path d="M680 42 C740 39 810 41 870 42" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.38"/>
        <path d="M950 36 C1010 33 1070 35 1130 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.42"/>
        <path d="M200 65 C270 62 360 64 430 65" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
        <path d="M600 58 C660 55 730 57 800 58" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      </g>

      {/* ── 远处礁石岛屿 ── */}
      <g filter="url(#gouache)">
        <ellipse cx="240" cy="145" rx="55" ry="22" fill="#8AAEC0" fillOpacity="0.55"/>
        <ellipse cx="240" cy="138" rx="42" ry="18" fill="#9ABECE" fillOpacity="0.6"/>
        <path d="M205 142 C215 130 228 126 240 128 C252 126 265 130 275 142"
          fill="#A8C8D8" fillOpacity="0.65"/>
        <path d="M218 134 C226 128 234 130 240 130" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>

        <ellipse cx="880" cy="150" rx="48" ry="18" fill="#8AAEC0" fillOpacity="0.50"/>
        <ellipse cx="880" cy="143" rx="36" ry="15" fill="#9ABECE" fillOpacity="0.55"/>
        <path d="M848 147 C858 136 870 132 880 134 C890 132 902 136 912 147"
          fill="#A8C8D8" fillOpacity="0.60"/>
        <path d="M862 140 C870 134 876 136 880 136" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
      </g>

      {/* ── 海浪（三层，由远及近逐渐清晰） ── */}
      <g filter="url(#softedge)">
        {/* 远浪 */}
        <path d="M0 168 C60 163 120 168 180 165 C240 162 300 167 360 164 C420 161 480 166 540 163 C600 160 660 165 720 162 C780 159 840 164 900 161 C960 158 1020 163 1080 160 C1120 158 1160 162 1200 160 L1200 175 L0 175Z"
          fill="white" fillOpacity="0.55"/>
        {/* 中浪 */}
        <path d="M0 178 C80 173 160 179 240 175 C320 171 400 177 480 173 C560 169 640 175 720 171 C800 167 880 173 960 170 C1040 167 1120 172 1200 169 L1200 185 L0 185Z"
          fill="white" fillOpacity="0.68"/>
        {/* 近浪 — 白色浪花泡沫，最厚 */}
        <path d="M0 192 C50 187 110 194 170 190 C230 186 290 193 350 189 C430 184 510 191 590 187 C670 183 750 190 830 186 C910 182 990 189 1070 185 C1120 183 1160 187 1200 185 L1200 200 L0 200Z"
          fill="white" fillOpacity="0.80"/>
        {/* 浪花细节笔触 */}
        <path d="M120 191 C135 188 155 190 168 191" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
        <path d="M380 188 C398 185 420 187 436 188" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
        <path d="M650 190 C668 187 688 189 704 190" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
        <path d="M920 187 C938 184 960 186 976 187" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      </g>

      {/* ── 沙滩主体 ── */}
      <g filter="url(#gouache)">
        <path d="M0 200 C100 196 250 198 400 200 C550 202 700 198 850 200 C1000 202 1100 198 1200 200 L1200 320 L0 320Z"
          fill="#E8D8A8" fillOpacity="0.78"/>
        {/* 沙滩色彩变化 — 水粉厚涂分层 */}
        <path d="M0 210 C150 206 350 210 550 208 C750 206 950 209 1200 207 L1200 240 C950 238 750 241 550 239 C350 237 150 240 0 238Z"
          fill="#DCC890" fillOpacity="0.45"/>
        {/* 沙地纹理笔触 */}
        <path d="M50 215 C100 212 160 214 210 215" stroke="#C8B878" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
        <path d="M300 220 C360 217 430 219 490 220" stroke="#C8B878" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
        <path d="M600 213 C660 210 730 212 790 213" stroke="#C8B878" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
        <path d="M900 218 C960 215 1030 217 1090 218" stroke="#C8B878" strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/>
        {/* 湿沙反光区域 */}
        <path d="M0 200 C150 198 350 202 550 200 C750 198 950 201 1200 199 L1200 210 C950 212 750 209 550 211 C350 213 150 210 0 212Z"
          fill="#D0C898" fillOpacity="0.35"/>
      </g>

      {/* ── 近景椰树（左侧） ── */}
      <g filter="url(#gouache)">
        {/* 树干 — 略弯曲，手绘感 */}
        <path d="M55 320 C58 280 62 240 68 200 C72 170 78 148 82 130"
          stroke="#8B6914" strokeWidth="10" strokeLinecap="round" fill="none"/>
        <path d="M55 320 C58 280 62 240 68 200 C72 170 78 148 82 130"
          stroke="#A07C20" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.6"/>
        {/* 树干纹理 */}
        <path d="M62 280 C65 278 68 279 70 280" stroke="#6A5010" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <path d="M65 250 C68 248 71 249 73 250" stroke="#6A5010" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
        <path d="M70 220 C73 218 76 219 78 220" stroke="#6A5010" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
        {/* 椰叶 — 放射状大叶片 */}
        <path d="M82 130 C60 110 30 105 10 112" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M82 130 C70 105 68 75 78 58" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M82 130 C100 108 115 95 125 90" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M82 130 C95 118 118 118 135 124" stroke="#4A7820" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M82 130 C55 125 35 130 18 140" stroke="#4A7820" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        {/* 叶片填色 */}
        <path d="M82 130 C60 110 30 105 10 112 C15 118 45 114 65 122 Z" fill="#6A9830" fillOpacity="0.65"/>
        <path d="M82 130 C70 105 68 75 78 58 C84 68 86 95 88 118 Z" fill="#5A8828" fillOpacity="0.60"/>
        <path d="M82 130 C100 108 115 95 125 90 C120 98 108 112 95 122 Z" fill="#6A9830" fillOpacity="0.65"/>
        {/* 椰子果 */}
        <circle cx="80" cy="140" r="7" fill="#8B6914" fillOpacity="0.8"/>
        <circle cx="90" cy="145" r="6" fill="#7A5810" fillOpacity="0.75"/>
      </g>

      {/* ── 近景椰树（右侧，稍矮） ── */}
      <g filter="url(#gouache)">
        <path d="M1145 320 C1142 282 1138 245 1132 208 C1128 178 1122 156 1118 138"
          stroke="#8B6914" strokeWidth="9" strokeLinecap="round" fill="none"/>
        <path d="M1145 320 C1142 282 1138 245 1132 208 C1128 178 1122 156 1118 138"
          stroke="#A07C20" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.55"/>
        <path d="M1118 138 C1140 118 1168 112 1188 118" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M1118 138 C1130 112 1128 82 1118 65" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M1118 138 C1100 115 1085 102 1075 97" stroke="#5A8830" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M1118 138 C1105 126 1082 125 1065 130" stroke="#4A7820" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M1118 138 C1145 133 1165 138 1182 148" stroke="#4A7820" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M1118 138 C1140 118 1168 112 1188 118 C1183 126 1155 122 1135 130 Z" fill="#6A9830" fillOpacity="0.65"/>
        <path d="M1118 138 C1130 112 1128 82 1118 65 C1113 76 1112 105 1114 128 Z" fill="#5A8828" fillOpacity="0.60"/>
        <path d="M1118 138 C1100 115 1085 102 1075 97 C1080 105 1094 118 1108 128 Z" fill="#6A9830" fillOpacity="0.65"/>
        <circle cx="1120" cy="148" r="6" fill="#8B6914" fillOpacity="0.78"/>
        <circle cx="1110" cy="152" r="5" fill="#7A5810" fillOpacity="0.72"/>
      </g>

      {/* ── 沙滩装饰：贝壳 + 脚印 ── */}
      <g>
        {/* 贝壳 1 */}
        <ellipse cx="320" cy="240" rx="10" ry="7" fill="#F0D8B0" fillOpacity="0.8" transform="rotate(-20 320 240)"/>
        <path d="M314 237 C318 232 325 235 326 240" stroke="#D8B880" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
        {/* 贝壳 2 */}
        <ellipse cx="680" cy="252" rx="8" ry="5" fill="#ECC8A0" fillOpacity="0.75" transform="rotate(15 680 252)"/>
        <path d="M675 249 C679 245 685 248 685 252" stroke="#D0A870" strokeWidth="1" strokeLinecap="round" opacity="0.55"/>
        {/* 贝壳 3 — 小螺旋 */}
        <circle cx="500" cy="230" r="5" fill="#F0D090" fillOpacity="0.7"/>
        <path d="M498 228 C500 225 503 226 504 229" stroke="#D8B060" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        {/* 脚印 */}
        <ellipse cx="410" cy="260" rx="4" ry="6" fill="#C8A860" fillOpacity="0.35" transform="rotate(-10 410 260)"/>
        <ellipse cx="422" cy="253" rx="4" ry="6" fill="#C8A860" fillOpacity="0.32" transform="rotate(8 422 253)"/>
        <ellipse cx="436" cy="262" rx="4" ry="6" fill="#C8A860" fillOpacity="0.3" transform="rotate(-8 436 262)"/>
        <ellipse cx="448" cy="255" rx="4" ry="6" fill="#C8A860" fillOpacity="0.28" transform="rotate(10 448 255)"/>
        {/* 水边小石头 */}
        <ellipse cx="160" cy="208" rx="12" ry="6" fill="#B8A878" fillOpacity="0.55"/>
        <ellipse cx="990" cy="206" rx="10" ry="5" fill="#B8A878" fillOpacity="0.5"/>
        <ellipse cx="780" cy="210" rx="8" ry="4" fill="#C0B080" fillOpacity="0.48"/>
      </g>

      {/* ── 远处帆船 ── */}
      <g filter="url(#gouache)" opacity="0.7">
        <path d="M580 110 L580 145" stroke="#B8C8D8" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M580 112 C568 118 562 128 564 140 L580 140Z" fill="white" fillOpacity="0.75"/>
        <path d="M580 115 C592 120 596 132 594 142 L580 142Z" fill="white" fillOpacity="0.65"/>
        <path d="M568 145 L594 145" stroke="#B8C8D8" strokeWidth="1.5" strokeLinecap="round"/>
      </g>

    </svg>
  );
}


/* =============================================================
   Mock 推荐数据 — 3 条路线
   ============================================================= */
const MOCK_RESULTS = [
  {
    rank: 1,
    route: ["SFO", "NRT", "ICN"],
    routeNames: ["San Francisco", "Tokyo", "Seoul"],
    layoverCity: "Tokyo",
    layoverDuration: "24h",
    price: "$610",
    duration: "17h total",
    totalScore: 92,
    scores: { price: 85, directness: 70, experience: 95 },
    pros: [
      "Excellent stopover experience in Tokyo",
      "Good balance between cost and travel time",
      "Convenient airport connection at NRT",
    ],
    cons: [
      "Longer total travel time vs direct flights",
    ],
    tags: ["🌸 Culture", "🍜 Food", "⚡ Tech"],
    accentColor: "#4A8CAE",
    bgColor: "#D4E8F4",
  },
  {
    rank: 2,
    route: ["SFO", "SIN", "ICN"],
    routeNames: ["San Francisco", "Singapore", "Seoul"],
    layoverCity: "Singapore",
    layoverDuration: "12h",
    price: "$540",
    duration: "22h total",
    totalScore: 84,
    scores: { price: 92, directness: 65, experience: 82 },
    pros: [
      "Most affordable option of the three routes",
      "World-class Changi Airport stopover experience",
      "Great food and shopping in Singapore",
    ],
    cons: [
      "Longer overall journey time",
      "Less cultural contrast than Tokyo layover",
    ],
    tags: ["🌿 Nature", "🛍️ Shopping", "💰 Best Value"],
    accentColor: "#35928C",
    bgColor: "#D0EEE8",
  },
  {
    rank: 3,
    route: ["SFO", "DXB", "ICN"],
    routeNames: ["San Francisco", "Dubai", "Seoul"],
    layoverCity: "Dubai",
    layoverDuration: "8h",
    price: "$720",
    duration: "20h total",
    totalScore: 76,
    scores: { price: 62, directness: 80, experience: 78 },
    pros: [
      "Relatively direct routing with shorter stopover",
      "Unique desert city experience",
      "Modern, efficient airport transit",
    ],
    cons: [
      "Higher ticket price",
      "Limited time to explore Dubai",
    ],
    tags: ["🌅 Views", "🏙️ Urban", "⚡ Efficient"],
    accentColor: "#B07030",
    bgColor: "#F4EAD4",
  },
];

/* =============================================================
   分数进度条组件
   ============================================================= */
function ScoreBar({ label, value, color }) {
  return (
    <div className="score-bar-row">
      <div className="score-bar-row__header">
        <span className="score-bar-row__label">{label}</span>
        <span className="score-bar-row__val" style={{ color }}>{value}<span>/100</span></span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width:`${value}%`, background: color }}/>
      </div>
    </div>
  );
}

/* =============================================================
   路线箭头 — 三个节点
   ============================================================= */
function RouteArrow({ codes, names, layoverIdx }) {
  return (
    <div className="route-arrow">
      {codes.map((code, i) => (
        <React.Fragment key={i}>
          <div className={`ra-node ${i === layoverIdx ? "ra-node--layover" : ""}`}>
            <div className="ra-node__code">{code}</div>
            <div className="ra-node__name">{names[i]}</div>
          </div>
          {i < codes.length - 1 && (
            <div className="ra-connector">
              <div className="ra-connector__line"/>
              <span className="ra-connector__plane">✈</span>
              <div className="ra-connector__line"/>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* =============================================================
   单张推荐卡
   ============================================================= */
function RecommendationCard({ data, isTop }) {
  const { rank, route, routeNames, layoverCity, layoverDuration,
          price, duration, totalScore, scores, pros, cons,
          tags, accentColor, bgColor } = data;

  return (
    <div className={`rec-card sketch-card ${isTop ? "rec-card--top" : ""}`}
      style={{ borderTop: `4px solid ${accentColor}` }}>

      {/* 卡片头部：排名徽章 + 路线 + 总分 */}
      <div className="rec-card__head">
        <div className="rec-card__rank" style={{ background: accentColor }}>
          {isTop ? "✦ Best Pick" : `#${rank}`}
        </div>
        <div className="rec-card__route-wrap">
          <RouteArrow codes={route} names={routeNames} layoverIdx={1}/>
        </div>
        <div className="rec-card__score-ring">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" stroke={bgColor} strokeWidth="5" fill="none"/>
            <circle cx="36" cy="36" r="28"
              stroke={accentColor} strokeWidth="5" fill="none"
              strokeDasharray={`${2*Math.PI*28*(totalScore/100)} ${2*Math.PI*28}`}
              strokeDashoffset={2*Math.PI*28*0.25}
              strokeLinecap="round" transform="rotate(-90 36 36)"/>
            <text x="36" y="42" textAnchor="middle" fontSize="18" fontWeight="700"
              fill={accentColor} fontFamily="Caveat, cursive">{totalScore}</text>
          </svg>
          <div className="rec-card__score-label">AI Score</div>
        </div>
      </div>

      {/* 기본 정보 행 */}
      <div className="rec-card__meta">
        <div className="rec-meta-item">
          <span className="rec-meta-item__icon">💰</span>
          <span className="rec-meta-item__val">{price}</span>
          <span className="rec-meta-item__label">Ticket</span>
        </div>
        <div className="rec-meta-divider"/>
        <div className="rec-meta-item">
          <span className="rec-meta-item__icon">⏱️</span>
          <span className="rec-meta-item__val">{duration}</span>
          <span className="rec-meta-item__label">Duration</span>
        </div>
        <div className="rec-meta-divider"/>
        <div className="rec-meta-item">
          <span className="rec-meta-item__icon">🏙️</span>
          <span className="rec-meta-item__val">{layoverCity}</span>
          <span className="rec-meta-item__label">Stopover · {layoverDuration}</span>
        </div>
      </div>

      {/* 分数条 */}
      <div className="rec-card__scores">
        <ScoreBar label="Price Score"      value={scores.price}      color="#5A9CC0"/>
        <ScoreBar label="Directness Score" value={scores.directness}  color="#8BA888"/>
        <ScoreBar label="Experience Score" value={scores.experience}  color={accentColor}/>
      </div>

      {/* AI 说明 */}
      <div className="rec-card__explain">
        <div className="explain-block">
          <div className="explain-block__title">✓ Why this route</div>
          <ul className="explain-list explain-list--pro">
            {pros.map((p,i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="explain-block">
          <div className="explain-block__title">△ Trade-offs</div>
          <ul className="explain-list explain-list--con">
            {cons.map((c,i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      </div>

      {/* 标签 */}
      <div className="rec-card__tags">
        {tags.map((t,i) => (
          <span key={i} className="rec-tag" style={{ borderColor: accentColor, color: accentColor }}>{t}</span>
        ))}
      </div>
    </div>
  );
}


/* =============================================================
   Result Page 主组件
   ============================================================= */
function ResultPage({ onBack }) {
  return (
    <div className="result-page">
      <GlobalDefs/>

      {/* 沙滩插画背景（固定在底部） */}
      <div className="beach-layer" aria-hidden="true">
        <BeachIllustration/>
      </div>

      {/* 导航 */}
      <nav className="nav-pill">
        <div className="nav-pill__logo">
          <SketchPlane size={22} color="#5A9CC0"/>
        </div>
        <div className="nav-pill__links">
          <a href="#" onClick={(e)=>{e.preventDefault();onBack()}}>Home</a>
          <a href="#results">Results</a>
        </div>
        <button className="btn-sketch btn-sketch--ghost" onClick={onBack}>← Back</button>
      </nav>

      {/* 页面内容 */}
      <div className="result-container">

        {/* 页面标题 */}
        <div className="result-header">
          <h1 className="result-header__title">Your Travel Recommendations</h1>
          <p className="result-header__sub">
            Our AI found <strong>3 routes</strong> that match your style.
            Discover your perfect stopover below.
          </p>
          {/* 装饰花朵 */}
          <SketchFlower size={44} color="#D4C8A0"
            style={{ position:"absolute", top:"8px", right:"0", opacity:0.45, transform:"rotate(12deg)" }}/>
        </div>

        {/* 推荐卡片列表 */}
        <div id="results" className="result-list">
          {MOCK_RESULTS.map((d, i) => (
            <RecommendationCard key={d.rank} data={d} isTop={i === 0}/>
          ))}
        </div>

        {/* 底部引用语 */}
        <div className="result-footer-quote">
          <em>"Every great journey begins with the right stopover."</em>
        </div>
      </div>
    </div>
  );
}


/* =============================================================
   Root App
   ============================================================= */
function App() {
  const [page, setPage] = useState("landing");
  return (
    <>
      {page === "landing"     && <LandingPage   onStart={() => setPage("preferences")}/>}
      {page === "preferences" && <PreferencePage onBack={() => setPage("landing")} onSubmit={() => setPage("results")}/>}
      {page === "results"     && <ResultPage     onBack={() => setPage("landing")}/>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);


