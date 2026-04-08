import Card from '../components/Card'
import Table from '../components/Table'

const PESSOAS_COLS = [
  { key: 'nome', label: 'Nome', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'unidade', label: 'Unidade orgânica', sortable: true },
  { key: 'perfil', label: 'Perfil', sortable: true },
  { key: 'tipo', label: 'Tipo', sortable: true },
]

const FTE_COLS = [
  { key: 'pessoa', label: 'Pessoa', sortable: true },
  { key: 'plano', label: 'Plano de Ação', sortable: true },
  { key: 'fte', label: 'FTE', sortable: true },
  { key: 'dias_uteis', label: 'Dias úteis', sortable: true },
]

export default function GestaoRecursos() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        title="Catálogo de pessoas"
        actions={<button className="topbar-btn" style={{ fontSize: 11 }}>+ Nova pessoa</button>}
      >
        <Table columns={PESSOAS_COLS} rows={[]} emptyMessage="Sem pessoas no catálogo" />
      </Card>

      <Card title="Alocações FTE">
        <Table columns={FTE_COLS} rows={[]} emptyMessage="Sem alocações registadas" />
      </Card>
    </div>
  )
}
