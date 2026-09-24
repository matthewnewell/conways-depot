import { Link } from 'react-router-dom'
import { useProjects } from '../api/hooks'
import DepotNav from '../components/DepotNav'
import { withDepotOrigin } from '../lib/launch'
import { usePersona } from '../lib/persona'
import './SplashPage.css'

// The thread runs through four phases; each phase is a station on it, evenly spaced. Wide enough
// apart that the roles above and below the thread fit one per phase without touching.
const COLUMNS = [290, 460, 630, 790]
const PHASES = ['Pursuit', 'Award', 'Execution', 'Closeout']
const CHIP_W = 138
const LANE_H = 40
const LANE_GAP = 14
const LANES_Y = 112

// Every box in the graphic is a ROLE, not an app: app names mean little to someone new, and the
// headline is "workflows for every role". Each box opens that role's own Launchpad (switch
// "viewing as" to the demo persona with that title, then land on "/"), where the apps live.
// `title` is the persona's exact Person.title in the Depot's demo data.
type Role = { label: string; title: string }
type PhaseRole = Role & { at: number }

// Roles under the thread, each with a line up to it at the phase where it's most active (`at`, a
// phase index), on a lane (`lane`) so wide boxes in neighboring phases don't collide.
const LANES: (PhaseRole & { lane: number })[] = [
  { label: 'Solutions Architect', title: 'Solutions Architect', at: 0, lane: 0 },
  { label: 'Program Manager', title: 'Program Manager', at: 1, lane: 0 },
  { label: 'Production Support Engineer', title: 'Production Support Engineer', at: 2, lane: 1 },
]
const LANE_COUNT = Math.max(...LANES.map((r) => r.lane)) + 1
// Roles above the thread, in the box's header strip, each with a line down to it: business
// development into pursuit, contracts into award, the project engineer into execution.
const ABOVE: PhaseRole[] = [
  { label: 'Business Development', title: 'Business Development Lead', at: 0 },
  { label: 'Contracts Manager', title: 'Contracts Manager', at: 1 },
  { label: 'Project Engineer', title: 'Project Engineer', at: 2 },
]
// Below the project stack, outside it: what closeout feeds. Capability comes from many projects,
// not one, so it sits under the portfolio's stack rather than inside the project. A knowledge
// store, not a role, so a small cylinder instead of a role's rounded box. BD and solution
// architects draw on it for new business, program managers for follow-on work.
const CAPABILITY = { label: 'Capability Models', at: 3, w: CHIP_W, url: 'http://localhost:5193' }
// The demo project the graphic follows; its name links to the project's page.
const PROJECT_NAME = 'Bracket Assembly Project'
const laneY = (i: number) => LANES_Y + i * (LANE_H + LANE_GAP)
// The last role box sits as close to the bottom edge as business development does to the top (~19px).
const INNER_H = laneY(LANE_COUNT - 1) + LANE_H - 3
// The portfolio is the outer box a project sits inside: a header strip for the roles above the
// thread, and a margin around the project.
const FRAME_PAD = 16
const FRAME_HEAD = 62
// Top of the header strip inside the box.
const BIZ_Y = 14
const BOX_W = 870 + FRAME_PAD * 2
// A portfolio manager oversees many projects: the project box has two more peeking out behind it.
const STACK = 10
const SVG_W = BOX_W + STACK * 2
const PF_H = INNER_H + FRAME_HEAD + FRAME_PAD
// Above the project box: roles that work across or beside projects, each a tile with an arrow
// down into the project, aimed at the phase where it matters most.
const TOP = 82
// Room under the project stack for the capability store.
const BOTTOM = 70
const SVG_H = TOP + PF_H + BOTTOM
// `side`: which side of its arrow the note sits; the two right-hand tiles put theirs on the left,
// where there's room (the far right runs out of width).
const TOP_TILES: (Role & { x: number; note: string; side?: 'left' })[] = [
  { label: 'Portfolio Manager', title: 'Portfolio Manager', x: FRAME_PAD + 4 + CHIP_W / 2, note: 'project success' },
  { label: 'Functional Manager', title: 'Engineering Functional Manager', x: FRAME_PAD + COLUMNS[2], note: 'labor allocation', side: 'left' },
  { label: 'Mission Assurance', title: 'Mission Assurance Manager', x: FRAME_PAD + COLUMNS[3], note: 'continuous improvement', side: 'left' },
]

/** Box width that fits a role name; never narrower than the standard chip. */
const chipW = (label: string) => Math.max(CHIP_W, Math.round(label.length * 6.9 + 24))

const FEATURES = [
  {
    title: 'Built on Your Systems',
    body: "S4 stays the source for projects and cost, and Active Directory for people and the organization. The apps read from them rather than replacing or copying them, and one project ID keeps people and AI inside the right project's data.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="2.6" />
        <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" />
        <path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
      </svg>
    ),
  },
  {
    title: 'App Store',
    body: "A catalog of the tools your work needs, including apps other departments build. Install the ones you need, and swap them as the work changes.",
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

/** A role box: opens that role's Launchpad by switching "viewing as" to the demo persona holding
 * that title. With no such persona seeded it stays a plain, muted box rather than a dead link. */
function RoleChip({
  x,
  y,
  h,
  label,
  personaId,
  onPick,
}: {
  x: number
  y: number
  h: number
  label: string
  personaId: string | undefined
  onPick: (id: string) => void
}) {
  const w = chipW(label)
  const body = (
    <>
      <rect x={x - w / 2} y={y} width={w} height={h} rx="8" fill="var(--color-surface)" stroke="var(--color-border-strong)" />
      <text className="splash-svg__chip" x={x} y={y + h / 2 + 4} textAnchor="middle">
        {label}
      </text>
    </>
  )
  if (!personaId) return <g className="splash-svg__app">{body}</g>
  return (
    <Link to="/" onClick={() => onPick(personaId)} className="splash-svg__app splash-svg__app--link" aria-label={`${label} Launchpad`}>
      {body}
    </Link>
  )
}

/** The nav brand links here — the "what this is and why" page. Hero + one readable diagram of
 * the core idea (a project runs one thread and connects to apps from the store), a short
 * feature triad, and the Conway's Law grounding. */
export default function SplashPage() {
  const { people, persona, setPersonaId } = usePersona()
  const { data: projects } = useProjects()
  const projectId = projects?.find((p) => p.name === PROJECT_NAME)?.id
  const personaFor = (title: string) => people.find((p) => p.title === title)?.id

  return (
    <div className="splash-page">
      <DepotNav />

      <div className="splash-page__scroll">
        <div className="splash-container">
          <header className="splash-hero">
            <h1 className="splash-hero__title">AI-Enhanced Workflows for Every Role.</h1>
            <p className="splash-hero__sub">
              Improve cross-functional collaboration, do better work,
              <br />
              clear bottlenecks, and deliver more value.
            </p>
          </header>

          <figure className="splash-figure">
            <div className="splash-figure__svg-wrap">
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} role="img" aria-labelledby="depot-diagram-title">
                <title id="depot-diagram-title">
                  One project ID runs through pursuit, award, execution and closeout. Business
                  development and a solutions architect work the pursuit, a contracts manager the
                  award, and a project engineer and production support engineer the execution; the
                  program manager faces the customer from award on. Above it, a portfolio manager
                  oversees many such projects, functional managers handle labor allocation, and
                  mission assurance drives continuous improvement. Each role opens its own
                  Launchpad. At closeout, what the project proved flows into capability models, which
                  new business and follow-on work draw on.
                </title>

                {/* roles above the project, each with an arrow down into it */}
                {TOP_TILES.map((t) => (
                  <g key={t.label}>
                    <RoleChip x={t.x} y={4} h={26} label={t.label} personaId={personaFor(t.title)} onPick={setPersonaId} />
                    <path
                      d={`M${t.x} 32 V${TOP - 2} m-4 -6 l4 6 l4 -6`}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="1.6"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <text
                      className="splash-svg__note"
                      x={t.side === 'left' ? t.x - 12 : t.x + 12}
                      y={TOP / 2 + 8}
                      textAnchor={t.side === 'left' ? 'end' : 'start'}
                    >
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

                {/* roles above the thread, each with a line down to it at its phase */}
                {ABOVE.map((r) => (
                  <g key={r.label}>
                    <path
                      d={`M${FRAME_PAD + COLUMNS[r.at]} ${BIZ_Y + LANE_H} V${FRAME_HEAD + 44} m-4 -6 l4 6 l4 -6`}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="1.6"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <RoleChip
                      x={FRAME_PAD + COLUMNS[r.at]}
                      y={BIZ_Y + 6}
                      h={LANE_H - 12}
                      label={r.label}
                      personaId={personaFor(r.title)}
                      onPick={setPersonaId}
                    />
                  </g>
                ))}

                <g transform={`translate(${FRAME_PAD} ${FRAME_HEAD})`}>

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
                {projectId ? (
                  <Link to={`/projects/${projectId}`} className="splash-svg__id-group splash-svg__id-group--link">
                    <rect x="14" y="66" width="92" height="22" rx="6" fill="var(--color-accent-soft)" />
                    <text className="splash-svg__id" x="60" y="81" textAnchor="middle">
                      P-100234
                    </text>
                  </Link>
                ) : (
                  <g className="splash-svg__id-group">
                    <rect x="14" y="66" width="92" height="22" rx="6" fill="var(--color-accent-soft)" />
                    <text className="splash-svg__id" x="60" y="81" textAnchor="middle">
                      P-100234
                    </text>
                  </g>
                )}

                <g className="splash-svg__phase">
                  {PHASES.map((phase, i) => (
                    <text key={phase} x={COLUMNS[i] + 10} y="43">
                      {phase.toUpperCase()}
                    </text>
                  ))}
                </g>

                {/* the project's one ID, pursuit to closeout */}
                <line x1="20" y1="52" x2="840" y2="52" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
                <path d="M840 46 L854 52 L840 58 Z" fill="var(--color-accent)" />
                <circle cx="20" cy="52" r="5.5" fill="var(--color-accent)" />
                {COLUMNS.map((x, i) => (
                  <g key={`node-${PHASES[i]}`}>
                    <circle cx={x} cy="52" r="6" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2.5" />
                    <circle cx={x} cy="52" r="2.4" fill="var(--color-accent)" />
                  </g>
                ))}

                {/* closeout: a line down out of the project, to the capability store below */}
                <path
                  d={`M${COLUMNS[CAPABILITY.at]} 60 V${PF_H - FRAME_HEAD}`}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.6"
                  strokeDasharray="3 4"
                  strokeLinecap="round"
                />

                {/* the in-project roles, each with a line up to the thread at its phase */}
                {LANES.map((r) => (
                  <g key={r.label}>
                    <path
                      d={`M${COLUMNS[r.at]} ${laneY(r.lane) + 4} V${60} m-4 6 l4 -6 l4 6`}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="1.6"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <RoleChip
                      x={COLUMNS[r.at]}
                      y={laneY(r.lane) + 6}
                      h={LANE_H - 12}
                      label={r.label}
                      personaId={personaFor(r.title)}
                      onPick={setPersonaId}
                    />
                  </g>
                ))}
                </g>

                {/* the capability store, outside and below the portfolio's projects */}
                {(() => {
                  const cx = FRAME_PAD + COLUMNS[CAPABILITY.at]
                  const w = CAPABILITY.w
                  const ry = 4
                  const top = PF_H + 30
                  const h = 24
                  const l = cx - w / 2
                  const r = cx + w / 2
                  const body = (
                    <>
                      <path
                        d={`M${l} ${top} V${top + h} A${w / 2} ${ry} 0 0 0 ${r} ${top + h} V${top}`}
                        className="splash-svg__store-body"
                      />
                      <ellipse cx={cx} cy={top} rx={w / 2} ry={ry} className="splash-svg__store-top" />
                      <text className="splash-svg__chip" x={cx} y={top + h / 2 + 6} textAnchor="middle">
                        {CAPABILITY.label}
                      </text>
                    </>
                  )
                  return (
                    <g>
                      <path
                        d={`M${cx} ${PF_H} V${top - ry - 2} m-4 -6 l4 6 l4 -6`}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="1.6"
                        strokeDasharray="3 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <a
                        href={withDepotOrigin(CAPABILITY.url, '/about', persona?.id, "Conway's Depot")}
                        className="splash-svg__app splash-svg__app--link"
                        aria-label={`${CAPABILITY.label}: what the organization has shown it can do`}
                      >
                        {body}
                      </a>
                    </g>
                  )
                })()}

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

          <footer className="splash-footer">
            <span className="splash-footer__brand">Conway&rsquo;s Depot</span>
            <nav className="splash-footer__links" aria-label="Footer">
              <Link to="/">Launchpad</Link>
              <Link to="/catalog">Catalog</Link>
              <Link to="/theory-of-operations">Theory of Operations</Link>
              <Link to="/admin">Register a project</Link>
            </nav>
          </footer>
        </div>
      </div>
    </div>
  )
}
