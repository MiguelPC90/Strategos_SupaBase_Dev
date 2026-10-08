import './PlanHeader.css'
import type { ReactNode } from 'react'
import { planoStatusKey } from '../../lib/pdsHelpers'
import type { RowState } from '../../lib/rollup'
import type { PlanoHealth } from '../../hooks/usePlanoHealth'

/** Shown in place of a people field that has no value. */
const EMPTY_VALUE = '—'

export interface PlanHeaderProps {
  /** Plan name shown as the title. */
  planName: string
  /**
   * Health semaphore and execution status are passed as DATA, never as nodes, so
   * both pages label and style them identically. Saúde and Estado are different
   * systems and may legitimately disagree — the labels are what make a
   * disagreement read as intentional rather than as a bug.
   */
  health: PlanoHealth
  status: RowState
  /** Pre-formatted range, e.g. "Mar 2026 → Set 2026". Falsy → the Datas item is omitted. */
  dateLine?: string
  /** Synthesis sentence. Falsy → the narrative row is omitted. */
  narrative?: string
  /** Sponsor first, then owner: sponsor sits above owner in the governance hierarchy. */
  sponsorNames?: string[]
  ownerNames?: string[]
  /** Per-program configurable labels (useProgramLabels). */
  sponsorLabel?: string
  ownerLabel?: string
  /** Buttons immediately flanking the title (PontoSituacao's plano arrows). */
  navPrev?: ReactNode
  navNext?: ReactNode
  /**
   * Right of the title row, after the edit button: the favourite star on the ficha,
   * the "Actualizado em …" date on PontoSituacao.
   */
  titleAside?: ReactNode
  /** Renders the "Editar plano" button. The component knows nothing about modals. */
  canEdit?: boolean
  onEdit?: () => void
  /** Rendered just below the header — the ficha's objective paragraph. */
  children?: ReactNode
}

export default function PlanHeader({
  planName,
  health,
  status,
  dateLine,
  narrative,
  sponsorNames = [],
  ownerNames = [],
  sponsorLabel = 'Patrocinador',
  ownerLabel = 'Responsável',
  navPrev,
  navNext,
  titleAside,
  canEdit = false,
  onEdit,
  children,
}: PlanHeaderProps) {
  return (
    <div className="ph-header">
      {/* Row 1 — arrows flanking the title, page-specific actions on the right */}
      <div className="ph-title-row">
        <div className="ph-title-line">
          {navPrev}
          <h1 className="ph-title">{planName}</h1>
          {navNext}
        </div>
        <div className="ph-actions">
          {canEdit && onEdit && (
            <button className="ph-btn-edit" onClick={onEdit} type="button">
              Editar plano
            </button>
          )}
          {titleAside}
        </div>
      </div>

      {/* Row 2 — state (primary): how is this plan */}
      <div className="ph-meta">
        {dateLine && (
          <span className="ph-meta-item">
            <span className="ph-meta-lbl">Datas</span>
            <span className="ph-meta-dates">{dateLine}</span>
          </span>
        )}
        <span className="ph-meta-item">
          <span className="ph-meta-lbl">Saúde</span>
          {/* A concluded plano has no health to grade: the dot turns neutral, in the
              Concluída pill's colour, instead of showing a red/amber/green verdict. */}
          <span
            className={`ph-health ph-health-${status === 'Concluída' ? 'done' : health.level}`}
            title={status === 'Concluída' ? 'Plano concluído' : health.reasons.join('\n')}
          />
        </span>
        <span className="ph-meta-item">
          <span className="ph-meta-lbl">Estado</span>
          <span className={`status-pill ${planoStatusKey(status)}`}>{status}</span>
        </span>
      </div>

      {/* Row 3 — people (secondary, lighter): who owns it.
          Both fields ALWAYS render, with an em dash when unset, so it is clear the
          fields exist and are merely unfilled. Sponsor first, then owner. */}
      <div className="ph-people">
        <span className="ph-people-item">
          <span className="ph-people-lbl">{sponsorLabel}</span>
          {sponsorNames.length > 0 ? sponsorNames.join(', ') : EMPTY_VALUE}
        </span>
        <span className="ph-people-item">
          <span className="ph-people-lbl">{ownerLabel}</span>
          {ownerNames.length > 0 ? ownerNames.join(', ') : EMPTY_VALUE}
        </span>
      </div>

      {/* Row 4 — synthesis */}
      {narrative && <p className="ph-narrative">{narrative}</p>}

      {children}
    </div>
  )
}
