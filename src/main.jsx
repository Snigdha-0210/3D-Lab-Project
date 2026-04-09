import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ error, info: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <div style={{color: 'white', background: 'red', padding: '20px', fontSize: '14px', zIndex: 9999, position: 'absolute', inset: 0}}>
        <h1>Runtime Error in App</h1>
        <pre style={{whiteSpace: 'pre-wrap'}}>{this.state.error && this.state.error.toString()}</pre>
        <br/>
        <pre style={{whiteSpace: 'pre-wrap'}}>{this.state.info && this.state.info.componentStack}</pre>
      </div>;
    }
    return this.props.children; 
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
