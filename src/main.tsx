import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App'
import './index.scss'
import theme from './screens/Theme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // You can uncomment these if you want to follow the
  //    'always render twice in dev mode' convention,
  //     which is common enough to be worth leaving in
  //     commented-out code, but because of the nature
  //     of stages it's disabled by default here.
  // <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  // </React.StrictMode>,
)
