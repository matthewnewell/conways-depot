import { NavLink } from 'react-router-dom'
import './DepotNav.css'

/** Persistent top navbar across every page — including the splash page, which sits outside the
 * chat-enabled layout but should still be reachable the same way. Two dimensions the registry
 * actually has: Projects and Applications. Phase isn't a nav item on its own — it's a property
 * of a project, not a separate collection. The brand text links to the splash page (what this
 * is and why) rather than duplicating "Projects" as a second link to the same place. Admin sits
 * apart on the right — management (create/update/delete), not browsing — with no permissions
 * behind it yet; it's a separate view, not an access-controlled one. */
export default function DepotNav() {
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
          Projects
        </NavLink>
        <NavLink
          to="/applications"
          className={({ isActive }) => `depot-nav__link ${isActive ? 'depot-nav__link--active' : ''}`}
        >
          Applications
        </NavLink>
      </div>
      <NavLink
        to="/admin"
        className={({ isActive }) => `depot-nav__admin-link ${isActive ? 'depot-nav__link--active' : ''}`}
      >
        ⚙ Admin
      </NavLink>
    </nav>
  )
}
