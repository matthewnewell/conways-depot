import DepotNav from '../components/DepotNav'
import './SplashPage.css'

/** The "Conway's Depot" brand text links here — a splash/about page, outside the chat-enabled
 * layout (same "full page, own route, no persistent chat" pattern Value Stream uses for its
 * own Guide page). This absorbed what used to be a separate Theory of Operation page: one
 * place for "what is this and why," rather than splitting welcome copy from the deeper
 * reasoning across two pages. DepotNav is rendered directly (not inherited from a layout) so
 * navigation stays consistent even outside the chat-enabled part of the app. */
export default function SplashPage() {
  return (
    <div className="splash-page">
      <DepotNav />
      <div className="splash-page__toolbar">
        <h1 className="splash-page__title">Conway's Depot</h1>
      </div>

      <div className="splash-page__content">
        <section className="splash-section">
          <p className="splash-section__lede">
            Conway's Depot exists because a growing pile of small, single-purpose internal
            tools is a good problem to have — until nothing keeps track of what exists, who
            owns it, or how the pieces relate. If you're landing here cold: this page explains
            what the app actually does and why it's shaped the way it is, grounded in
            established practice rather than invented for its own sake. If you already know all
            that, <strong>Projects</strong> and <strong>Applications</strong> in the nav above
            are where the actual registry lives.
          </p>
          <p className="splash-section__lede">
            Conway's Depot is a registry, not a platform. It never runs a workflow, calls
            another application's API, or holds another application's data. It holds three
            things: <strong>Projects</strong> (one id, carried through a project's whole life),{' '}
            <strong>Applications</strong> (a catalog of the domain apps that exist, are
            planned, or are external vendor products), and <strong>Capabilities</strong> (the
            stable business need an application fulfills, independent of which application
            fulfills it today).
          </p>
        </section>

        <section className="splash-section">
          <h2 className="splash-section__title">Theory of operation</h2>
          <p className="splash-section__body">
            Everything below is an attempt to build that on established ground rather than
            invent new vocabulary — the goal is a foundation credible enough for someone else to
            build on, not a clever one-off.
          </p>
        </section>

        <section className="splash-section">
          <h2 className="splash-section__title">Why a registry, and why now</h2>
          <p className="splash-section__body">
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

        <section className="splash-section">
          <h2 className="splash-section__title">Conway's Law — and why it's about to matter more</h2>
          <p className="splash-section__body">
            Conway's Law, formulated by programmer Melvin Conway in 1967, is blunt about it:
            "Organizations which design systems are constrained to produce designs which are
            copies of the communication structures of these organizations." Split a build
            across four siloed teams — UI, database, backend, security — and you'll get four
            heavy, tightly-bounded layers back, whether or not that's the best technical shape.
            Where teams talk often, the seam between their work stays a clean API; where they
            don't, that same seam turns brittle.
          </p>
          <p className="splash-section__body">
            That's not a historical curiosity. It's the exact risk sitting in front of an
            organization about to have an explosion of AI-augmented applications: as building a
            small app for one more problem gets cheap, dozens of them will show up, built by
            whichever team happened to need one, integrated however those teams happened to
            already talk to each other. Conway's Law says that swarm won't be neutral — it will
            either mirror the org's existing communication patterns or, left unwatched,
            accumulate exactly the brittle seams that teams-that-don't-talk produce. Conway's
            Depot exists so that shape gets chosen on purpose, instead of discovered by
            accident, later, the hard way.
          </p>
          <p className="splash-section__body">
            The <em>reverse Conway maneuver</em> — sometimes called the <em>inverse Conway
            maneuver</em> — is how you choose it on purpose: instead of letting today's org
            chart dictate tomorrow's architecture, reshape the org first, often into small,
            autonomous, cross-functional teams aligned around one business capability (the
            "two-pizza team" pattern), so the architecture you actually want falls out of that
            structure. <em>Team Topologies</em> (Skelton &amp; Pais) gives that a working
            vocabulary — four team types: <strong>stream-aligned</strong> (owns a value stream
            end to end), <strong>platform</strong> (provides a self-service capability other
            teams consume), <strong>enabling</strong> (helps a team acquire a capability it's
            missing, then steps back), and <strong>complicated-subsystem</strong> (owns
            something that genuinely needs deep specialist knowledge). <strong>Capability</strong>{' '}
            — the same "business capability" a reverse Conway reorg organizes teams around — is
            a first-class thing in this registry for exactly that reason: made visible and
            trackable, not left living only in a slide deck.
          </p>
          <p className="splash-section__body">
            Every Application registered here declares its team type honestly — Value Stream
            and BurnedValue are both tagged <em>enabling</em> right now, not <em>platform</em>,
            because one person built each to help other teams adopt a practice, not as a
            self-service product yet. That's a real signal, not a technicality: an enabling
            team's tools staying enabling-shaped for too long, or one team quietly accumulating
            several registered applications, is exactly the kind of structural friction the
            reverse Conway maneuver exists to catch early. The registry surfaces that
            deterministically — ask the chat assistant "is any team carrying too much of the
            registry?" and it answers from a plain count, not an AI guess.
          </p>
        </section>

        <section className="splash-section">
          <h2 className="splash-section__title">The digital thread</h2>
          <p className="splash-section__body">
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
          <p className="splash-section__body">
            Practically: a Project accumulates <strong>External IDs</strong> as it moves
            through systems (a WinMax opportunity number, later a Costpoint charge number) —
            the Depot's own id stays the stable spine underneath all of them, never swapped
            out for whichever system currently has the "official" number.
          </p>
        </section>

        <section className="splash-section">
          <h2 className="splash-section__title">Capability vs. Application</h2>
          <p className="splash-section__body">
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

        <section className="splash-section">
          <h2 className="splash-section__title">Project-scoped vs. organizational</h2>
          <p className="splash-section__body">
            Not every application lives inside a project's phases. Some serve every project at
            once — staffing, HR, contract authoring — the same territory ISO/IEC/IEEE 15288
            calls <em>Organizational Project-Enabling Processes</em> (Clause 6.2). Value
            Stream's own template library leaves that category out on purpose, because it
            doesn't fit a single project's value stream — but it fits <em>here</em>, at the
            portfolio level, because that's exactly the altitude this registry operates at.
            Every Application declares a <strong>scope</strong>: <em>project</em> (it moves
            through a project's phases — Launchpad, for instance, spans Award through Closeout,
            not just one) or <em>organizational</em> (no phase applies, because the whole point
            is that it doesn't move with any one project). Phases are a list, not a single
            value, for the same reason: forcing a project-scoped app into exactly one phase
            would misrepresent the ones that legitimately span several.
          </p>
        </section>

        <section className="splash-section splash-section--scope">
          <h2 className="splash-section__title">What this deliberately is not, yet</h2>
          <p className="splash-section__body">
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
