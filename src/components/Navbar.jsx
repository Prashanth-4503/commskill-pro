import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, Timer, FileText, Activity, History } from 'lucide-react';
import './Navbar.css';

const navItems = [
    { to: '/', label: 'Dashboard', icon: Activity, exact: true },
    { to: '/live-assistant', label: 'Live Assistant', icon: MessageSquare },
    { to: '/group-discussion', label: 'Group Discussion', icon: Users },
    { to: '/jam', label: 'JAM', icon: Timer },
    { to: '/grammar', label: 'Grammar Check', icon: FileText },
    { to: '/history', label: 'History', icon: History },
];

export default function Navbar() {
    const location = useLocation();

    return (
        <header className="navbar">
            <div className="navbar-inner container">
                <NavLink to="/" className="navbar-brand">
                    <div className="brand-logo">CS</div>
                    <div className="brand-text">
                        <span className="brand-title">CommSkill Pro</span>
                        <span className="brand-tagline">Interview Preparation Platform</span>
                    </div>
                </NavLink>

                <nav className="navbar-nav">
                    {navItems.map(({ to, label, icon: Icon, exact }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={exact}
                            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        >
                            <Icon size={16} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="navbar-badge">
                    <span className="badge badge-navy">Beta</span>
                </div>
            </div>
        </header>
    );
}
