import { Link } from 'react-router-dom'
import DepotNav from '../components/DepotNav'
import './SplashPage.css'

// The thread runs through four phases; each phase is a station on it, evenly spaced.
const COLUMNS = [300, 450, 600, 750]
const PHASES = ['Pursuit', 'Award', 'Execution', 'Closeout']
const CHIP_W = 138
const LANE_H = 40
const LANE_GAP = 14
const LANES_Y = 100

// One lane per role: the stretch of the project's life where that role is most active (the soft
// bar), and the apps that role reaches for at each phase (`at` = the phase index).
const ROLES = [
  {
    name: 'Business Development',
    span: [0, 1],
    apps: [
      { at: 0, label: 'WinMax' },
      { at: 1, label: 'Scope Manager' },
    ],
  },
  {
    name: 'Program Manager',
    span: [1, 3],
    apps: [
      { at: 1, label: 'Good Plan' },
      { at: 2, label: 'Value Stream' },
    ],
  },
  {
    name: 'Functional Manager',
    span: [1, 2],
    apps: [
      { at: 1, label: 'Org Charts' },
      { at: 2, label: 'Labor Supply & Demand' },
    ],
  },
  {
    name: 'Mission Assurance',
    span: [2, 3],
    apps: [
      { at: 2, label: 'The Fixer' },
      { at: 3, label: 'Lessons Learned' },
    ],
  },
]
const laneY = (i: number) => LANES_Y + i * (LANE_H + LANE_GAP)
const SVG_H = laneY(ROLES.length - 1) + LANE_H + 20

const FEATURES = [
  {
    title: 'A digital thread',
    body: "A single id per project. Every app's records are scoped to that one id so people and agents can't wander into another project's data.",
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
    body: 'Browse a catalog of applications. The project installs the applications its work needs. Users pin their favorites.',
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
    body: 'A personal launchpad, customized for each user. A project launchpad, for its connected apps and data.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="M8 8l4-4 4 4" />
        <rect x="6" y="17" width="12" height="3.5" rx="1" />
      </svg>
    ),
  },
  {
    title: 'AI assistant',
    body: "A top-level AI that reads every connected app's data and journal, over MCP — so you can understand what changed and why, and take meaningful next steps.",
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
            <h1 className="splash-hero__title">One thread. Every role.</h1>
            <p className="splash-hero__sub">
              Every project gets one ID that never changes. Select and launch the tools that fit
              your job — and swap them as the work evolves.
            </p>
            <div className="splash-hero__actions">
              <Link className="splash-btn splash-btn--primary" to="/admin">
                Create a project
              </Link>
              <Link className="splash-btn splash-btn--ghost" to="/catalog">
                Browse the app store
              </Link>
            </div>
          </header>

          <figure className="splash-figure">
            <div className="splash-figure__svg-wrap">
              <svg viewBox={`0 0 870 ${SVG_H}`} role="img" aria-labelledby="depot-diagram-title">
                <title id="depot-diagram-title">
                  One project ID runs through pursuit, award, execution and closeout. Business
                  development, program managers, functional managers and mission assurance each
                  launch the apps that fit their job, in the phases where they are most active.
                </title>

                {/* the project id, at the thread's origin */}
                <text className="splash-svg__origin" x="20" y="24">
                  PROJECT ID
                </text>
                <rect x="14" y="66" width="92" height="22" rx="6" fill="var(--color-accent-soft)" />
                <text className="splash-svg__id" x="60" y="81" textAnchor="middle">
                  P-100455
                </text>

                <g className="splash-svg__phase" textAnchor="middle">
                  {PHASES.map((phase, i) => (
                    <text key={phase} x={COLUMNS[i]} y="24">
                      {phase.toUpperCase()}
                    </text>
                  ))}
                </g>

                {/* each role's active stretch — drawn first so everything else sits on it */}
                {ROLES.map((r, i) => (
                  <rect
                    key={`bar-${r.name}`}
                    x={COLUMNS[r.span[0]] - CHIP_W / 2 - 8}
                    y={laneY(i)}
                    width={COLUMNS[r.span[1]] - COLUMNS[r.span[0]] + CHIP_W + 16}
                    height={LANE_H}
                    rx="12"
                    fill="var(--color-surface-sunken)"
                    stroke="var(--color-border)"
                  />
                ))}

                {/* the thread's stations drop through every lane */}
                {COLUMNS.map((x, i) => (
                  <line
                    key={`guide-${PHASES[i]}`}
                    x1={x}
                    y1="60"
                    x2={x}
                    y2={SVG_H - 12}
                    stroke="var(--color-accent)"
                    strokeWidth="1.2"
                    strokeDasharray="3 5"
                    strokeOpacity="0.4"
                  />
                ))}

                {/* the digital thread */}
                <line x1="20" y1="52" x2="840" y2="52" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
                <path d="M840 46 L854 52 L840 58 Z" fill="var(--color-accent)" />
                <circle cx="20" cy="52" r="5.5" fill="var(--color-accent)" />
                {COLUMNS.map((x, i) => (
                  <g key={`node-${PHASES[i]}`}>
                    <circle cx={x} cy="52" r="6" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2.5" />
                    <circle cx={x} cy="52" r="2.4" fill="var(--color-accent)" />
                  </g>
                ))}

                {/* role names, then the apps each one uses */}
                {ROLES.map((r, i) => (
                  <g key={r.name}>
                    <text className="splash-svg__role" x="24" y={laneY(i) + LANE_H / 2 + 4}>
                      {r.name}
                    </text>
                    {r.apps.map((app) => (
                      <g key={app.label}>
                        <rect
                          x={COLUMNS[app.at] - CHIP_W / 2}
                          y={laneY(i) + 6}
                          width={CHIP_W}
                          height={LANE_H - 12}
                          rx="8"
                          fill="var(--color-surface)"
                          stroke="var(--color-border-strong)"
                        />
                        <text className="splash-svg__chip" x={COLUMNS[app.at]} y={laneY(i) + LANE_H / 2 + 4} textAnchor="middle">
                          {app.label}
                        </text>
                      </g>
                    ))}
                  </g>
                ))}
              </svg>
            </div>
          </figure>

          <section className="splash-features">
            {FEATURES.map((f) => (
              <article className="splash-feature" key={f.title}>
                <div className="splash-feature__head">
                  <span className="splash-feature__icon">{f.icon}</span>
                  <h3 className="splash-feature__title">{f.title}</h3>
                </div>
                <p className="splash-feature__body">{f.body}</p>
              </article>
            ))}
          </section>

          <section className="splash-why">
            <span className="splash-eyebrow">Conway's Law</span>
            <blockquote className="splash-why__quote">
              Organizations which design systems are constrained to produce designs which are
              copies of the communication structures of these organizations.
              <cite className="splash-why__cite">
                {' '}— Melvin E. Conway · <em>How Do Committees Invent?</em> · 1968
              </cite>
            </blockquote>
            <div className="splash-theory">
              <p className="splash-theory__body">
                Conway's Depot is built to let systems, apps, and communication thrive across
                the organization — even as it changes.
              </p>
              <Link className="splash-btn splash-btn--ghost" to="/theory-of-operations">
                Theory of Operations →
              </Link>
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
