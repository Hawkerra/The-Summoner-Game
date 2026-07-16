/**
 * Material UI Theme Configuration
 * Memoria visual language: ruin-tech, pale light, and weathered metal.
 */

import { createTheme } from '@mui/material/styles';
import { warning } from 'framer-motion';

// Shared palette for all screen classes.
export const colors = {
  primary: {
    main: '#b066ff',
    light: '#a259f7',
    dark: '#9440e8',
    darker: '#7a2ecc',
    pale: '#e3ccff',
    veryPale: '#f5edff',
    contrastText: '#1a0533',
  },
  secondary: {
    main: '#e8c368',
    light: '#f5dc9a',
    dark: '#c9a04a',
  },
  accent: {
    warning: '#ffaa00',
    danger: '#ff6b6b',
    neutral: '#d0d0d0',
  },
  background: {
    default: '#140a20',
    paper: 'rgba(20, 12, 30, 0.95)',
    overlay: 'rgba(18, 8, 32, 0.9)',
    glass: 'rgba(0, 0, 0, 0.8)',
    glassDarker: 'rgba(0, 0, 0, 0.85)',
  },
  text: {
    primary: '#f3eaff',
    secondary: '#ecdfff',
    pale: '#f4ecff',
    muted: 'rgba(255, 255, 255, 0.9)',
    veryMuted: 'rgba(255, 255, 255, 0.6)',
    warning: '#ffb347',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary.main,
      light: colors.primary.light,
      dark: colors.primary.dark,
      contrastText: colors.primary.contrastText,
    },
    secondary: {
      main: colors.secondary.main,
      light: colors.secondary.light,
      dark: colors.secondary.dark,
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.veryMuted,
    },
    divider: 'rgba(176, 102, 255, 0.12)',
    error: {
      main: colors.accent.danger,
    },
    warning: {
      main: colors.accent.warning,
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 900,
      letterSpacing: '0.05em',
      color: colors.primary.main,
      textShadow: '0 0 20px rgba(176, 102, 255, 0.5)',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '0.04em',
      color: colors.primary.main,
    },
    h3: {
      fontWeight: 800,
      letterSpacing: '0.03em',
      color: colors.primary.main,
    },
    h4: {
      fontWeight: 700,
      color: colors.primary.main,
      textShadow: '0 0 10px rgba(176, 102, 255, 0.5)',
    },
    h5: {
      fontWeight: 700,
      color: colors.primary.main,
    },
    h6: {
      fontWeight: 700,
      color: colors.primary.main,
    },
    button: {
      fontWeight: 800,
      textTransform: 'none',
      letterSpacing: '0.02em',
    },
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0, 0, 0, 0.24)',
    '0 2px 4px rgba(0, 0, 0, 0.3)',
    '0 4px 8px rgba(0, 0, 0, 0.35)',
    '0 6px 12px rgba(0, 0, 0, 0.4)',
    '0 8px 16px rgba(0, 0, 0, 0.45)',
    '0 10px 20px rgba(0, 0, 0, 0.5)',
    '0 12px 24px rgba(0, 0, 0, 0.52)',
    '0 14px 28px rgba(0, 0, 0, 0.54)',
    '0 16px 32px rgba(0, 0, 0, 0.56)',
    '0 18px 36px rgba(0, 0, 0, 0.58)',
    '0 20px 40px rgba(0, 0, 0, 0.6)',
    '0 22px 44px rgba(0, 0, 0, 0.62)',
    '0 24px 48px rgba(0, 0, 0, 0.64)',
    '0 26px 52px rgba(0, 0, 0, 0.66)',
    '0 28px 56px rgba(0, 0, 0, 0.68)',
    '0 30px 60px rgba(0, 0, 0, 0.7)',
    '0 32px 64px rgba(0, 0, 0, 0.72)',
    '0 34px 68px rgba(0, 0, 0, 0.74)',
    '0 36px 72px rgba(0, 0, 0, 0.76)',
    '0 38px 76px rgba(0, 0, 0, 0.78)',
    '0 40px 80px rgba(0, 0, 0, 0.8)',
    '0 42px 84px rgba(0, 0, 0, 0.82)',
    '0 44px 88px rgba(0, 0, 0, 0.84)',
    '0 46px 92px rgba(0, 0, 0, 0.86)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'dark',
        },
        '*, *::before, *::after': {
          boxSizing: 'border-box',
        },
        html: {
          margin: 0,
          padding: 0,
        },
        body: {
          margin: 0,
          padding: 0,
          color: colors.text.primary,
          background: 'linear-gradient(45deg, #140a20 0%, #002244 100%)',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '#root': {
          margin: 0,
          padding: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          border: '2px solid rgba(176, 102, 255, 0.12)',
          color: colors.text.primary,
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(176, 102, 255, 0.15) 0%, rgba(0, 200, 100, 0.08) 100%)',
          border: `2px solid ${colors.primary.main}`,
          borderRadius: 16,
          color: colors.text.primary,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 16px',
          transition: 'all 0.2s ease',
          '&.Mui-disabled': {
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'rgba(176, 102, 255, 0.4)',
          },
        },
        containedPrimary: {
          background: colors.primary.main,
          color: colors.primary.contrastText,
          border: '2px solid rgba(176, 102, 255, 0.15)',
          '&:hover': {
            background: colors.primary.light,
          },
        },
        outlinedPrimary: {
          border: `2px solid ${colors.primary.main}`,
          color: colors.primary.main,
          '&:hover': {
            background: 'rgba(176, 102, 255, 0.2)',
            borderColor: colors.primary.light,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01))',
          color: colors.text.pale,
          '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'rgba(176, 102, 255, 0.3)',
          },
          '&.Mui-disabled fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
        input: {
          '&::placeholder': {
            color: 'rgba(255, 255, 255, 0.5)',
            opacity: 1,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: colors.primary.main,
          boxShadow: '0 0 10px rgba(176, 102, 255, 0.5)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: 'rgba(255, 255, 255, 0.8)',
          '&.Mui-selected': {
            color: colors.primary.main,
            textShadow: '0 0 8px rgba(176, 102, 255, 0.4)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          color: colors.primary.pale,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: 16,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 8,
          overflow: 'hidden',
        },
        bar: {
          backgroundColor: colors.primary.main,
          boxShadow: '0 0 8px rgba(176, 102, 255, 0.5)',
        },
      },
    },
  },
});

export default theme;