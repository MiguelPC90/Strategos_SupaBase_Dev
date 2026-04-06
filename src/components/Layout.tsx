import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useUser } from '../context/UserContext'

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false)
    const { user, signOut } = useUser()

    useEffect(() => {
        document.body.classList.toggle('sidebar-collapsed', collapsed)
    }, [collapsed])

    return (
        <div className="app-shell">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
            <div className="content">
                <Topbar
                    userName={user?.display_name || 'Utilizador'}
                    onToggle={() => setCollapsed((value) => !value)}
                    onLogout={async () => {
                        try {
                            await signOut()
                        } catch (error) {
                            console.error('Logout falhou', error)
                        }
                    }}
                />
                <main className="page-container">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
