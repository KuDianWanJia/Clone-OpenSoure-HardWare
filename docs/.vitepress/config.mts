import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "刻龙智能硬件🐲",
  description: "AI智能硬件 开源硬件",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/icons/logo2.png",
    nav: [
      { text: '首页📒', link: '/' },
      { text: '官方店铺🛒', link: 'https://clone-board.taobao.com/' },
      {
        text: '硬件选型🐣',
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
      { text: '交流💬', link: '/docs/iscuss.md' },
      { text: '💰', link: '/docs/donate.md' },
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
