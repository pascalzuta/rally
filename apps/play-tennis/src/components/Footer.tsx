export default function Footer() {
  return (
    <footer className="dgh-footer">
      <div className="dgh-footer-inner">
        <div className="dgh-footer-brand">
          <img height="28" src="/rally-logo.svg" alt="Rally" />
          <span className="dgh-footer-tagline">Play tennis. Skip the texting.</span>
        </div>
        <div className="dgh-footer-links">
          <a href="/blog/">The Baseline Blog</a>
          <span className="dgh-footer-sep">&middot;</span>
          <a href="/support/">Help</a>
          <span className="dgh-footer-sep">&middot;</span>
          <a href="mailto:hello@play-rally.com">Contact Us</a>
          <span className="dgh-footer-sep">&middot;</span>
          <div className="dgh-footer-social">
            <a href="https://www.instagram.com/playrally_us/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://www.facebook.com/people/Rally-Tournaments/61577494419031/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
        </div>
        <div className="dgh-footer-copy">
          &copy; {new Date().getFullYear()} Rally Tennis
        </div>
      </div>
    </footer>
  )
}
