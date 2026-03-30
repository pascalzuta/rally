export default function Footer() {
  return (
    <footer className="sh-footer">
      <div className="sh-footer-inner">
        <div className="sh-footer-top">
          <div className="sh-footer-brand">
            <img height="28" src="/rally-logo.svg" alt="Rally" />
            <span className="sh-footer-tagline">Play tennis. Skip the texting.</span>
          </div>
          <div className="sh-footer-columns">
            <div className="sh-footer-col">
              <h4 className="sh-footer-col-title">Product</h4>
              <a href="/#how-it-works">How It Works</a>
              <a href="/#features">Features</a>
            </div>
            <div className="sh-footer-col">
              <h4 className="sh-footer-col-title">Community</h4>
              <a href="/blog/">The Baseline Blog</a>
              <a href="https://www.instagram.com/playrally_us/" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://www.facebook.com/people/Rally-Tournaments/61577494419031/" target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
            <div className="sh-footer-col">
              <h4 className="sh-footer-col-title">Support</h4>
              <a href="/support/">Help Center</a>
              <a href="mailto:hello@play-rally.com">Contact Us</a>
            </div>
            <div className="sh-footer-col">
              <h4 className="sh-footer-col-title">Legal</h4>
              <a href="/support/">Privacy Policy</a>
              <a href="/support/">Terms of Service</a>
            </div>
          </div>
        </div>
        <div className="sh-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Rally Tennis. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
