export default function PrivacyPolicy() {
  return (
    <div className="jm-view" style={{ maxWidth: '720px', paddingBottom: '48px' }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>Legal</p>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>Privacy Policy</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--c-text-2)' }}>Last updated: April 2026</p>
      </div>

      <Section title="Who we are">
        TradeEdge is a trading journal and analytics platform built for day traders. We help you log your trades, understand your performance, and improve your discipline. This policy explains what data we collect, how we use it, and what rights you have.
      </Section>

      <Section title="What data we collect">
        <b>Account data:</b> When you create an account we collect your name and email address. This is used to identify your account and send you password reset emails if you request one.
        <br /><br />
        <b>Trade data:</b> All trades, notes, screenshots, and stats you enter into TradeEdge are stored securely in our database. This data belongs to you.
        <br /><br />
        <b>Profile data:</b> Optional information you choose to add to your public profile, such as a bio and display name.
        <br /><br />
        <b>Usage data:</b> We may log basic usage information (such as which features are used) to help us improve the product. We do not track individual page views or sell this data.
      </Section>

      <Section title="How we use your data">
        We use your data solely to provide the TradeEdge service. Specifically:
        <ul style={{ margin: '8px 0 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>To store and display your trades and statistics</li>
          <li>To generate AI-powered insights from your trading history</li>
          <li>To show your public profile to other TradeEdge users (only if you enable this)</li>
          <li>To send transactional emails (e.g. password resets) — no marketing emails without consent</li>
        </ul>
        <br />
        <b>We do not sell your data. We do not share your data with advertisers.</b>
      </Section>

      <Section title="Data storage and security">
        Your data is stored using Supabase (a secure, SOC 2 compliant database platform) with row-level security — meaning your data is only accessible to your account. Trade screenshots are stored in encrypted object storage. All connections use HTTPS/TLS encryption.
      </Section>

      <Section title="Public profiles">
        If you enable the public profile feature, your display name, bio, and optionally your trade statistics will be visible to other TradeEdge users. You can turn this off at any time in Settings → Public Profile. Your individual trade notes and full history are never public.
      </Section>

      <Section title="Data retention and deletion">
        Your data is retained as long as your account is active. You can export all your data at any time from Settings → Export. To request full account deletion, contact us at <a href="mailto:support@tradeedge.today" style={{ color: 'var(--c-accent)' }}>support@tradeedge.today</a> and we will delete your account and all associated data within 30 days.
      </Section>

      <Section title="Third-party services">
        TradeEdge uses the following third-party services to deliver the product:
        <ul style={{ margin: '8px 0 0', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li><b>Supabase</b> — database and authentication</li>
          <li><b>Cloudflare Pages</b> — hosting and edge functions</li>
          <li><b>Anthropic (Claude)</b> — AI-powered market brief and insights (trade data may be sent to generate insights; Anthropic does not store or train on this data)</li>
          <li><b>ElevenLabs</b> — text-to-speech for the voice readout feature (text sent for synthesis is not stored)</li>
        </ul>
      </Section>

      <Section title="Your rights">
        You have the right to access, export, correct, or delete your personal data at any time. You can do most of this directly in the app (Settings → Export / Delete). For any requests, contact <a href="mailto:support@tradeedge.today" style={{ color: 'var(--c-accent)' }}>support@tradeedge.today</a>.
      </Section>

      <Section title="Changes to this policy">
        If we make significant changes to this policy, we will notify you in the app. Continued use of TradeEdge after changes constitutes acceptance of the updated policy.
      </Section>

      <Section title="Contact">
        Questions? Email us at <a href="mailto:support@tradeedge.today" style={{ color: 'var(--c-accent)' }}>support@tradeedge.today</a>.
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
