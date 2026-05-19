import { useState, useMemo, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { GLOSSARY_SECTIONS, t } from '../../lib/glossary'
import './Glossary.css'

export default function Glossary() {
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string>(GLOSSARY_SECTIONS[0].id)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const filteredSections = useMemo(() => {
    if (!query.trim()) return GLOSSARY_SECTIONS
    const q = query.toLowerCase()
    return GLOSSARY_SECTIONS.map(section => ({
      ...section,
      terms: section.terms.filter(term =>
        t(term.term).toLowerCase().includes(q) ||
        t(term.definition).toLowerCase().includes(q) ||
        (term.notes ? t(term.notes).toLowerCase().includes(q) : false)
      ),
    })).filter(s => s.terms.length > 0)
  }, [query])

  useEffect(() => {
    if (query.trim()) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    Object.values(sectionRefs.current).forEach(el => {
      if (el) observer.observe(el)
    })

    function handleScroll() {
      const scrollY = window.scrollY
      const viewportH = window.innerHeight
      const docH = document.documentElement.scrollHeight
      if (scrollY + viewportH >= docH - 100) {
        setActiveSection(GLOSSARY_SECTIONS[GLOSSARY_SECTIONS.length - 1].id)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [query])

  function scrollToSection(id: string) {
    const el = sectionRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="glossary-page">
      <aside className="glossary-sidebar">
        <h2 className="glossary-sidebar-title">Glossário</h2>
        <nav className="glossary-nav" aria-label="Glossário">
          {GLOSSARY_SECTIONS.map(s => (
            <button
              key={s.id}
              className={`glossary-nav-item${activeSection === s.id && !query ? ' is-active' : ''}`}
              onClick={() => scrollToSection(s.id)}
            >
              {t(s.title)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="glossary-content">
        <div className="glossary-header">
          <h1 className="glossary-title">Glossário Stratgos</h1>
          <p className="glossary-intro">
            Vocabulário canónico da plataforma. Referência única para termos usados em UI, documentação e comunicação.
          </p>
          <div className="glossary-search">
            <Search size={16} className="glossary-search-icon" />
            <input
              type="text"
              className="glossary-search-input"
              placeholder="Pesquisar termos..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredSections.length === 0 && (
          <div className="glossary-empty">
            Sem resultados para <strong>"{query}"</strong>.
          </div>
        )}

        {filteredSections.map(section => (
          <section
            key={section.id}
            id={section.id}
            ref={el => { sectionRefs.current[section.id] = el }}
            className="glossary-section"
          >
            <h2 className="glossary-section-title">{t(section.title)}</h2>
            {section.intro && <p className="glossary-section-intro">{t(section.intro)}</p>}
            <dl className="glossary-terms">
              {section.terms.map(term => (
                <div key={t(term.term)} className="glossary-term">
                  <dt className="glossary-term-name">{t(term.term)}</dt>
                  <dd className="glossary-term-body">
                    <p className="glossary-term-definition">{t(term.definition)}</p>
                    {term.formula && (
                      <p className="glossary-term-formula">
                        <span className="glossary-term-formula-label">Fórmula:</span>{' '}
                        <code>{term.formula}</code>
                      </p>
                    )}
                    {term.notes && <p className="glossary-term-notes">{t(term.notes)}</p>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </main>
    </div>
  )
}
