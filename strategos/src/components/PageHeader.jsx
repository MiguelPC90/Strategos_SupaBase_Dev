export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-sub">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  )
}
