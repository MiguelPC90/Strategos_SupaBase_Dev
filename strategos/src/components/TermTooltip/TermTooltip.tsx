import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { findGlossaryTerm, findGlossarySection, t } from '../../lib/glossary'
import './TermTooltip.css'

interface TermTooltipProps {
  term: string
  children: ReactNode
  placement?: 'top' | 'bottom' | 'auto'
}

const HOVER_DELAY_MS = 500

export default function TermTooltip({ term, children, placement = 'auto' }: TermTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [computedPlacement, setComputedPlacement] = useState<'top' | 'bottom'>('top')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const navigate = useNavigate()

  const glossaryTerm = findGlossaryTerm(term)
  const section = findGlossarySection(term)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!glossaryTerm) {
    return <>{children}</>
  }

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
      if (placement === 'auto' && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setComputedPlacement(rect.top > window.innerHeight - rect.bottom ? 'top' : 'bottom')
      } else if (placement !== 'auto') {
        setComputedPlacement(placement)
      }
    }, HOVER_DELAY_MS)
  }

  function hide() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      timeoutRef.current = null
    }, 150)
  }

  function handleSeeGlossary(e: React.MouseEvent) {
    e.stopPropagation()
    setIsVisible(false)
    navigate(section ? `/glossary#${section.id}` : '/glossary')
  }

  return (
    <span
      ref={triggerRef}
      className="term-tooltip-trigger"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {isVisible && (
        <div
          className={`term-tooltip term-tooltip--${computedPlacement}`}
          role="tooltip"
          onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }}
          onMouseLeave={hide}
        >
          <div className="term-tooltip-name">{t(glossaryTerm.term)}</div>
          <div className="term-tooltip-definition">{t(glossaryTerm.definition)}</div>
          {glossaryTerm.formula && (
            <div className="term-tooltip-formula">
              <span className="term-tooltip-formula-label">Fórmula:</span>
              <code>{glossaryTerm.formula}</code>
            </div>
          )}
          {glossaryTerm.notes && (
            <div className="term-tooltip-notes">{t(glossaryTerm.notes)}</div>
          )}
          <button
            className="term-tooltip-link"
            onClick={handleSeeGlossary}
            type="button"
          >
            Ver glossário →
          </button>
        </div>
      )}
    </span>
  )
}
