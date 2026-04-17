import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[TradeEdge error]', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '300px', padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--c-text)' }}>
          Something went wrong
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6, maxWidth: '360px' }}>
          {this.state.error?.message || 'An unexpected error occurred in this section.'}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            padding: '9px 20px', background: '#E8724A', color: '#fff',
            border: 'none', borderRadius: '10px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
