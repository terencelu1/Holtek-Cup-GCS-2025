import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

export default function Layout({ children, connected, activeVehicleId, onSelectVehicle, vehicles }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="w-screen h-screen bg-ui-bg text-ui-text-primary font-sans overflow-hidden flex flex-col">
            {/* Top Bar */}
            <header className="h-14 bg-white/90 backdrop-blur-md border-b border-ui-panel-border flex items-center px-4 justify-between shrink-0 z-50 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                    >
                        <i className="fas fa-bars text-lg"></i>
                    </button>

                    <div className="text-xl font-bold tracking-wider text-ui-text-primary flex items-center gap-2">
                        <div className="w-3 h-3 bg-neon-cyan rounded-full animate-pulse shadow-[0_0_10px_#06b6d4]"></div>
                        UAV × UGV Control Center
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Connection Status */}
                    <div className={clsx(
                        "px-2 py-0.5 rounded text-xs font-mono border",
                        connected ? "bg-emerald-50 text-status-ok border-emerald-200" : "bg-red-50 text-status-err border-red-200"
                    )}>
                        {connected ? "SYSTEM ONLINE" : "DISCONNECTED"}
                    </div>

                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold">{new Date().toLocaleTimeString()}</div>
                        <div className="text-xs text-gray-400">DEC 09 2025</div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Global Sidebar - Animated */}
                <aside className={clsx(
                    "bg-white/80 backdrop-blur-md border-r border-ui-panel-border flex flex-col py-4 z-40 transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
                    isSidebarOpen ? "w-64" : "w-16 items-center"
                )}>
                    <nav className="flex flex-col gap-1 px-2 whitespace-nowrap w-full">
                        <NavItem to="/" icon="fas fa-tachometer-alt" label="Overview" collapsed={!isSidebarOpen} />
                        <NavItem to="/map" icon="fas fa-map" label="Map & Mission" collapsed={!isSidebarOpen} />
                        <NavItem to="/performance" icon="fas fa-chart-line" label="Performance" collapsed={!isSidebarOpen} />
                        <NavItem to="/system" icon="fas fa-cog" label="System" collapsed={!isSidebarOpen} />
                    </nav>

                    <div className={clsx(
                        "mt-auto py-4 text-xs text-gray-400 border-t border-gray-100 transition-all overflow-hidden flex flex-col",
                        isSidebarOpen ? "px-4" : "px-0 items-center opacity-70"
                    )}>
                        {isSidebarOpen ? (
                            <>
                                <div className="font-bold">DEVICE STATUS</div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-green-500" : "bg-red-500")}></div>
                                    Backend Connection
                                </div>
                            </>
                        ) : (
                            <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-green-500" : "bg-red-500")} title="Backend Connection"></div>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-hidden relative bg-gray-50 flex flex-col min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavItem({ to, icon, label, disabled, collapsed }) {
    if (disabled) {
        return (
            <div className={clsx(
                "px-4 py-3 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed flex items-center transition-all",
                collapsed ? "justify-center" : "gap-3"
            )}>
                <i className={`${icon} w-5 text-center`}></i>
                {!collapsed && <span>{label}</span>}
            </div>
        );
    }
    return (
        <NavLink to={to} className={({ isActive }) => clsx(
            "rounded-lg text-sm font-medium transition-all flex items-center group relative overflow-hidden",
            collapsed ? "justify-center w-10 h-10 mx-auto" : "px-4 py-3 gap-3 w-full",
            isActive
                ? "bg-neon-cyan/5 text-neon-cyan shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
        )}>
            {({ isActive }) => (
                <>
                    {isActive && !collapsed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-cyan"></div>}
                    <i className={clsx(
                        `${icon} transition-transform group-hover:scale-110`,
                        isActive && "text-neon-cyan",
                        collapsed ? "text-lg" : "w-5 text-center"
                    )}></i>
                    {!collapsed && <span>{label}</span>}
                </>
            )}
        </NavLink>
    );
}
