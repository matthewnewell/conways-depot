import { Link } from 'react-router-dom'
import DepotNav from '../components/DepotNav'
import './SplashPage.css'

// Four phase "stations" on the thread, each aligned above the app typically reached there.
// Evenly spaced (198 apart), with equal 32px padding to the app-store frame edges.
const COLUMNS = [138, 336, 534, 732]
const PHASES = ['Pursuit', 'Award', 'Execution', 'Closeout']
const APPS = ['Capture', 'Contracts', 'Value stream', 'Lessons learned']

const FEATURES = [
  {
    title: 'One digital thread',
    body: "A single id per project, issued at pursuit and never reissued. It scopes who sees what and keeps every app's records tied to the right work.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="19" cy="12" r="2.4" />
        <path d="M7.6 12h8.8" />
      </svg>
    ),
  },
  {
    title: 'An app store',
    body: 'Browse what the org builds, plans, or buys. The project installs the applications its work needs — a link is a pointer, never a live integration.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    title: 'A launchpad',
    body: "The project's home page opens into its installed apps — one place to pick up the work instead of a scatter of tools and tabs.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="M8 8l4-4 4 4" />
        <rect x="6" y="17" width="12" height="3.5" rx="1" />
      </svg>
    ),
  },
  {
    title: 'A project assistant',
    body: 'A top-level assistant that works across the apps a project subscribes to, over MCP — ask about the data instead of opening each app.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z" />
        <path d="M18 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
      </svg>
    ),
  },
]

/** The nav brand links here — the "what this is and why" page. Hero + one readable diagram of
 * the core idea (a project runs one thread and connects to apps from the store), a short
 * feature triad, and the Conway's Law grounding. */
export default function SplashPage() {
  return (
    <div className="splash-page">
      <DepotNav />

      <div className="splash-page__scroll">
        <div className="splash-container">
          <header className="splash-hero">
            <h1 className="splash-hero__title">An app store for projects</h1>
            <p className="splash-hero__sub">
              Conway's Depot gives every project one persistent identity — its digital thread —
              from pursuit through closeout. From there it works like an app store: the project
              installs the applications its work needs and runs them from a single launchpad.
            </p>
            <div className="splash-hero__actions">
              <Link className="splash-btn splash-btn--primary" to="/admin">
                Create a project
              </Link>
              <Link className="splash-btn splash-btn--ghost" to="/applications">
                Browse the app store
              </Link>
            </div>
          </header>

          <figure className="splash-figure">
            <div className="splash-figure__svg-wrap">
            <svg viewBox="0 0 870 262" role="img" aria-labelledby="depot-diagram-title">
              <title id="depot-diagram-title">
                A project runs one digital thread through pursuit, award, execution and
                closeout, connecting to applications from the store as the work needs them.
              </title>

              {/* thread origin + phase labels */}
              <text className="splash-svg__origin" x="20" y="22">
                PROJECT
              </text>
              <g className="splash-svg__phase" textAnchor="middle">
                {PHASES.map((phase, i) => (
                  <text key={phase} x={COLUMNS[i]} y="22">
                    {phase.toUpperCase()}
                  </text>
                ))}
              </g>

              {/* the app store — drawn first so the connectors below read as coming out of
                  each app card, not out of the frame's edge */}
              <text className="splash-svg__store-label" x="24" y="126">
                APP STORE
              </text>
              <rect
                x="24"
                y="134"
                width="822"
                height="108"
                rx="16"
                fill="var(--color-surface-sunken)"
                stroke="var(--color-border)"
              />
              {COLUMNS.map((x, i) => (
                <g key={`card-${APPS[i]}`}>
                  <rect
                    x={x - 82}
                    y="158"
                    width="164"
                    height="52"
                    rx="10"
                    fill="var(--color-surface)"
                    stroke="var(--color-border-strong)"
                  />
                  <text className="splash-svg__app" x={x} y="189" textAnchor="middle">
                    {APPS[i]}
                  </text>
                </g>
              ))}

              {/* the digital thread */}
              <line
                x1="20"
                y1="48"
                x2="840"
                y2="48"
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path d="M840 42 L854 48 L840 54 Z" fill="var(--color-accent)" />
              <circle cx="20" cy="48" r="5.5" fill="var(--color-accent)" />

              {/* each app plugs UP into the thread — the line starts at the app card's top edge
                  and the arrow points into the project */}
              {COLUMNS.map((x, i) => (
                <g key={APPS[i]}>
                  <line
                    x1={x}
                    y1="158"
                    x2={x}
                    y2="62"
                    stroke="var(--color-accent)"
                    strokeWidth="1.5"
                    strokeOpacity="0.55"
                  />
                  <path
                    d={`M${x - 4} 63 L${x + 4} 63 L${x} 55 Z`}
                    fill="var(--color-accent)"
                  />
                  <circle
                    cx={x}
                    cy="48"
                    r="6"
                    fill="var(--color-surface)"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                  />
                  <circle cx={x} cy="48" r="2.4" fill="var(--color-accent)" />
                </g>
              ))}
            </svg>
            </div>
            <figcaption className="splash-figure__caption">
              The project picks which apps plug into its thread. The id stays the same the whole
              way through — and keeps every record attributed.
            </figcaption>
          </figure>

          <section className="splash-features">
            {FEATURES.map((f) => (
              <article className="splash-feature" key={f.title}>
                <span className="splash-feature__icon">{f.icon}</span>
                <h3 className="splash-feature__title">{f.title}</h3>
                <p className="splash-feature__body">{f.body}</p>
              </article>
            ))}
          </section>

          <section className="splash-why">
            <span className="splash-eyebrow">Conway's Law</span>
            <blockquote className="splash-why__quote">
              Organizations which design systems are constrained to produce designs which are
              copies of the communication structures of these organizations.
            </blockquote>
            <p className="splash-why__cite">
              Melvin E. Conway · <em>How Do Committees Invent?</em> · 1968
            </p>
            <div className="splash-why__prose">
              <p>
                Every system an organization builds — including its operational software —
                mirrors how its teams communicate. When BD, Contracts, and Execution work across
                organizational seams, their tools become siloed, and that's where cost, delay,
                and rework collect.
              </p>
              <p>
                The seam doesn't close on its own — but the groups on either side can share one
                reference. That's what Conway's Depot is: a project's id, and a live map of which
                app holds which piece — the way an app store lets independent developers ship to
                one phone without ever coordinating. Teams with different roadmaps and
                vocabularies still line up around the same project, and nobody has to reorganize
                to make it happen.
              </p>
            </div>
          </section>

          <section className="splash-cta-band">
            <div>
              <h2 className="splash-cta-band__title">Every project starts with an id.</h2>
              <p className="splash-cta-band__sub">Register one, then install the apps it needs.</p>
            </div>
            <Link className="splash-btn splash-btn--primary" to="/admin">
              Create a project →
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
