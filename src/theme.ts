import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export const darkTheme: ThemeConfig = {
  token: {
    colorBgBase: '#16213e',
    colorBgContainer: '#1e2a4a',
    colorBgElevated: '#1a1a2e',
    colorBgLayout: '#16213e',
    colorTextBase: '#e0e0e0',
    colorPrimary: '#4096ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#4096ff',
    borderRadius: 6,
    fontSize: 13,
  },
  algorithm: theme.darkAlgorithm,
  components: {
    Button: {
      algorithm: true,
      primaryShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
    },
    Layout: {
      headerBg: '#16213e',
      siderBg: '#16213e',
    },
    Menu: {
      itemBg: 'transparent',
    },
    Modal: {
      contentBg: '#1e2a4a',
    },
    Card: {
      colorBgContainer: '#1e2a4a',
    },
    Select: {
      optionSelectedBg: '#1a1a2e',
    },
    Table: {
      headerBg: '#16213e',
      rowHoverBg: '#1a1a2e',
    },
  },
}
