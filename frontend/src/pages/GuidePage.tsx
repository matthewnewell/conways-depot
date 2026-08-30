import { useNavigate } from 'react-router-dom'
import './GuidePage.css'

/** App-level explainer, outside the chat-enabled layout — same "full page, own route, no
 * persistent chat" pattern as Value Stream's Guide page. This is the pitch: someone should be
 * able to open this page cold and come away confident the shape of the thing is reasonable,
 * not invented for its own sake. */
export default function GuidePage() {
  const navigate = useNavigate()

  return (
    <div className="guide-page">
      <div className="guide-page__toolbar">
        <button className="guide-page__back" onClick={() => navigate('/')}>
          ← Projects
        </button>
        <h1 className="guide-page__title">Theory of Operation</h1>
      </div>

      <div className="guide-page__content">
        <section className="guide-section">
          <p className="guide-section__lede">
            Conway's Depot is a registry, not a platform. It never runs a workflow, calls
            another application's API, or holds another application's data. It holds three
            things: <strong>Projects</strong> (one id, carried through a project's whole life),{' '}
            <strong>Applications</strong> (a catalog of the domain apps that exist, are
            planned, or are external vendor products), and <strong>Capabilities</strong> (the
            stable business need an application fulfills, independent of which application
            fulfills it today). Everything below is an attempt to build that on established
            ground rather than invent new vocabulary — the goal is a foundation credible enough
            for someone else to build on, not a clever one-off.
          </p>
        </section>

        <section className="guide-section">
          <h2 className="guide-section__title">Why a registry, and why now</h2>
          <p className="guide-section__body">
            Every domain problem an organization has is a candidate for its own small,
            AI-augmented application — a value-stream tool, a cost-tracking tool, a capture
            tool, eventually a dozen more. That's healthy: small, legible, single-purpose tools
            beat one monolith trying to do everything (the lesson of building{' '}
            <em>BurnedValue</em> first — packing too much into one app made it harder to
            reason about, not more capable). But an organization heading toward a dozen such
            tools needs <em>something</em> that knows what exists, who owns it, and how the
            pieces relate — without becoming the very monolith it's meant to prevent. That's
            the entire job of this app.
          </p>
        </section>

        <section className="guide-section">
          <h2 className="guide-section__title">Conway's Law, run in reverse</h2>
          <p className="guide-section__body">
            Conway's Law observes that a system's structure ends up mirroring the
            communication structure of the organization that built it — teams ship their org
            chart. The <em>reverse Conway maneuver</em> (a well-established idea in software
            architecture, not an invention here) turns that around: shape the team structure
            you want first, and the system architecture tends to follow. <em>Team
            Topologies</em> (Skelton &amp; Pais) gives that a working vocabulary — four team
            types: <strong>stream-aligned</strong> (owns a value stream end to end),{' '}
            <strong>platform</strong> (provides a self-service capability other teams consume),{' '}
            <strong>enabling</strong> (helps a team acquire a capability it's missing, then
            steps back), and <strong>complicated-subsystem</strong> (owns something that
            genuinely needs deep specialist knowledge).
          </p>
          <p className="guide-section__body">
            Every Application registered here declares its team type honestly — Value Stream
            and BurnedValue are both tagged <em>enabling</em> right now, not <em>platform</em>,
            because one person built each to help other teams adopt a practice, not as a
            self-service product yet. That's a real signal, not a technicality: an enabling
            team's tools staying enabling-shaped for too long, or one team quietly accumulating
            several registered applications, is exactly the kind of structural friction the
            reverse Conway maneuver exists to catch early. The registry surfaces that
            deterministically (see the Application Registry page) — no AI guessing required.
          </p>
        </section>

        <section className="guide-section">
          <h2 className="guide-section__title">The digital thread</h2>
          <p className="guide-section__body">
            A Project's id here is meant to be issued as early as Pursuit and never replaced —
            what systems engineering calls a <em>digital thread</em> (the term the DoD's
            Digital Engineering Strategy uses for exactly this pattern; the UK's building-safety
            regulation calls the same idea a "golden thread of information"). It's also not a
            new requirement on top of existing practice: PMI's own standards for Portfolio and
            Program management already require a persistent, unique identifier for a project for
            this same reason — traceability across its life. In a Deltek shop specifically,
            this crosswalk already has to exist informally the moment a WinMax pursuit gets
            awarded and picked up in Costpoint as a charge number — this registry just makes
            that crosswalk explicit and durable instead of tribal knowledge.
          </p>
          <p className="guide-section__body">
            Practically: a Project accumulates <strong>External IDs</strong> as it moves
            through systems (a WinMax opportunity number, later a Costpoint charge number) —
            the Depot's own id stays the stable spine underneath all of them, never swapped
            out for whichever system currently has the "official" number.
          </p>
        </section>

        <section className="guide-section">
          <h2 className="guide-section__title">Capability vs. Application</h2>
          <p className="guide-section__body">
            This split is TOGAF's Business Capability Map, not an invention: a{' '}
            <strong>Capability</strong> ("Value Stream Mapping," "Cost / EVM Analysis") is
            stable — a project needs it for as long as the project exists. An{' '}
            <strong>Application</strong> is whichever tool currently fulfills that capability,
            and it's explicitly allowed to change. BurnedValue is registered as fulfilling "Cost
            / EVM Analysis" today; if it's replaced next year, the capability doesn't move and
            neither does any project's history — only the application backing it changes. No
            project is ever forced into using a specific application because of how it's
            registered here.
          </p>
        </section>

        <section className="guide-section guide-section--scope">
          <h2 className="guide-section__title">What this deliberately is not, yet</h2>
          <p className="guide-section__body">
            No live API integration with WinMax, Costpoint, or anything else — every link
            between a Project and an Application is a stored pointer (an id, a URL), reviewed
            and entered by a person, never a background sync. No staffing or labor-capacity
            math — "Staffing & Capacity Engine" is a registered <em>planned</em> application
            with a real capability behind it, because that's a hard, worthwhile problem that
            deserves its own project, not a bolt-on feature here. No enforcement, no
            permissions, no workflow. This is scaffolding sized to prove the shape is right
            before anything heavier gets built on it.
          </p>
        </section>
      </div>
    </div>
  )
}
