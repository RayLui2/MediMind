import React, { useEffect } from 'react';
import '../styles/Home.css';

const Home: React.FC = () => {
  useEffect(() => {
    // Scroll animation
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in-section').forEach(section => {
      observer.observe(section);
    });

    // Smooth scroll
    const handleSmoothScroll = (e: Event) => {
      e.preventDefault();
      const anchor = e.currentTarget as HTMLAnchorElement;
      const targetId = anchor.getAttribute('href');
      if (targetId) {
        const target = document.querySelector(targetId);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    };

    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach(anchor => {
      anchor.addEventListener('click', handleSmoothScroll);
    });

    // Cleanup
    return () => {
      document.querySelectorAll('.fade-in-section').forEach(section => {
        observer.unobserve(section);
      });
      anchors.forEach(anchor => {
        anchor.removeEventListener('click', handleSmoothScroll);
      });
    };
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="hero-content">
          <div className="hero-title">Help us Help you</div>
          <h1 className="hero-main">Meet MediMind</h1>
          
          <div className="robot-container">
            <div className="robot">
              <div className="robot-head">
                <div className="robot-antenna"></div>
                <div className="robot-eyes">
                  <div className="robot-eye"></div>
                  <div className="robot-eye"></div>
                </div>
              </div>
              <div className="robot-body">
                <div className="robot-cross"></div>
              </div>
              <div className="robot-arm robot-arm-left"></div>
              <div className="robot-arm robot-arm-right"></div>
            </div>
          </div>

          <p className="hero-subtitle">Making your personal healthcare easy</p>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section fade-in-section">
        <h2 className="section-title">Watch our <span>Agent</span> in action</h2>
        <div className="video-container">
          <div className="play-button"></div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section fade-in-section" id="about">
        <h2 className="section-title">About <span>MediMind</span></h2>
        <div className="about-content">
          <div className="about-text">
            <h3>Your AI Healthcare Companion</h3>
            <p>
              MediMind is your personal AI-powered healthcare assistant, designed to make managing your health simpler and more accessible. Get instant answers to medical questions, track your symptoms, and receive personalized health insights—all in one place.
            </p>
            <p>
              Whether you're looking for information about medications, trying to understand symptoms, or managing chronic conditions, MediMind is here to provide reliable, easy-to-understand guidance 24/7.
            </p>
            <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-gray)' }}>
              * MediMind provides information and guidance but is not a substitute for professional medical advice. Always consult with healthcare providers for medical decisions.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h4>AI Chat Support</h4>
              <p>Chat with our intelligent AI assistant about any health concern, anytime.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h4>Health Tracking</h4>
              <p>Monitor symptoms, medications, and vital signs all in one dashboard.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h4>Private & Secure</h4>
              <p>Your health data is encrypted and protected with industry-leading security.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h4>Instant Insights</h4>
              <p>Get personalized health recommendations based on your unique profile.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        {/* <div className="footer-wave">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z" />
          </svg>
        </div> */}
        <div className="footer-content">
          <div className="footer-grid">
            {/* Brand Section */}
            <div className="footer-section footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-icon">M</div>
                <span>MediMind</span>
              </div>
              <p className="footer-tagline">
                Your trusted AI healthcare companion, making personal healthcare accessible and easy.
              </p>
              <div className="footer-social">
                <div className="social-icon" aria-label="Facebook">
                {/* <a href="#" className="social-icon" aria-label="Facebook"> */}
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                {/* </a> */}
                </div>
                <div className="social-icon" aria-label="Twitter">
                {/* <a href="#" className="social-icon" aria-label="Twitter"> */}
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                {/* </a> */}
                </div>
                <div className="social-icon" aria-label="LinkedIn">
                {/* <a href="#" className="social-icon" aria-label="LinkedIn"> */}
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                {/* </a> */}
                </div>
                <div className="social-icon" aria-label="Instagram">
                {/* <a href="#" className="social-icon" aria-label="Instagram"> */}
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                  </svg>
                {/* </a> */}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-section">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-links">
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About Us</a></li>
                <li><a href="/chat">Chat</a></li>
                <li><a href="/dashboard">Dashboard</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="footer-section">
              <h4 className="footer-heading">Resources</h4>
              <ul className="footer-links">
                <li><a href="#">Help Center</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Medical Disclaimer</a></li>
              </ul>
            </div>

            {/* Newsletter */}
            <div className="footer-section">
              <h4 className="footer-heading">Stay Updated</h4>
              <p className="footer-newsletter-text">
                Get health tips and updates delivered to your inbox.
              </p>
              <div className="footer-newsletter">
                <input 
                  type="email" 
                  placeholder="Your email address"
                  className="newsletter-input"
                />
                <button className="newsletter-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom">
            <div className="footer-divider"></div>
            <div className="footer-bottom-content">
              <p className="footer-copyright">
                © {new Date().getFullYear()} MediMind. All rights reserved.
              </p>
              <div className="footer-badges">
                <span className="footer-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                  </svg>
                  HIPAA Compliant
                </span>
                <span className="footer-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  SSL Secured
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

