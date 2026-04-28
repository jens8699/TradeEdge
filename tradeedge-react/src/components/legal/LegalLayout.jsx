import '../landing/landing.css';
import PrivacyPolicy from '../views/PrivacyPolicy';
import TermsOfService from '../views/TermsOfService';

/**
 * Standalone wrapper for showing PrivacyPolicy / TermsOfService outside the
 * authenticated app shell — e.g. when reached from the marketing footer.
 *
 * The legal views use `--c-text`, `--c-text-2`, `--c-accent` (app-shell tokens).
 * We map those to the landing tokens here so the views read cleanly on the
 * cream landing background without restyling them.
 */
export default function LegalLayout({ page, onBack }) {
  return (
    <div
      className="lp-root"
      style={{
        '--c-text':   'var(--lp-text)',
        '--c-text-2': 'var(--lp-text2)',
        '--c-accent': 'var(--lp-accent)',
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        color: 'var(--lp-text)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top nav — same backdrop blur as landing nav */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-row">
          <button
            type="button"
            onClick={onBack}
            className="lp-btn lp-btn-ghost"
            style={{ paddingLeft: 0 }}
          >
            ← Back
          </button>
          <div className="lp-wordmark" style={{ flex: 1, textAlign: 'center' }}>
            tradeedge<span className="lp-dot">.</span>
          </div>
          {/* spacer to balance back button */}
          <div style={{ width: '64px' }} />
        </div>
      </nav>

      <div
        className="lp-container"
        style={{ maxWidth: '760px', padding: '64px 32px 96px' }}
      >
        {page === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
      </div>

      <footer className="lp-footer" style={{ padding: '32px 0' }}>
        <div className="lp-container">
          <div className="lp-footer-legal" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <span>© 2026 TradeEdge, Inc.</span>
            <span>Trading involves risk. Past performance does not guarantee future results.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
