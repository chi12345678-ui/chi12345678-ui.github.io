/* ========================================
   阿历的数字花园 — 交互脚本
   ======================================== */

// ========================================
// 数据配置（后期在这里更新内容）
// ========================================
const DATA = {
  projects: [
    {
      title: '快消品进销存智能补货模型',
      tags: ['库存优化', 'Python', 'Power BI'],
      desc: '搭建库存健康度诊断体系与智能补货模型，将缺货率降低40%，库存周转提升2倍。包含完整的数据清洗、预测模型与可视化看板。',
      date: '2024-06',
      link: '快消品进销存案例分析报告.pdf',
      icon: '📦',
      img: ''
    },
    {
      title: '电商用户复购归因分析',
      tags: ['RFM', '复购分析', 'A/B测试'],
      desc: '基于10万+用户交易数据，构建复购归因模型，识别高价值流失用户群体，精细化发券策略使召回效率提升2倍。',
      date: '2024-03',
      link: '复购分析案例.pdf',
      icon: '🔄',
      img: ''
    },
    {
      title: '线上平台用户RFM分层运营',
      tags: ['用户分层', '精细化运营', 'SQL'],
      desc: '将10万用户按RFM模型分为8个层级，制定差异化运营策略，月销从0增长至100W+，母婴店铺运营全案。',
      date: '2023-12',
      link: '线上平台用户RFM分析.html',
      icon: '🎯',
      img: ''
    },
    {
      title: '母婴电商增长运营全案',
      tags: ['增长黑客', '电商运营', '数据分析'],
      desc: '从0到1搭建母婴店铺数据运营体系，涵盖选品分析、流量拆解、转化漏斗优化与会员生命周期管理。',
      date: '2023-09',
      link: '#',
      icon: '👶',
      img: ''
    },
    {
      title: '市场竞品动态监控系统',
      tags: ['爬虫', '竞品分析', '自动化'],
      desc: '搭建竞品价格与促销动态监控仪表盘，实现每日自动抓取、异常预警与趋势分析，辅助定价决策。',
      date: '2024-01',
      link: '#',
      icon: '📡',
      img: ''
    },
    {
      title: '会员生命周期价值预测模型',
      tags: ['LTV', '机器学习', 'Python'],
      desc: '基于历史交易与行为数据，构建会员LTV预测模型，为不同价值段用户制定差异化留存策略。',
      date: '2024-08',
      link: '#',
      icon: '💎',
      img: ''
    }
  ],

  notes: [
    { title: 'Python pandas 数据清洗实战技巧', tags: ['Python','pandas'], desc: '整理日常分析中最常用的数据清洗方法：缺失值处理、重复值去重、异常值检测、数据类型转换等。', date: '2026-08-05' },
    { title: 'RFM模型原理与业务落地指南', tags: ['RFM','用户运营'], desc: '从理论到实践，详解RFM模型的构建逻辑、分箱方法、业务解读与运营策略匹配。', date: '2026-07-20' },
    { title: 'Power BI DAX函数速查手册', tags: ['Power BI','DAX'], desc: '汇总最常用的DAX计算函数与度量值写法，附带实际业务场景示例。', date: '2026-07-10' },
    { title: 'SQL窗口函数详解与案例', tags: ['SQL','数据分析'], desc: 'ROW_NUMBER、RANK、LEAD、LAG等窗口函数的使用场景与性能优化技巧。', date: '2026-06-28' },
    { title: 'A/B测试设计与结果解读', tags: ['A/B测试','统计学'], desc: '如何设计一个科学的A/B测试：样本量计算、显著性检验、实验周期控制与结果落地。', date: '2026-06-15' },
    { title: '电商库存周转率优化思路', tags: ['库存管理','供应链'], desc: '从数据角度分析库存周转慢的根因，以及如何通过数据模型优化补货节奏。', date: '2026-05-30' },
    { title: '用户留存分析框架搭建', tags: ['留存分析','用户增长'], desc: ' cohort 分析、留存曲线解读、影响留存的关键因素识别与干预策略。', date: '2026-05-15' },
    { title: 'Excel 高级技巧：动态图表与数据透视', tags: ['Excel','可视化'], desc: 'OFFSET、INDEX、MATCH组合实现动态图表，数据透视表的高级用法与常见坑。', date: '2026-04-28' }
  ],

  blog: [
    { title: '从表格新手到数据分析师：我的三年成长路径', tags: ['职业成长','数据分析'], desc: '回顾从市场营销专业毕业到成为数据分析师的完整路径，分享学习方法、踩过的坑和关键转折点。数据分析不是学工具，而是培养业务思维与数据敏感度。', date: '2026-07-15', readTime: '8分钟' },
    { title: '为什么你的RFM模型落不了地？', tags: ['RFM','方法论'], desc: '很多分析师能做出漂亮的RFM分层图，但运营同学却不知道怎么用。问题在于：分层太粗、没有 actionable insight、缺乏闭环验证。本文分享让RFM真正产生业务价值的方法。', date: '2026-06-22', readTime: '12分钟' },
    { title: '电商数据分析的五个核心指标体系', tags: ['电商','指标体系'], desc: '流量、转化、客单、复购、库存——电商分析的五大支柱。如何搭建一套既全面又不冗余的指标体系，是每个数据分析师的必修课。', date: '2026-05-18', readTime: '10分钟' },
    { title: '用数据讲故事：如何让老板听懂你的分析', tags: ['数据可视化','沟通'], desc: '技术再强，讲不清楚等于零。从受众分析、结论先行、图表选择到演讲节奏，分享数据汇报的实战技巧。', date: '2026-04-10', readTime: '15分钟' },
    { title: '数据分析师的「业务感」是怎么练出来的？', tags: ['职业成长','思维'], desc: '业务感不是天生的，是可以通过刻意练习培养的。分享我日常积累业务感的三个方法：多问为什么、关注业务结果、建立行业知识库。', date: '2026-03-20', readTime: '10分钟' }
  ],

  life: [
    { text: '今天终于把拖延了很久的博客重构完成了，从原来的内容堆叠改成了现在的精选+展开模式。设计这件事，真的是越简约越难做。', mood: '💻', date: '2026-08-08' },
    { text: '周末去了一趟书店，发现数据分析类的书越来越多了，但真正结合业务场景的却很少。还是实战出真知。', mood: '📚', date: '2026-08-02' },
    { text: '早上跑步5公里，边跑边想一个库存预测的问题，突然有了新思路。运动真的是最好的灵感来源。', mood: '🏃', date: '2026-07-25' },
    { text: '尝试了一家新开的咖啡馆，环境很适合写笔记。以后周末学习有固定据点了。', mood: '☕', date: '2026-07-18' },
    { text: '整理电脑里的项目文件，发现三年积累了这么多案例。从最早的Excel表格到现在的Python+BI，工具在变，但解决问题的思路是相通的。', mood: '📂', date: '2026-07-10' },
    { text: '今天帮朋友看了一个数据分析面试题，发现基础概念很多人其实理解得不够深。有时候最简单的问题反而最容易被忽视。', mood: '🤔', date: '2026-06-28' }
  ]
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ========================================
// 1. 渲染内容
// ========================================
function renderProjects() {
  const grid = $('#projectsGrid');
  if(!grid) return;
  const items = DATA.projects.slice(0,3);
  grid.innerHTML = items.map(p => `
    <article class="project-card" onclick="window.open('${p.link}','_blank')">
      <div class="project-img">
        ${p.img ? `<img src="${p.img}" alt="${p.title}">` : `<div class="project-img-placeholder">${p.icon}</div>`}
      </div>
      <div class="project-body">
        <div class="project-tags">${p.tags.map(t=>`<span class="project-tag">${t}</span>`).join('')}</div>
        <h3 class="project-title">${p.title}</h3>
        <p class="project-desc">${p.desc}</p>
        <div class="project-meta">
          <span>${p.date}</span>
          <span class="project-link">查看详情</span>
        </div>
      </div>
    </article>
  `).join('');
}

function renderNotes() {
  const list = $('#notesList');
  if(!list) return;
  const items = DATA.notes.slice(0,3);
  list.innerHTML = items.map(n => `
    <article class="note-item">
      <span class="note-date">${n.date}</span>
      <div class="note-content">
        <h3 class="note-title">${n.title}</h3>
        <p class="note-desc">${n.desc}</p>
      </div>
      <div class="note-tags">${n.tags.map(t=>`<span class="note-tag">${t}</span>`).join('')}</div>
    </article>
  `).join('');
}

function renderBlog() {
  const grid = $('#blogGrid');
  if(!grid) return;
  const items = DATA.blog.slice(0,2);
  grid.innerHTML = items.map(b => `
    <article class="blog-card">
      <div class="blog-meta">
        <span>${b.date}</span>
        <span>阅读约 ${b.readTime}</span>
      </div>
      <h3 class="blog-title">${b.title}</h3>
      <p class="blog-excerpt">${b.desc}</p>
      <span class="blog-readmore">阅读全文 →</span>
    </article>
  `).join('');
}

function renderLife() {
  const grid = $('#lifeGrid');
  if(!grid) return;
  const items = DATA.life.slice(0,3);
  grid.innerHTML = items.map(l => `
    <article class="life-card">
      <div class="life-mood">${l.mood}</div>
      <p class="life-text">${l.text}</p>
      <div class="life-footer">
        <span>${l.date}</span>
        <span>随笔</span>
      </div>
    </article>
  `).join('');
}

// ========================================
// 2. "查看全部" — 在当前 section 内展开
// ========================================
function toggleSection(type) {
  const moreEl = $(`#${type}More`);
  const btnEl = $(`#${type}Toggle`);
  if(!moreEl || !btnEl) return;

  const isOpen = moreEl.classList.contains('open');

  if(isOpen) {
    // 收起
    moreEl.classList.remove('open');
    btnEl.textContent = '查看全部';
    // 平滑滚动回 section 顶部
    const section = $(`#${type}`);
    if(section) section.scrollIntoView({ behavior:'smooth', block:'start' });
  } else {
    // 展开 — 渲染剩余内容
    const remaining = DATA[type].slice(type==='blog'?2:3);
    if(remaining.length === 0) {
      btnEl.textContent = '已显示全部';
      return;
    }

    let html = '';
    if(type === 'projects') {
      html = `<div class="projects-grid">${remaining.map(p=>`
        <article class="project-card" onclick="window.open('${p.link}','_blank')">
          <div class="project-img">
            ${p.img?`<img src="${p.img}" alt="${p.title}">`:`<div class="project-img-placeholder">${p.icon}</div>`}
          </div>
          <div class="project-body">
            <div class="project-tags">${p.tags.map(t=>`<span class="project-tag">${t}</span>`).join('')}</div>
            <h3 class="project-title">${p.title}</h3>
            <p class="project-desc">${p.desc}</p>
            <div class="project-meta">
              <span>${p.date}</span>
              <span class="project-link">查看详情</span>
            </div>
          </div>
        </article>
      `).join('')}</div>`;
    }
    else if(type === 'notes') {
      html = remaining.map(n=>`
        <article class="note-item">
          <span class="note-date">${n.date}</span>
          <div class="note-content">
            <h3 class="note-title">${n.title}</h3>
            <p class="note-desc">${n.desc}</p>
          </div>
          <div class="note-tags">${n.tags.map(t=>`<span class="note-tag">${t}</span>`).join('')}</div>
        </article>
      `).join('');
    }
    else if(type === 'blog') {
      html = `<div class="blog-grid">${remaining.map(b=>`
        <article class="blog-card">
          <div class="blog-meta">
            <span>${b.date}</span>
            <span>阅读约 ${b.readTime}</span>
          </div>
          <h3 class="blog-title">${b.title}</h3>
          <p class="blog-excerpt">${b.desc}</p>
          <span class="blog-readmore">阅读全文 →</span>
        </article>
      `).join('')}</div>`;
    }
    else if(type === 'life') {
      html = `<div class="life-grid">${remaining.map(l=>`
        <article class="life-card">
          <div class="life-mood">${l.mood}</div>
          <p class="life-text">${l.text}</p>
          <div class="life-footer">
            <span>${l.date}</span>
            <span>随笔</span>
          </div>
        </article>
      `).join('')}</div>`;
    }

    moreEl.innerHTML = html;
    moreEl.classList.add('open');
    btnEl.textContent = '收起';
  }
}

// ========================================
// 3. 导航高亮 + 平滑滚动
// ========================================
(function initNav(){
  const sections = $$('section[id]');
  const links = $$('.nav-link');

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const id = entry.target.id;
        links.forEach(l=>{
          l.classList.toggle('active', l.dataset.section === id);
        });
      }
    });
  },{threshold:0.3});

  sections.forEach(s=>observer.observe(s));

  links.forEach(link=>{
    link.addEventListener('click',(e)=>{
      e.preventDefault();
      const target = $(link.getAttribute('href'));
      if(target){
        target.scrollIntoView({behavior:'smooth'});
        $('#sidebar').classList.remove('open');
        $('#mobileMenuBtn').classList.remove('active');
      }
    });
  });
})();

// ========================================
// 4. 移动端菜单
// ========================================
$('#mobileMenuBtn').addEventListener('click',()=>{
  $('#sidebar').classList.toggle('open');
  $('#mobileMenuBtn').classList.toggle('active');
});

// 点击侧边栏外部关闭菜单
document.addEventListener('click',(e)=>{
  const sidebar = $('#sidebar');
  const btn = $('#mobileMenuBtn');
  if(window.innerWidth <= 768 && sidebar.classList.contains('open')){
    if(!sidebar.contains(e.target) && !btn.contains(e.target)){
      sidebar.classList.remove('open');
      btn.classList.remove('active');
    }
  }
});

// ========================================
// 5. 数字计数动画
// ========================================
(function initCounters(){
  const counters = $$('.about-stat-num');
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const step = target / 50;
        const timer = setInterval(()=>{
          current += step;
          if(current >= target){ current = target; clearInterval(timer); }
          el.textContent = Math.floor(current) + suffix;
        },30);
        observer.unobserve(el);
      }
    });
  },{threshold:0.5});
  counters.forEach(c=>observer.observe(c));
})();

// ========================================
// 6. 滚动动画
// ========================================
(function initReveal(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) entry.target.classList.add('visible');
    });
  },{threshold:0.1, rootMargin:'0px 0px -60px 0px'});

  const els = $$('.section-header, .section-desc, .project-card, .note-item, .blog-card, .life-card, .about-card, .about-stat, .hero-text, .hero-photo, .contact-inner');
  els.forEach((el,i)=>{
    el.classList.add('reveal', `reveal-d${(i%3)+1}`);
    observer.observe(el);
  });
})();

// ========================================
// 7. 二维码弹窗
// ========================================
function showQR(src, label){
  const modal = $('#qrModal');
  const img = $('#qrImg');
  const text = $('#qrText');
  img.src = src;
  text.textContent = '扫码添加' + label;
  modal.classList.add('active');
}
function closeQR(){
  $('#qrModal').classList.remove('active');
}
$('#qrModal').addEventListener('click',(e)=>{
  if(e.target === $('#qrModal')) closeQR();
});

// ========================================
// 8. 初始化
// ========================================
renderProjects();
renderNotes();
renderBlog();
renderLife();

console.log('%c🌱 阿历的数字花园已加载', 'color:#b8860b;font-size:14px;font-weight:bold;');
