import MultiSelect from './MultiSelect'

const STATUS_OPTIONS = ['Não iniciado', 'Em curso', 'Concluído', 'Em risco', 'Atrasado']

export default function FilterBar() {
  return (
    <div className="filter-bar">
      <span className="filter-label">Filtros</span>

      <MultiSelect label="Programa"      options={[]} placeholder="Todos" />
      <MultiSelect label="Eixo"          options={[]} placeholder="Todos" />
      <MultiSelect label="Plano de Ação" options={[]} placeholder="Todos" />
      <MultiSelect label="Responsável"   options={[]} placeholder="Todos" />
      <MultiSelect label="Sponsor"       options={[]} placeholder="Todos" />
      <MultiSelect label="Estado"        options={STATUS_OPTIONS} placeholder="Todos" />

      <button className="filter-clear">Limpar tudo</button>
    </div>
  )
}
