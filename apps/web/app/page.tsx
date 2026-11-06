function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <g fill="currentColor">
          <circle cx="20" cy="20" r="4" />
          <circle cx="32" cy="20" r="4" />
          <circle cx="44" cy="20" r="4" />
          <circle cx="20" cy="32" r="4" />
          <circle cx="44" cy="32" r="4" />
          <circle cx="20" cy="44" r="4" />
          <circle cx="32" cy="44" r="4" />
          <circle cx="44" cy="44" r="4" />
        </g>
        <circle cx="32" cy="32" r="5" fill="#c8633f" />
      </svg>
    </span>
  );
}

const categories = [
  {
    title: 'Beauty & wellness',
    detail: 'Salons, barbers, and spas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"
          strokeLinejoin="round"
        />
        <path d="M18.5 16.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
      </svg>
    ),
  },
  {
    title: 'Movement & mindfulness',
    detail: 'Pilates, yoga, and studios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 12h4l2.5-6 4 12 2.5-6H21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Sport & play',
    detail: 'Padel, tennis, and courts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="8" />
        <path d="M6.5 6.5c3 1 5 3 6.5 6.5 1 2.4 2.4 4 4.5 4.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const plans = [
  {
    number: '01',
    title: 'Discover what’s nearby',
    description:
      'Browse trusted salons, studios, and courts by category, neighbourhood, and availability.',
  },
  {
    number: '02',
    title: 'Reserve without the back-and-forth',
    description: 'See services and open time slots, then confirm a booking in a few simple steps.',
  },
  {
    number: '03',
    title: 'Help local businesses thrive',
    description:
      'Give owners a clear view of their schedule and the tools to welcome more customers.',
  },
];

const completedItems = [
  ['Monorepo foundation', 'npm workspaces, shared formatting, and root scripts'],
  ['NestJS API', 'Typed configuration and a verified health endpoint'],
  ['Next.js web experience', 'Responsive, accessible, and ready to grow'],
  ['PostgreSQL environment', 'Pinned Docker image with a persistent volume'],
];

const plannedItems = [
  ['Data model', 'Prisma schema, migrations, and seed data'],
  ['Accounts & listings', 'Business profiles, services, and availability'],
  ['Reservations', 'Customer booking flow and owner dashboard'],
];

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="page-shell">
        <header className="site-header">
          <a className="brand" href="#main" aria-label="Al9ani home">
            <BrandMark />
            <span className="brand-word">
              <span className="brand-latin">al9ani</span>
              <span className="brand-arabic" lang="ar">
                القاني
              </span>
            </span>
          </a>

          <div className="header-status">
            <span className="status-dot" aria-hidden="true" />
            <span>Phase 1 · Foundation</span>
          </div>
        </header>

        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="eyebrow-line" aria-hidden="true" />
                Booking, made local
              </p>

              <h1 id="hero-title">
                Your next <span className="accent">good</span> appointment starts here.
              </h1>

              <p className="hero-arabic" lang="ar" dir="rtl">
                اكتشف. احجز. استمتع.
              </p>

              <p className="hero-description">
                Al9ani is building one simple place to discover and reserve Tunisia’s best local
                experiences — from a fresh haircut and a Pilates class to a padel court with
                friends.
              </p>

              <div className="hero-actions">
                <a className="button button-primary" href="#status">
                  See project status
                </a>
                <a className="button button-secondary" href="#categories">
                  Explore categories
                </a>
              </div>

              <ul className="hero-meta" aria-label="Project highlights">
                <li>Made in Tunisia</li>
                <li>In development</li>
                <li>Beauty, wellness & sport</li>
              </ul>
            </div>

            <aside className="preview-card" aria-labelledby="preview-title">
              <div className="preview-top">
                <span className="preview-label" id="preview-title">
                  What you will find
                </span>
                <span className="preview-badge">Preview</span>
              </div>

              <div className="category-list" id="categories">
                {categories.map((category) => (
                  <div className="category-row" key={category.title}>
                    <span className="category-icon" aria-hidden="true">
                      {category.icon}
                    </span>
                    <span className="category-text">
                      <strong>{category.title}</strong>
                      <small>{category.detail}</small>
                    </span>
                  </div>
                ))}
              </div>

              <p className="preview-note">
                Categories illustrate the product direction. Booking is not available during Phase
                1.
              </p>
            </aside>
          </section>

          <section className="section" aria-labelledby="plan-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  <span className="eyebrow-line" aria-hidden="true" />
                  The plan
                </p>
                <h2 id="plan-title">A calmer way to book local.</h2>
              </div>
              <p className="section-intro">
                Al9ani is designed around the way people actually plan their week — and around the
                local businesses that make it happen.
              </p>
            </div>

            <div className="plan-grid">
              {plans.map((plan) => (
                <article className="plan-card" key={plan.number}>
                  <span className="plan-number">{plan.number}</span>
                  <h3>{plan.title}</h3>
                  <p>{plan.description}</p>
                </article>
              ))}
            </div>

            <p className="section-note">
              These are product goals for upcoming phases, not live features yet.
            </p>
          </section>

          <section className="status-section" id="status" aria-labelledby="status-title">
            <div className="status-top">
              <p className="eyebrow eyebrow-light">
                <span className="eyebrow-line" aria-hidden="true" />
                Development status
              </p>
              <span className="live-status">
                <span className="live-dot" aria-hidden="true" />
                In development
              </span>
            </div>

            <div className="status-grid">
              <div className="status-copy">
                <h2 id="status-title">Phase 1 — Foundation</h2>
                <p>
                  We are laying the technical groundwork: a shared API, a responsive web experience,
                  and a reproducible local database.
                </p>
                <p className="status-disclaimer">
                  This is a development preview. No accounts, listings, or reservations can be
                  created yet.
                </p>
                <p className="status-date">Last updated · November 2026</p>
              </div>

              <div className="status-lists">
                <div>
                  <h3 className="list-heading">Completed</h3>
                  <ul className="checklist">
                    {completedItems.map(([title, detail]) => (
                      <li className="checklist-item" key={title}>
                        <span className="check-icon" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              d="M20 6 9 17l-5-5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="list-heading list-heading-muted">Next up</h3>
                  <ul className="checklist checklist-planned">
                    {plannedItems.map(([title, detail]) => (
                      <li className="checklist-item" key={title}>
                        <span className="check-icon check-icon-planned" aria-hidden="true">
                          <span />
                        </span>
                        <span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-brand">
            <BrandMark />
            <span>
              <strong>al9ani</strong>
              <small>القاني</small>
            </span>
          </div>
          <p>Built with care in Tunisia. © 2026 Al9ani.</p>
          <p className="footer-note">Development preview · API v0.1.0</p>
        </footer>
      </div>
    </>
  );
}
