export default function TermsOfService() {
  return (
    <div className="jm-view" style={{ maxWidth: '720px', paddingBottom: '48px' }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>Legal</p>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>Terms of Service</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--c-text-2)' }}>Last updated: April 2026</p>
      </div>

      <Section title="Acceptance of terms">
        By creating a TradeEdge account and using the platform, you agree to these Terms of Service. If you do not agree, please do not use TradeEdge.
      </Section>

      <Section title="What TradeEdge is">
        TradeEdge is a trading journal and analytics tool. It is designed to help traders log, review, and understand their own trading activity. TradeEdge is not a brokerage, investment advisor, or financial services company.
      </Section>

      <Section title="Not financial advice">
        <b>Nothing in TradeEdge constitutes financial or investment advice.</b> All analysis, AI-generated insights, statistics, and suggestions provided by TradeEdge are for informational and educational purposes only. They are based solely on the trade data you enter. Always make your own independent decisions and consult a qualified financial professional before making trading decisions.
        <br /><br />
        Trading financial instruments carries significant risk, including the risk of losing more than your initial investment. TradeEdge is not responsible for any trading losses you incur.
      </Section>

      <Section title="Your account">
        You are responsible for keeping your account credentials secure. You must not share your account with others or allow unauthorised access. You must be at least 18 years old to create an account. You agree to provide accurate information when registering.
      </Section>

      <Section title="Your data">
        You own your trade data. TradeEdge does not claim any ownership over content you create. You grant TradeEdge a limited licence to store and process your data solely for the purpose of providing the service. You can export or delete your data at any time.
      </Section>

      <Section title="Acceptable use">
        You agree not to:
        <ul style={{ margin: '8px 0 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>Use TradeEdge for any unlawful purpose</li>
          <li>Attempt to access other users' data or accounts</li>
          <li>Reverse engineer, copy, or redistribute the TradeEdge platform</li>
          <li>Upload malicious content or attempt to disrupt the service</li>
          <li>Misrepresent your trading performance on public profiles to deceive other users</li>
        </ul>
      </Section>

      <Section title="Subscriptions and billing">
        TradeEdge offers a free tier and a paid <b>TradeEdge Pro</b> subscription. The current price is <b>$19 USD per month</b>, billed monthly, with a <b>7-day free trial</b> for new subscribers. A <b>Backtesting</b> add-on is planned for the future and is not currently billable.
        <br /><br />
        <b>How the free trial works:</b>
        <ul style={{ margin: '8px 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>You enter your card at the start of the trial, but you are not charged for the first 7 days.</li>
          <li>Your card is automatically charged on day 8 unless you cancel beforehand.</li>
          <li>You can cancel during the trial via Settings → Manage subscription, with no charge.</li>
        </ul>
        <b>How billing works after the trial:</b>
        <ul style={{ margin: '8px 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>Subscriptions are recurring and renew automatically each month until you cancel.</li>
          <li>Your card is charged at the start of each billing period.</li>
          <li>Payments are processed by Stripe. TradeEdge does not store your card details.</li>
          <li>All prices are shown in USD on the checkout page. Your bank may convert this to your local currency at their exchange rate.</li>
        </ul>
        <b>Cancellation:</b>
        <ul style={{ margin: '8px 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>You can cancel any time via <em>Settings → Subscription → Manage subscription</em>, which opens Stripe's secure billing portal.</li>
          <li>When you cancel, your Pro access continues until the end of the current paid billing period — you keep what you paid for.</li>
          <li>After the period ends, your account automatically reverts to the free tier. Your data is preserved.</li>
        </ul>
        <b>Refunds:</b> we don't issue refunds for partial billing periods or unused time. If you believe you've been charged in error, email <a href="mailto:support@tradeedge.io" style={{ color: 'var(--c-accent)' }}>support@tradeedge.io</a> and we'll review on a case-by-case basis.
        <br /><br />
        <b>Failed payments:</b> if a renewal payment fails, we'll retry it a few times over the following days. If it still fails, your subscription will be canceled and your account reverts to the free tier. You can resubscribe at any time.
        <br /><br />
        <b>Price changes:</b> we may change subscription prices in the future. Existing subscribers will be notified by email at least 30 days before any price change takes effect, and you can cancel before the new price applies.
      </Section>

      <Section title="Availability and changes">
        We aim to keep TradeEdge available at all times but cannot guarantee uninterrupted service. We may update, change, or discontinue features with reasonable notice. We will not delete your data without giving you the opportunity to export it first.
      </Section>

      <Section title="Limitation of liability">
        TradeEdge is provided "as is" without warranties of any kind. To the maximum extent permitted by law, TradeEdge and its team are not liable for any indirect, incidental, or consequential damages arising from your use of the platform, including any trading losses.
      </Section>

      <Section title="Governing law">
        These terms are governed by the laws of Denmark. Any disputes will be resolved in the courts of Denmark.
      </Section>

      <Section title="Changes to these terms">
        We may update these terms from time to time. We will notify you of significant changes in the app. Continued use after changes constitutes acceptance.
      </Section>

      <Section title="Contact">
        Questions about these terms? Email <a href="mailto:support@tradeedge.io" style={{ color: 'var(--c-accent)' }}>support@tradeedge.io</a>.
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.2px' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--c-text-2)', lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}
