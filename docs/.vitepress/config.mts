import { defineConfig } from 'vitepress'

const HOST = 'https://kudianwanjia.github.io'
const BASE = '/Clone-OpenSoure-HardWare/'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "刻龙开源智能硬件",
  description: "AI智能硬件 开源硬件",
  // 启用最后更新时间 → sitemap 的 lastmod
  lastUpdated: true,
  // 内置 sitemap
  sitemap: {
    hostname: 'https://kudianwanjia.github.io',
    lastmod: 'date'
  },
  head: [
    ['link', { rel: 'icon', href: '/Clone-OpenSoure-HardWare/icons/favicon.ico' }],

    // 基础 SEO(搜索引擎看的网页简介)
    ['meta', { name: 'description', content: '刻龙开源智能硬件 — 刻龙开源硬件社区，致力于音视频AI智能硬件。' }],
    ['meta', { name: 'keywords', content: '刻龙开源智能硬件, 开源硬件, AI智能硬件, Clone Board, RV1106, RV1106B, SSC305, SSC308, 音视频开发套件' }],
    ['meta', { name: 'author', content: 'KuDianWanJia' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    // Open Graph(网页分享到社交平台时能显示成统一的"卡片样式"\国内基本用这个)
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: '刻龙开源智能硬件' }],
    ['meta', { property: 'og:image', content: `${HOST}${BASE}icons/logo2.png` }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    // Bing 添加并验证网站
    ['meta', { name: 'msvalidate.01', content: '965FD9EC6D1446385E5C95766701EFCC' }],
    // 组织实体标记（让百度/必应知道“刻龙开源硬件”=这个站）
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '刻龙开源智能硬件',
      alternateName: ['刻龙开源智能硬件', 'KuDianWanJia', '酷电玩家'],
      url: `${HOST}${BASE}`,
      logo: `${HOST}${BASE}icons/logo2.png`,
      description: '音视频 AI 智能硬件开源社区',
      sameAs: [
        'https://github.com/KuDianWanJia',
        'https://gitee.com/KuDianWanJia',
        'https://space.bilibili.com/390456922',
        'https://oshwhub.com/PQG2030PQG',
        'https://clone-board.taobao.com/'
      ]
    })]
  ],
  // 每页动态注入 canonical + og:url + og:title + og:description(给每个页面自动注入SEO和社交分享相关的<head>标签)
  transformPageData(pageData) {
    const url = `${HOST}${BASE}${pageData.relativePath}`
      .replace(/\.md$/, '')
      .replace(/\/index$/, '/')

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: `${pageData.title} | 刻龙开源智能硬件` }],
      ['meta', { property: 'og:description', content: pageData.description || 'AI智能硬件 开源硬件' }],
    )
  },
  appearance: 'dark',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/icons/logo2.png",
    nav: [
      { text: '首页 📒', link: '/' },
      { text: '官方店铺 🛒',
        items: [
          {
            text: '官方店铺🛒', link: 'https://clone-board.taobao.com/'
          }
        ]
      },
      {
        text: '硬件选型 🐣',
        items: [
          {
            text: '文档合集📚',
            items: [
              { text: '开发文档合集', link: '/docs/Clone-Board/study.md' },
            ],
          },
          {
            text: 'AI智能硬件开发套件🧠',
            items: [
              { text: 'Clone-RVG2-Board开发套件', link: '/docs/Clone-RVG2-Board/main.md' },
              { text: 'Clone-SSC30X-Board开发套件', link: '/docs/Clone-SSC30X-Board/main.md' },
            ],
          },
          {
            text: 'Vision视觉开发套件👓',
            items: [
              { text: 'Clone-RVG2-Board开发套件', link: '/docs/Clone-RVG2-Board/main.md' },
              { text: 'Clone-SSC30X-Board开发套件', link: '/docs/Clone-SSC30X-Board/main.md' },
            ],
          },
        ],
      },
      { text: '技术交流 💬',
        items: [
          {
            text: '技术交流💬', link: '/docs/iscuss.md'
          }
        ]
      },
      { text: '支持我们 💰',
        items: [
          {
            text: '支持我们', link: '/docs/donate.md'
          }
        ]
      },
      { text: '摸鱼专区 🎮',
        items: [
          {
            text: '小游戏🎮', link: '/games/index.md'
          },
          {
            text: 'Chrome 小恐龙🦖', link: '/games/dino.md'
          },
          {
            text: '贪吃蛇🐍', link: '/games/snake.md'
          },
          {
            text: '俄罗斯方块🧱', link: '/games/tetris.md'
          }
        ]
      },
    ],

    sidebar: {
      '/docs/': [
        {
          text: '📖学习交流',
          items: [
            { text: '📃技术交流', link: '/docs/iscuss.md' },
            { text: '😁支持我们', link: '/docs/donate.md' },
          ]
        },
      ],
      '/docs/Clone-Board/': [
        {
          text: '📖文档合集',
          items: [
            { text: '📃学习文档', link: '/docs/Clone-Board/study.md' },
          ]
        },
      ],
      '/docs/Clone-RVG2-Board/': [
        {
          text: '📒文档介绍',
          items: [
            { text: '📃文档目录', link: '/docs/Clone-RVG2-Board/main.md' },
          ]
        },
        {
          text: '📒使用指南',
          items: [
            { text: '📃开箱体验', link: '/docs/Clone-RVG2-Board/00.Clone-RVG2-Board.md' },
          ]
        },
        {
          text: '📒开发准备',
          items: [
            { text: '📃环境搭建', link: '/docs/Clone-RVG2-Board/01.Clone-RVG2-Board.md' },
            { text: '📃SDK获取', link: '/docs/Clone-RVG2-Board/02.Clone-RVG2-Board.md' },
          ]
        },
        {
          text: '📒软件开发',
          items: [
            { text: '📃SDK编译', link: '/docs/Clone-RVG2-Board/03.Clone-RVG2-Board.md' },
            { text: '📃固件下载', link: '/docs/Clone-RVG2-Board/04.Clone-RVG2-Board.md' },
            { text: '📃Sample运行', link: '/docs/Clone-RVG2-Board/05.Clone-RVG2-Board.md' },
          ]
        },
        {
          text: '📒配套应用',
          items: [
            { text: '📃AI小智', link: '/docs/Clone-RVG2-Board/06.Clone-RVG2-Board.md' },
            { text: '📃便携摄像机', link: '/docs/Clone-RVG2-Board/07.Clone-RVG2-Board.md' },
            { text: '📃火山引擎AI实时对话', link: '/docs/Clone-RVG2-Board/08.Clone-RVG2-Board.md' },
          ]
        }
      ],
      '/docs/Clone-SSC30X-Board/': [
        {
          text: '📒文档介绍',
          items: [
            { text: '📃文档目录', link: '/docs/Clone-RVG2-Board/main.md' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/KuDianWanJia' },
      { icon: 'gitee', link: 'https://gitee.com/KuDianWanJia' },
      { icon: 'bilibili', link: 'https://space.bilibili.com/390456922' },
      { icon: 'opensourcehardware', link: 'https://oshwhub.com/PQG2030PQG' },
    ],

    footer: {
      message: '备案号：湘ICP备202609271658号',
      copyright: 'Copyright © 2025-2026 刻龙开源硬件社区'
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: { // 如果你想翻译默认语言，请将此处设为 `root`
            translations: {
              button: {
                buttonText: '搜索🔎',
                buttonAriaLabel: '搜索'
              },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '输入',
                  navigateText: '导航',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          },
          zh: { // 如果你想翻译默认语言，请将此处设为 `root`
            translations: {
              button: {
                buttonText: '搜索🔎',
                buttonAriaLabel: '搜索'
              },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '输入',
                  navigateText: '导航',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          }
        }
      }
    }
  },
  base: '/Clone-OpenSoure-HardWare/'
})
