import { Link } from 'react-router-dom'
import DepotNav from '../components/DepotNav'
import './SplashPage.css'

const APPS = [
  { x: 120, label: 'New Business App' },
  { x: 255, label: 'Contract App' },
  { x: 390, label: 'Planning App' },
  { x: 525, label: 'Accounting App' },
  { x: 660, label: 'Lessons Learned App' },
]

/** The nav brand links here. One line on what the Depot is, plus one high-level diagram:
 * a project runs one thread from pursuit to closeout and subscribes to apps from the store. */
export default function SplashPage() {
  return (
    <div className="splash-page">
      <DepotNav />
      <div className="splash-page__toolbar">
        <h1 className="splash-page__title">An App Store for Projects</h1>
      </div>

      <div className="splash-page__content">
        <section className="splash-section">
          <p className="splash-section__lede">
            Conway's Depot establishes a project's digital thread. It's a home base for the team
            and a launchpad to the applications the project subscribes to.
          </p>
        </section>

        <section className="splash-section splash-diagram">
          <svg viewBox="0 0 780 188" role="img" aria-labelledby="depot-diagram-title">
            <title id="depot-diagram-title">
              A project runs one digital thread from pursuit through closeout and subscribes to
              apps from the store.
            </title>

            <g
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.6"
              fill="var(--color-text-secondary)"
              textAnchor="middle"
            >
              <text x="140" y="14">PURSUIT</text>
              <text x="320" y="14">AWARD</text>
              <text x="500" y="14">EXECUTION</text>
              <text x="660" y="14">CLOSEOUT</text>
            </g>

            {/* the digital thread */}
            <text
              x="36"
              y="32"
              textAnchor="start"
              fontSize="11"
              fontWeight="700"
              fill="var(--color-text)"
            >
              Project
            </text>
            <circle cx="40" cy="43" r="4.5" fill="var(--color-accent)" />
            <line
              x1="40"
              y1="43"
              x2="740"
              y2="43"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path d="M740 37 L754 43 L740 49 Z" fill="var(--color-accent)" />

            {/* the app store — the catalog the project subscribes from */}
            <rect
              x="40"
              y="92"
              width="700"
              height="62"
              rx="12"
              fill="none"
              stroke="var(--color-border-strong)"
            />
            <text
              x="48"
              y="84"
              textAnchor="start"
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="0.7"
              fill="var(--color-text-secondary)"
            >
              APP STORE
            </text>

            {/* subscribed apps connect up onto the project's thread */}
            {APPS.map(({ x, label }) => (
              <g key={label}>
                <rect
                  x={x - 64}
                  y="104"
                  width="128"
                  height="34"
                  rx="7"
                  fill="var(--color-surface-sunken)"
                  stroke="var(--color-border)"
                />
                <line
                  x1={x}
                  y1="48"
                  x2={x}
                  y2="104"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                />
                <path d={`M${x - 4} 52 L${x + 4} 52 L${x} 44 Z`} fill="var(--color-accent)" />
                <text
                  x={x}
                  y="125"
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--color-text-secondary)"
                >
                  {label}
                </text>
              </g>
            ))}

            <text
              x="390"
              y="176"
              textAnchor="middle"
              fontSize="10.5"
              fill="var(--color-text-faint)"
            >
              one thread, pursuit to closeout — subscribing to the apps it needs
            </text>
          </svg>
        </section>

        <section className="splash-section splash-cta">
          <Link className="splash-cta__link" to="/admin">
            Create a new project →
          </Link>
          <Link className="splash-cta__link" to="/applications">
            Browse the app store →
          </Link>
        </section>

        <section className="splash-section splash-section--scope splash-conway">
          <blockquote className="splash-conway__quote">
            "Organizations which design systems are constrained to produce designs which are
            copies of the communication structures of these organizations."
          </blockquote>
          <p className="splash-conway__cite">
            — Melvin E. Conway, <em>How Do Committees Invent?</em>, 1968
          </p>
        </section>

        <section className="splash-section">
          <p className="splash-section__body">
            For a system to work, the people building its parts have to agree on how the parts
            meet — so a system ends up shaped like the org that built it, roughest at the seams
            between groups that rarely talk.
          </p>
          <p className="splash-section__body">
            A project's parts live in different functions — new business, contracts, planning,
            cost, lessons learned. Conway's Depot doesn't merge them. It gives the project one id
            every function can point at, and one place showing which function holds what — a
            bridge across those seams.
          </p>
        </section>
      </div>
    </div>
  )
}
