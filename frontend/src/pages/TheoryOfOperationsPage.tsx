import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './TheoryOfOperationsPage.css'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@500;700&display=swap'

/** Loads the page's own Google Fonts stylesheet only while this page is mounted — this is the
 * one page in the app with its own typographic identity, so the font weight isn't paid for
 * anywhere else. */
function useGoogleFont(href: string) {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [href])
}

/** "Theory of Operations" — the leadership-facing one-pager on why Conway's Depot is built the
 * way it is. Lives on the app's own domain (not an external link) so the splash page's
 * "View the presentation" button doesn't hand leadership a claude.ai URL. */
export default function TheoryOfOperationsPage() {
  useGoogleFont(FONT_HREF)

  return (
    <div className="theory-page">
      <div className="theory-page__inner">
        <header className="theory-masthead">
          <Link className="theory-eyebrow" to="/about">
            ← Conway&rsquo;s Depot
          </Link>
          <h1>Theory of Operations</h1>
          <p className="theory-masthead__thesis">
            A system ends up shaped like the organization that built it.
          </p>
          <span className="theory-masthead__attr">Conway&rsquo;s Law</span>
        </header>

        <figure className="theory-diagram">
          <svg viewBox="0 0 900 220" role="img" aria-labelledby="theory-diagram-title">
            <title id="theory-diagram-title">
              An organization chart and a system diagram, drawn as the same branching shape,
              mirrored — leadership over three departments on the left, a portfolio over three
              connected apps on the right.
            </title>

            <text x="30" y="24" className="theory-diagram__side-tag" fill="var(--teal)">
              THE ORGANIZATION
            </text>
            <text x="870" y="24" className="theory-diagram__side-tag" textAnchor="end" fill="var(--copper)">
              THE SYSTEM
            </text>

            <line x1="450" y1="16" x2="450" y2="196" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 5" />

            {/* left tree: org */}
            <g>
              <line x1="209" y1="86" x2="85" y2="142" stroke="var(--teal)" strokeWidth="1.5" opacity="0.55" />
              <line x1="209" y1="86" x2="209" y2="142" stroke="var(--teal)" strokeWidth="1.5" opacity="0.55" />
              <line x1="209" y1="86" x2="333" y2="142" stroke="var(--teal)" strokeWidth="1.5" opacity="0.55" />

              <rect x="139" y="46" width="140" height="40" rx="7" fill="var(--teal-soft)" stroke="var(--teal)" strokeWidth="1.5" />
              <text x="209" y="71" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                Leadership
              </text>

              <rect x="30" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--teal)" strokeWidth="1.5" />
              <text x="85" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                Dept A
              </text>

              <rect x="154" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--teal)" strokeWidth="1.5" />
              <text x="209" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                Dept B
              </text>

              <rect x="278" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--teal)" strokeWidth="1.5" />
              <text x="333" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                Dept C
              </text>

              <text x="30" y="206" className="theory-diagram__tier-tag">reports to</text>
            </g>

            {/* right tree: system, exact mirror of the left tree across x=450 */}
            <g>
              <line x1="691" y1="86" x2="815" y2="142" stroke="var(--copper)" strokeWidth="1.5" opacity="0.55" />
              <line x1="691" y1="86" x2="691" y2="142" stroke="var(--copper)" strokeWidth="1.5" opacity="0.55" />
              <line x1="691" y1="86" x2="567" y2="142" stroke="var(--copper)" strokeWidth="1.5" opacity="0.55" />

              <rect x="621" y="46" width="140" height="40" rx="7" fill="var(--copper-soft)" stroke="var(--copper)" strokeWidth="1.5" />
              <text x="691" y="71" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                Portfolio
              </text>

              <rect x="760" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--copper)" strokeWidth="1.5" />
              <text x="815" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                App A
              </text>

              <rect x="636" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--copper)" strokeWidth="1.5" />
              <text x="691" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                App B
              </text>

              <rect x="512" y="142" width="110" height="40" rx="7" fill="var(--surface)" stroke="var(--copper)" strokeWidth="1.5" />
              <text x="567" y="167" textAnchor="middle" className="theory-diagram__node-label" fill="var(--ink)">
                App C
              </text>

              <text x="870" y="206" textAnchor="end" className="theory-diagram__tier-tag">plugs into</text>
            </g>
          </svg>
        </figure>

        <section className="theory-glossary">
          <div className="theory-entry">
            <p className="theory-entry__term">
              Organization Shape = System Shape
              <em>Conway&rsquo;s Law</em>
            </p>
            <p className="theory-entry__def">
              The way a team is organized tends to show up in the systems it builds. Instead of
              fighting that, we designed the organization&rsquo;s shape into the system on purpose.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              One thread
              <br />
              per project
              <em>Digital thread</em>
            </p>
            <p className="theory-entry__def">
              Every project gets a single ID the moment it&rsquo;s pursued, and that ID never
              changes. It&rsquo;s the thread that ties every record, in every tool, back to the same
              piece of work.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              Separate,
              <br />
              on purpose
              <em>Separation of concerns</em>
            </p>
            <p className="theory-entry__def">
              Small tools that each do one job well, instead of one system trying to do
              everything. When a tool needs to change, only that thread moves — not the whole
              operation.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              No single
              <br />
              vendor
              <em>Solution&#8209;agnostic</em>
            </p>
            <p className="theory-entry__def">
              The catalog doesn&rsquo;t bet on one tool or one vendor. Anything can plug in through
              the same thread, and swapping a tool out doesn&rsquo;t erase the project&rsquo;s history.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              Connected,
              <br />
              and AI&#8209;enabled
              <em>Integration</em>
            </p>
            <p className="theory-entry__def">
              Because every tool shares the same thread, an assistant can answer questions across
              the whole project — instead of a person stitching five systems together by hand.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              Built to
              <br />
              communicate
              <em>The actual point</em>
            </p>
            <p className="theory-entry__def">
              Departments, projects, portfolios, and the organization stay in sync on the same
              facts, instead of six different spreadsheets telling six different stories.
            </p>
          </div>

          <div className="theory-entry">
            <p className="theory-entry__term">
              Isolated
              <br />
              by design
              <em>Security &amp; access</em>
            </p>
            <p className="theory-entry__def">
              Every project&rsquo;s data is scoped and controlled — the same assistant that works
              across a project&rsquo;s apps can&rsquo;t wander into another project&rsquo;s, and there&rsquo;s no
              shared pool for anything to leak from. Who can see or change what follows the
              people and roles on that project, not a blanket key that opens everything.
            </p>
          </div>
        </section>

        <section className="theory-matters">
          <h2>Why this matters</h2>
          <p>
            Implementations of workplace technology can be difficult because organizations treat
            software as an external artifact dropped onto an existing structure. The challenge
            is especially difficult when integrating AI workflow applications, where the cost of
            that mismatch is stark:
          </p>
          <ul className="theory-matters__stats">
            <li>
              <span className="theory-matters__stat-label">High project failure rates</span>
              Roughly 80% of enterprise AI implementations fail — nearly double the failure
              rate of standard non&#8209;AI IT deployments.{' '}
              <a
                className="theory-matters__source"
                href="https://www.rand.org/pubs/research_reports/RRA2680-1.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                RAND Corporation
              </a>
            </li>
            <li>
              <span className="theory-matters__stat-label">Pilot purgatory</span>
              95% of generative&#8209;AI pilot programs never reach enterprise&#8209;scale
              production or meaningful revenue impact.{' '}
              <a
                className="theory-matters__source"
                href="https://nanda.media.mit.edu/ai_report_2025.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT NANDA Initiative
              </a>
            </li>
            <li>
              <span className="theory-matters__stat-label">Wasted capital, scrapped initiatives</span>
              42% of AI initiatives are abandoned mid&#8209;stream — primarily from workflow and
              integration bottlenecks, not raw algorithmic limits.{' '}
              <a
                className="theory-matters__source"
                href="https://www.spglobal.com/market-intelligence/en/news-insights/research/2025/10/generative-ai-shows-rapid-growth-but-yields-mixed-results"
                target="_blank"
                rel="noopener noreferrer"
              >
                S&amp;P Global Market Intelligence
              </a>
            </li>
          </ul>
          <p>
            When an AI tool fails, it&rsquo;s rarely the model&rsquo;s underlying performance — it&rsquo;s
            that the tool was built without mapping to the real communication paths and
            handoffs of the team using it.
          </p>
          <p>
            Designing AI&#8209;augmented workflows around actual human communication boundaries —
            instead of forcing a rigid software model onto legacy operations — is what turns
            isolated AI experiments into capabilities that hold up at enterprise scale.
          </p>
        </section>

        <footer className="theory-footer">
          <span>Theory of Operations · Conway&rsquo;s Depot</span>
          <span>Prepared September 2026</span>
        </footer>
      </div>
    </div>
  )
}
