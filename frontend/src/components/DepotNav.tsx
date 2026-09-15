import { NavLink } from 'react-router-dom'
import { IS_EMBEDDED } from '../lib/embed'
import PersonaMenu from './PersonaMenu'
import './DepotNav.css'

/** Persistent top navbar across every page — including the splash page, which sits outside the
 * chat-enabled layout but should still be reachable the same way. The Depot is a shell now, not
 * just the catalog: **Launchpad** (`/`) is the personalized landing page — organizational apps,
 * pinned apps, and a persona's own projects, one glance; **Projects** (`/projects`) is the full
 * portfolio list — every project, sortable/filterable, not just "mine"; **Catalog**
 * (`/catalog`) is where you browse applications by category. A given project's or app's own
 * detail page is reached *from* one of these three, not a top-level nav item on its own; Phase
 * isn't either — it's a property of a project. The brand text links to the splash page (what
 * this is and why) rather than duplicating "Launchpad" as a second link to the same place.
 *
 * There's no ⚙ Admin link here: admin is a property of a persona, not a nav destination. The
 * default persona is literally named "Admin" (the see-everything seat) and the switcher lets
 * you view as one of the other people instead. The `/admin` route still exists (reachable by
 * URL, and via the demo shell's own black bar) — it was never access-controlled. See
 * lib/persona.tsx and pages/AdminPage.tsx.
 *
 * Inside the demo shell the shell's black bar already carries Conway's Depot / Projects /
 * Applications / Admin, so this renders only the persona switcher there — one thin strip under
 * the black bar — rather than stacking a second full navbar. See src/lib/embed.ts. */
export default function DepotNav() {
  if (IS_EMBEDDED) {
    return (
      <nav className="depot-nav depot-nav--embedded">
        <PersonaMenu />
      </nav>
    )
  }

  return (
    <nav className="depot-nav">
      <NavLink to="/about" className="depot-nav__brand">
        Conway's Depot
      </NavLink>
      <div className="depot-nav__links">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `depot-nav__link ${isActive ? 'depot-nav__link--active' : ''}`}
        >
          Launchpad
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) => `depot-nav__link ${isActive ? 'depot-nav__link--active' : ''}`}
        >
          Projects
        </NavLink>
        <NavLink
          to="/catalog"
          className={({ isActive }) => `depot-nav__link ${isActive ? 'depot-nav__link--active' : ''}`}
        >
          Catalog
        </NavLink>
      </div>
      <div className="depot-nav__right">
        <PersonaMenu />
      </div>
    </nav>
  )
}
