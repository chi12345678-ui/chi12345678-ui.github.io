/* ========================================
   阿历的数字花园 - 交互脚本
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
      icon: '📦'
    },
    {
      title: '电商用户复购归因分析',
      tags: ['RFM', '复购分析', 'A/B测试'],
      desc: '基于10万+用户交易数据，构建复购归因模型，识别高价值流失用户群体，精细化发券策略使召回效率提升2倍。',
      date: '2024-03',
      link: '复购分析案例.pdf',
      icon: '🔄'
    },
    {
      title: '线上平台用户RFM分层运营',
      tags: ['用户分层', '精细化运营', 'SQL'],
      desc: '将10万用户按RFM模型分为8个层级，制定差异化运营策略，月销从0增长至100W+，母婴店铺运营全案。',
      date: '2023-12',
      link: '线上平台用户RFM分析.html',
      icon: '🎯'
    },
    {
      title: '母婴电商增长运营全案',
      tags: ['增长黑客', '电商运营', '数据分析'],
      desc: '从0到1搭建母婴店铺数据运营体系，涵盖选品分析、流量拆解、转化漏斗优化与会员生命周期管理。',
      date: '2023-09',
      link: '#',
      icon: '👶'
    },
    {
      title: '市场竞品动态监控系统',
      tags: ['爬虫', '竞品分析', '自动化'],
      desc: '搭建竞品价格与促销动态监控仪表盘，实现每日自动抓取、异常预警与趋势分析，辅助定价决策。',
      date: '2024-01',
      link: '#',
      icon: '📡'
    }
  ],

  notes: [
    {
      title: 'Python pandas 数据清洗实战技巧',
      tags: ['Python', 'pandas'],
      desc: '整理日常分析中最常用的数据清洗方法：缺失值处理、重复值去重、异常值检测、数据类型转换等。',
      date: '2026-08-05'
    },
    {
      title: 'RFM模型原理与业务落地指南',
      tags: ['RFM', '用户运营'],
      desc: '从理论到实践，详解RFM模型的构建逻辑、分箱方法、业务解读与运营策略匹配。',
      date: '2026-07-20'
    },
    {
      title: 'Power BI DAX函数速查手册',
      tags: ['Power BI', 'DAX'],
      desc: '汇总最常用的DAX计算函数与度量值写法，附带实际业务场景示例。',
      date: '2026-07-10'
    },
    {
      title: 'SQL窗口函数详解与案例',
      tags: ['SQL', '数据分析'],
      desc: 'ROW_NUMBER、RANK、LEAD、LAG等窗口函数的使用场景与性能优化技巧。',
      date: '2026-06-28'
    },
    {
      title: 'A/B测试设计与结果解读',
      tags: ['A/B测试', '统计学'],
      desc: '如何设计一个科学的A/B测试：样本量计算、显著性检验、实验周期控制与结果落地。',
      date: '2026-06-15'
    },
    {
      title: '电商库存周转率优化思路',
      tags: ['库存管理', '供应链'],
      desc: '从数据角度分析库存周转慢的根因，以及如何通过数据模型优化补货节奏。',
      date: '2026-05-30'
    }
  ],

  blog: [
    {
      title: '从表格新手到数据分析师：我的三年成长路径',
      tags: ['职业成长', '数据分析'],
      desc: '回顾从市场营销专业毕业到成为数据分析师的完整路径，分享学习方法、踩过的坑和关键转折点。数据分析不是学工具，而是培养业务思维与数据敏感度。',
      date: '2026-07-15',
      readTime: '8分钟'
    },
    {
      title: '为什么你的RFM模型落不了地？',
      tags: ['RFM', '方法论'],
      desc: '很多分析师能做出漂亮的RFM分层图，但运营同学却不知道怎么用。问题在于：分层太粗、没有 actionable insight、缺乏闭环验证。本文分享让RFM真正产生业务价值的方法。',
      date: '2026-06-22',
      readTime: '12分钟'
    },
    {
      title: '电商数据分析的五个核心指标体系',
      tags: ['电商', '指标体系'],
      desc: '流量、转化、客单、复购、库存——电商分析的五大支柱。如何搭建一套既全面又不冗余的指标体系，是每个数据分析师的必修课。',
      date: '2026-05-18',
      readTime: '10分钟'
    },
    {
      title: '用数据讲故事：如何让老板听懂你的分析',
      tags: ['数据可视化', '沟通'],
      desc: '技术再强，讲不清楚等于零。从受众分析、结论先行、图表选择到演讲节奏，分享数据汇报的实战技巧。',
      date: '2026-04-10',
      readTime: '15分钟'
    }
  ],

  life: [
    {
      text: '今天终于把拖延了很久的博客重构完成了，从原来的内容堆叠改成了现在的精选+详情模式。设计这件事，真的是越简约越难做。',
      mood: '💻',
      date: '2026-08-08'
    },
    {
      text: '周末去了一趟书店，发现数据分析类的书越来越多了，但真正结合业务场景的却很少。还是实战出真知。',
      mood: '📚',
      date: '2026-08-02'
    },
    {
      text: '早上跑步5公里，边跑边想一个库存预测的问题，突然有了新思路。运动真的是最好的灵感来源。',
      mood: '🏃',
      date: '2026-07-25'
    },
    {
      text: '尝试了一家新开的咖啡馆，环境很适合写笔记。以后周末学习有固定据点了。',
      mood: '☕',
      date: '2026-07-18'
    },
    {
      text: '整理电脑里的项目文件，发现三年积累了这么多案例。从最早的Excel表格到现在的Python+BI，工具在变，但解决问题的思路是相通的。',
      mood: '📂',
      date: '2026-07-10'
    }
  ]
};

// ========================================
// 工具函数
// ========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========================================
// 1. 加载动画
// ========================================
window.addEventListener('load', () => {
  setTimeout(() => {
    $('#loader').classList.add('hidden');
  }, 800);
});

// ========================================
// 2. Canvas 粒子背景
// ========================================
(function initParticles() {
  const canvas = $('#heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: null, y: null };
  let animationId;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.size = Math.random() * 2 + 1;
      this.color = Math.random() > 0.5 ? 'rgba(99,102,241,' : 'rgba(139,92,246,';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

      // 鼠标交互
      if (mouse.x != null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.vx -= (dx / dist) * force * 0.02;
          this.vy -= (dy / dist) * force * 0.02;
        }
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + '0.6)';
      ctx.fill();
    }
  }

  function init() {
    particles = [];
    const count = Math.min(80, Math.floor(canvas.width * canvas.height / 12000));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }
  init();

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(99,102,241,${0.15 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => { p.update(); p.draw(); });
    animationId = requestAnimationFrame(animate);
  }
  animate();

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // 页面不可见时暂停动画
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      animate();
    }
  });
})();

// ========================================
// 3. 打字机效果
// ========================================
(function initTypewriter() {
  const el = $('#typewriter');
  if (!el) return;
  const texts = [
    '数据分析从业者',
    '电商增长专家',
    '库存优化实践者',
    '数字花园园丁'
  ];
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let pause = 0;

  function type() {
    const current = texts[textIndex];
    if (isDeleting) {
      el.textContent = current.substring(0, charIndex - 1);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex + 1);
      charIndex++;
    }

    let speed = isDeleting ? 50 : 120;
    if (!isDeleting && charIndex === current.length) {
      speed = 2000;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      textIndex = (textIndex + 1) % texts.length;
      speed = 500;
    }
    setTimeout(type, speed);
  }
  setTimeout(type, 1000);
})();

// ========================================
// 4. 滚动动画 (Intersection Observer)
// ========================================
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // 为需要动画的元素添加类
  const addReveal = () => {
    $$('.section-header, .section-subtitle, .project-card, .note-item, .blog-card, .life-card, .skill-card, .stat-item, .about-lead, .about-photo-wrapper').forEach((el, i) => {
      el.classList.add('reveal');
      el.classList.add(`reveal-delay-${(i % 3) + 1}`);
      observer.observe(el);
    });
  };
  addReveal();
})();

// ========================================
// 5. 数字计数动画
// ========================================
(function initCounters() {
  const counters = $$('.stat-number');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.closest('.stat-item').dataset.target);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const increment = target / 60;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = Math.floor(current) + suffix;
        }, 30);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
})();

// ========================================
// 6. 导航高亮 + 平滑滚动
// ========================================
(function initNav() {
  const sections = $$('section[id]');
  const navLinks = $$('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.dataset.section === id);
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));

  // 平滑滚动
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        // 移动端关闭菜单
        $('#sidebar').classList.remove('open');
        $('#menuToggle').classList.remove('active');
        $('#menuOverlay').classList.remove('active');
      }
    });
  });
})();

// ========================================
// 7. 移动端菜单
// ========================================
$('#menuToggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
  $('#menuToggle').classList.toggle('active');
  $('#menuOverlay').classList.toggle('active');
});

$('#menuOverlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('open');
  $('#menuToggle').classList.remove('active');
  $('#menuOverlay').classList.remove('active');
});

// ========================================
// 8. 渲染内容卡片
// ========================================
function renderProjects() {
  const grid = $('#projectsGrid');
  if (!grid) return;
  const featured = DATA.projects.slice(0, 3);
  grid.innerHTML = featured.map(p => `
    <article class="project-card" onclick="window.open('${p.link}', '_blank')">
      <div class="project-image">
        <div class="project-image-placeholder">${p.icon}</div>
      </div>
      <div class="project-body">
        <div class="project-tags">
          ${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
        </div>
        <h3 class="project-title">${p.title}</h3>
        <p class="project-desc">${p.desc}</p>
        <div class="project-meta">
          <span>${p.date}</span>
          <span class="project-link">查看详情 →</span>
        </div>
      </div>
    </article>
  `).join('');
}

function renderNotes() {
  const list = $('#notesList');
  if (!list) return;
  const featured = DATA.notes.slice(0, 3);
  list.innerHTML = featured.map(n => `
    <article class="note-item">
      <span class="note-date">${n.date}</span>
      <div class="note-content">
        <h3 class="note-title">${n.title}</h3>
        <p class="note-desc">${n.desc}</p>
      </div>
      <div class="note-tags">
        ${n.tags.map(t => `<span class="note-tag">${t}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function renderBlog() {
  const grid = $('#blogGrid');
  if (!grid) return;
  const featured = DATA.blog.slice(0, 2);
  grid.innerHTML = featured.map(b => `
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
  if (!grid) return;
  const featured = DATA.life.slice(0, 3);
  grid.innerHTML = featured.map(l => `
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

// 初始化渲染
renderProjects();
renderNotes();
renderBlog();
renderLife();

// ========================================
// 9. 详情覆盖层
// ========================================
let currentDetailType = '';

function openDetail(type) {
  currentDetailType = type;
  const overlay = $('#detailOverlay');
  const label = $('#detailLabel');
  const title = $('#detailTitle');
  const content = $('#detailContent');
  const search = $('#detailSearch');

  const config = {
    projects: { label: 'PROJECTS', title: '全部项目案例' },
    notes: { label: 'LEARNING', title: '全部学习笔记' },
    blog: { label: 'BLOG', title: '全部博客文章' },
    life: { label: 'LIFE', title: '全部生活随笔' }
  };

  label.textContent = config[type].label;
  title.textContent = config[type].title;
  search.value = '';
  content.innerHTML = renderDetailItems(type, DATA[type]);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderDetailItems(type, items) {
  if (type === 'projects') {
    return items.map(p => `
      <div class="detail-item" data-title="${p.title}" data-desc="${p.desc}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <h3 style="font-size:18px;font-weight:600;">${p.icon} ${p.title}</h3>
          <span style="font-size:12px;color:var(--text-muted);">${p.date}</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.7;margin-bottom:12px;">${p.desc}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }
  if (type === 'notes') {
    return items.map(n => `
      <div class="detail-item" data-title="${n.title}" data-desc="${n.desc}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <h3 style="font-size:17px;font-weight:600;">${n.title}</h3>
          <span style="font-size:12px;color:var(--text-muted);font-family:monospace;">${n.date}</span>
        </div>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.7;margin-bottom:10px;">${n.desc}</p>
        <div style="display:flex;gap:8px;">
          ${n.tags.map(t => `<span class="note-tag">${t}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }
  if (type === 'blog') {
    return items.map(b => `
      <div class="detail-item" data-title="${b.title}" data-desc="${b.desc}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted);">
            <span>${b.date}</span>
            <span>阅读约 ${b.readTime}</span>
          </div>
        </div>
        <h3 style="font-size:19px;font-weight:600;margin-bottom:10px;line-height:1.4;">${b.title}</h3>
        <p style="color:var(--text-secondary);font-size:15px;line-height:1.8;">${b.desc}</p>
      </div>
    `).join('');
  }
  if (type === 'life') {
    return items.map(l => `
      <div class="detail-item" data-title="${l.text}" data-desc="${l.text}">
        <div style="display:flex;gap:16px;align-items:flex-start;">
          <span style="font-size:32px;line-height:1;">${l.mood}</span>
          <div style="flex:1;">
            <p style="color:var(--text-secondary);font-size:15px;line-height:1.8;margin-bottom:10px;">${l.text}</p>
            <span style="font-size:12px;color:var(--text-muted);">${l.date}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
  return '';
}

function closeDetail() {
  $('#detailOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function filterDetail() {
  const query = $('#detailSearch').value.toLowerCase();
  $$('.detail-item').forEach(item => {
    const title = item.dataset.title.toLowerCase();
    const desc = item.dataset.desc.toLowerCase();
    item.classList.toggle('hidden', !(title.includes(query) || desc.includes(query)));
  });
}

$('#detailClose').addEventListener('click', closeDetail);
$('#detailOverlay').addEventListener('click', (e) => {
  if (e.target === $('#detailOverlay')) closeDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
});

// ========================================
// 10. 二维码弹窗
// ========================================
function showQR(src, label) {
  const modal = $('#qrModal');
  $('#qrImage').src = src;
  $('#qrLabel').textContent = `扫码添加${label}`;
  modal.classList.add('active');
}

function closeQR() {
  $('#qrModal').classList.remove('active');
}

$('#qrModal').addEventListener('click', (e) => {
  if (e.target === $('#qrModal')) closeQR();
});

// ========================================
// 11. 卡片 3D 倾斜效果（桌面端）
// ========================================
if (window.matchMedia('(hover: hover)').matches) {
  $$('.project-card, .blog-card, .life-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ========================================
// 12. 键盘快捷键
// ========================================
document.addEventListener('keydown', (e) => {
  // / 键聚焦搜索
  if (e.key === '/' && $('#detailOverlay').classList.contains('active')) {
    e.preventDefault();
    $('#detailSearch').focus();
  }
});

console.log('%c🌱 阿历的数字花园已加载', 'color:#6366f1;font-size:14px;font-weight:bold;');
console.log('%c欢迎探索项目、笔记、博客与生活随笔', 'color:#94a3b8;font-size:12px;');
