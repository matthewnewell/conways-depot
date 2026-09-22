import { Link } from 'react-router-dom'
import { useApplications, useProjects } from '../api/hooks'
import DepotNav from '../components/DepotNav'
import { withDepotOrigin } from '../lib/launch'
import { usePersona } from '../lib/persona'
import './SplashPage.css'

// The thread runs through four phases; each phase is a station on it, evenly spaced.
const COLUMNS = [300, 450, 600, 750]
const PHASES = ['Pursuit', 'Award', 'Execution', 'Closeout']
const CHIP_W = 138
const LANE_H = 40
const LANE_GAP = 14
const LANES_Y = 112

// One lane per role: the stretch of the project's life where that role is most active (the soft
// bar), and the apps that role reaches for at each phase (`at` = the phase index).
const ROLES = [
  {
    name: 'Project Manager',
    span: [1, 3],
    apps: [
      { at: 1, label: 'Good Plan' },
      { at: 2, label: 'Reckon' },
      { at: 3, label: 'Lessons Learned' },
    ],
  },
]
// Business development works ahead of the project, so it sits in the strip above the thread with
// a line down to it from each app, at pursuit and at award.
const BIZDEV = {
  name: 'Business Development',
  span: [0, 1],
  apps: [
    { at: 0, label: 'WinMax' },
    { at: 1, label: 'Scope Manager' },
  ],
}
// The demo project the graphic follows; its name links to the project's page.
const PROJECT_NAME = 'Bracket Assembly Program'
const laneY = (i: number) => LANES_Y + i * (LANE_H + LANE_GAP)
const INNER_H = laneY(ROLES.length - 1) + LANE_H + 20
// The portfolio is the outer box a project sits inside: a header strip for the portfolio and its
// manager's app, and a margin around the project.
const FRAME_PAD = 16
const FRAME_HEAD = 62
// Top of the business-development strip inside the box.
const BIZ_Y = 14
const BOX_W = 870 + FRAME_PAD * 2
// A portfolio manager oversees many projects: the project box has two more peeking out behind it.
const STACK = 10
const SVG_W = BOX_W + STACK * 2
const PF_H = INNER_H + FRAME_HEAD + FRAME_PAD
// Above the project box: the portfolio manager, with an arrow down into the project.
const TOP = 82
const SVG_H = TOP + PF_H + 6
// Roles that work across or beside projects rather than in a lane: each is a tile above the
// project box with an arrow down into it, aimed at the phase where it matters most. The tile
// names the role; `app` is the registry app it launches.
const TOP_TILES = [
  { label: 'Portfolio Manager', app: 'Portfolio Manager', x: FRAME_PAD + 4 + CHIP_W / 2, note: 'project success' },
  { label: 'Functional Manager', app: 'Labor Supply & Demand', x: FRAME_PAD + COLUMNS[2], note: 'labor allocation' },
  { label: 'Mission Assurance', app: 'The Fixer', x: FRAME_PAD + COLUMNS[3], note: 'continuous improvement' },
]
const FUNCTION_APPS = [
  { at: 2, label: 'Labor Supply & Demand' },
]

const FEATURES = [
  {
    title: 'Digital Thread',
    body: "One ID per project, from pursuit to closeout. Every app's records hang on it, so people and AI stay inside the right project's data.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="19" cy="12" r="2.4" />
        <path d="M7.6 12h8.8" />
      </svg>
    ),
  },
  {
    title: 'App Store',
    body: 'A catalog of the tools your work needs. Install the ones you need, and swap them as the work changes.',
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
    title: 'Launchpad',
    body: "Your home base, shaped by your role. Pin your favorites, and see live status for each project's connected apps.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="M8 8l4-4 4 4" />
        <rect x="6" y="17" width="12" height="3.5" rx="1" />
      </svg>
    ),
  },
  {
    title: 'AI Assistant',
    body: "AI runs through every app, reading each project's data and journal, so it can explain what changed, suggest the next move, and flag trouble early.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z" />
        <path d="M18 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
      </svg>
    ),
  },
]

/** An app chip: launches the app's own splash (/about), its front door, when the app is
 * registered with a URL. Same launch as a catalog card — same tab, person and back link handed
 * over. */
function SvgAppChip({ href, children }: { href: string | undefined; children: React.ReactNode }) {
  if (!href) return <g className="splash-svg__app">{children}</g>
  return (
    <a href={href} className="splash-svg__app splash-svg__app--link">
      {children}
    </a>
  )
}

/** The nav brand links here — the "what this is and why" page. Hero + one readable diagram of
 * the core idea (a project runs one thread and connects to apps from the store), a short
 * feature triad, and the Conway's Law grounding. */
export default function SplashPage() {
  // Chips launch the app's splash, matched by registry name; an app that isn't registered
  // (Lessons Learned) stays a plain, muted chip rather than a dead link.
  const { data: applications } = useApplications()
  const { persona } = usePersona()
  const { data: projects } = useProjects()
  const projectId = projects?.find((p) => p.name === PROJECT_NAME)?.id
  const appHref = (label: string) => {
    const url = applications?.find((a) => a.name === label)?.url
    return url ? withDepotOrigin(`${url.replace(/\/$/, '')}/about`, '/about', persona?.id) : undefined
  }

  return (
    <div className="splash-page">
      <DepotNav />

      <div className="splash-page__scroll">
        <div className="splash-container">
          <header className="splash-hero">
            <h1 className="splash-hero__title">AI-Enhanced Workflows for Every Role.</h1>
            <p className="splash-hero__sub">
              A single digital thread to streamline cross-functional communication,
              deliver objective evidence, support quality, clear bottlenecks, and deliver value.
            </p>
          </header>

          <figure className="splash-figure">
            <div className="splash-figure__svg-wrap">
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} role="img" aria-labelledby="depot-diagram-title">
                <title id="depot-diagram-title">
                  One project ID runs through pursuit, award, execution and closeout. Business
                  development and project managers launch the apps that fit their job inside the
                  project, in the phases where they are most active. Above it, a portfolio manager
                  oversees many such projects, functional managers handle labor allocation, and mission
                  assurance drives continuous improvement.
                </title>

                {/* portfolio, functional and mission-assurance managers: tiles above the project,
                    each with an arrow down into it */}
                {TOP_TILES.map((t) => (
                  <g key={t.label}>
                    <SvgAppChip href={appHref(t.app)}>
                      <rect x={t.x - CHIP_W / 2} y="4" width={CHIP_W} height="26" rx="8" fill="var(--color-surface)" stroke="var(--color-border-strong)" />
                      <text className="splash-svg__chip" x={t.x} y="21" textAnchor="middle">
                        {t.label}
                      </text>
                    </SvgAppChip>
                    <path
                      d={`M${t.x} 32 V${TOP - 2} m-4 -6 l4 6 l4 -6`}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="1.6"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <text className="splash-svg__note" x={t.x + 12} y={TOP / 2 + 8}>
                      {t.note}
                    </text>
                  </g>
                ))}

                <g transform={`translate(0 ${TOP})`}>
                {/* the project is a box; the two behind it are the portfolio's other projects */}
                {[2, 1].map((k) => (
                  <rect
                    key={`stack-${k}`}
                    x={1 + STACK * k}
                    y={1 + 8 * k}
                    width={BOX_W - 2}
                    height={PF_H - 2 - 16 * k}
                    rx="14"
                    fill="var(--color-surface)"
                    stroke="var(--color-border)"
                  />
                ))}
                <rect
                  x="1"
                  y="1"
                  width={BOX_W - 2}
                  height={PF_H - 2}
                  rx="14"
                  fill="var(--color-surface)"
                  stroke="var(--color-border-strong)"
                />

                {/* business development: above the thread, with a line down to it from each app */}
                <rect
                  x={FRAME_PAD + COLUMNS[BIZDEV.span[0]] - CHIP_W / 2 - 8}
                  y={BIZ_Y}
                  width={COLUMNS[BIZDEV.span[1]] - COLUMNS[BIZDEV.span[0]] + CHIP_W + 16}
                  height={LANE_H}
                  rx="12"
                  fill="var(--color-surface-sunken)"
                  stroke="var(--color-border)"
                />
                <text className="splash-svg__role" x={FRAME_PAD + 24} y={BIZ_Y + LANE_H / 2 + 4}>
                  {BIZDEV.name}
                </text>
                {BIZDEV.apps.map((app) => (
                  <g key={app.label}>
                    <path
                      d={`M${FRAME_PAD + COLUMNS[app.at]} ${BIZ_Y + LANE_H} V${FRAME_HEAD + 44} m-4 -6 l4 6 l4 -6`}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="1.6"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <SvgAppChip href={appHref(app.label)}>
                      <rect
                        x={FRAME_PAD + COLUMNS[app.at] - CHIP_W / 2}
                        y={BIZ_Y + 6}
                        width={CHIP_W}
                        height={LANE_H - 12}
                        rx="8"
                        fill="var(--color-surface)"
                        stroke="var(--color-border-strong)"
                      />
                      <text className="splash-svg__chip" x={FRAME_PAD + COLUMNS[app.at]} y={BIZ_Y + LANE_H / 2 + 4} textAnchor="middle">
                        {app.label}
                      </text>
                    </SvgAppChip>
                  </g>
                ))}

                <g transform={`translate(${FRAME_PAD} ${FRAME_HEAD})`}>

                {/* the project id, at the thread's origin */}
                {/* the project, by name (a link to its page), with its permanent ID under the thread */}
                {projectId ? (
                  <Link to={`/projects/${projectId}`} className="splash-svg__project splash-svg__project--link">
                    <text x="20" y="30">
                      {PROJECT_NAME}
                    </text>
                  </Link>
                ) : (
                  <g className="splash-svg__project">
                    <text x="20" y="30">
                      {PROJECT_NAME}
                    </text>
                  </g>
                )}
                <rect x="14" y="66" width="92" height="22" rx="6" fill="var(--color-accent-soft)" />
                <text className="splash-svg__id" x="60" y="81" textAnchor="middle">
                  P-100455
                </text>

                <g className="splash-svg__phase">
                  {PHASES.map((phase, i) => (
                    <text key={phase} x={COLUMNS[i] + 10} y="43">
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
                      <path
                        d={`M${COLUMNS[app.at]} ${laneY(i) + 4} V${60} m-4 6 l4 -6 l4 6`}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="1.6"
                        strokeDasharray="3 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <SvgAppChip href={appHref(app.label)}>
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
                      </SvgAppChip>
                      </g>
                    ))}
                  </g>
                ))}
                </g>

                </g>
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
