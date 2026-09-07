import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePeople } from '../api/hooks'
import type { Person } from '../api/types'

/**
 * The "viewing as" persona — a demo lens, not authentication (see backend models.Person).
 * Which persona is active is kept in localStorage so it survives reloads and the trip through
 * the splash page (which unmounts the app shell). Nothing here enforces anything: it only lets
 * list views default to "my projects / my apps" with an "all" toggle that hides nothing.
 */

const STORAGE_KEY = 'conways-depot:persona'

interface PersonaContextValue {
  /** The active persona, or null while people are still loading. */
  persona: Person | null
  /** Every seeded persona, for the switcher. */
  people: Person[]
  isLoading: boolean
  setPersonaId: (id: string) => void
}

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined)

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const { data: people, isLoading } = usePeople()
  const [personaId, setPersonaIdState] = useState<string | null>(readStoredId)

  function setPersonaId(id: string) {
    setPersonaIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* private mode / storage disabled — the choice just won't persist */
    }
  }

  // Default to the admin ("see everything") persona once the list loads and nothing valid is
  // stored — matches today's behaviour where the whole registry is visible.
  useEffect(() => {
    if (!people || people.length === 0) return
    const stored = people.find((p) => p.id === personaId)
    if (stored) return
    const fallback = people.find((p) => p.is_admin) ?? people[0]
    setPersonaId(fallback.id)
  }, [people, personaId])

  const value = useMemo<PersonaContextValue>(() => {
    const list = people ?? []
    return {
      persona: list.find((p) => p.id === personaId) ?? null,
      people: list,
      isLoading,
      setPersonaId,
    }
  }, [people, personaId, isLoading])

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error('usePersona must be used within a PersonaProvider')
  return ctx
}
