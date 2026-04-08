import MultiSelect from './MultiSelect'

const STATUS_OPTIONS = ['Não iniciado', 'Em curso', 'Concluído', 'Em risco', 'Atrasado']

export default function FilterBar() {
  return (
    <div className="filter-bar">
      <span className="filter-label">Filtros</span>

      <MultiSelect label="Programa"      options={[]} />
      <MultiSelect label="Eixo"          options={[]} />
      <MultiSelect label="Plano de Ação" options={[]} />
      <MultiSelect label="Responsável"   options={[]} />
      <MultiSelect label="Sponsor"       options={[]} />
      <MultiSelect label="Estado"        options={STATUS_OPTIONS} />

      <button className="filter-clear">Limpar tudo</button>
    </div>
  )
}
