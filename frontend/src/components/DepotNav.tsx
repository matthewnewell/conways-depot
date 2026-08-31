import { NavLink } from 'react-router-dom'
import './DepotNav.css'

/** Persistent top navbar across every page — including the Guide page, which sits outside the
 * chat-enabled layout but should still be reachable the same way. Three dimensions the
 * registry actually has: Projects (grouped by phase on their own page), Applications (grouped
 * by capability, with its own sort control), and the Theory of Operation explainer. Phase
 * itself isn't a fourth nav item — it's a property of a project, not a separate collection. */
export default function DepotNav() {
  return (
    <nav className="depot-nav">
      <NavLink to="/" className="depot-nav__brand" end>
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
        <NavLink
          to="/guide"
          className={({ isActive }) => `depot-nav__link ${isActive ? 'depot-nav__link--active' : ''}`}
        >
          📘 Theory of Operation
        </NavLink>
      </div>
    </nav>
  )
}
