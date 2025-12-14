'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'

interface SettingsDropdownProps {
  user?: any
}

export default function SettingsDropdown({ user }: SettingsDropdownProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Dev Command Center settings structure
  const settingsStructure = {
    servers: {
      title: '🖥️ SERVERS',
      items: [
        { label: 'Engine Slots', path: '/settings/engine-slots', description: 'Assign tradelines to slots', permission: 'canManageServers' },
        { label: 'Patcher Config', path: '/settings/patcher', description: 'API endpoints & deployment', permission: 'canManageServers' },
        { label: 'Environment Variables', path: '/settings/env-vars', description: 'Server .env configuration', permission: 'canManageServers' },
      ]
    },
    credentials: {
      title: '🔑 CREDENTIALS',
      items: [
        { label: 'API Keys', path: '/settings/api-keys', description: 'Claude, OpenAI, Supabase', permission: 'canManageCredentials' },
        { label: 'Source Logins', path: '/settings/source-logins', description: 'SAM.gov, PlanetBids, etc.', permission: 'canManageCredentials' },
        { label: 'SSH Keys', path: '/settings/ssh-keys', description: 'Server access keys', permission: 'canManageCredentials' },
      ]
    },
    team: {
      title: '👥 TEAM',
      items: [
        { label: 'Team Members', path: '/team/members', description: 'Staff accounts & access', permission: 'canManageTeam' },
        { label: 'Roles & Permissions', path: '/team/roles', description: 'Access control settings', permission: 'canManageTeam' },
        { label: 'Timesheets', path: '/settings/timesheets', description: 'Time tracking settings', permission: 'canManageTeam' },
      ]
    },
    alerts: {
      title: '🔔 ALERTS',
      items: [
        { label: 'Alert Rules', path: '/settings/alert-rules', description: 'When to notify', permission: 'canManageAlerts' },
        { label: 'Notification Channels', path: '/settings/notifications', description: 'Slack, email, SMS', permission: 'canManageAlerts' },
        { label: 'Health Thresholds', path: '/settings/health-thresholds', description: 'Server health limits', permission: 'canManageAlerts' },
      ]
    },
    system: {
      title: '⚙️ SYSTEM',
      items: [
        { label: 'Dashboard Settings', path: '/settings/dashboard', description: 'UI preferences', permission: 'canManageSystem' },
        { label: 'Audit Logs', path: '/settings/audit-logs', description: 'System activity history', permission: 'canManageSystem' },
        { label: 'Database', path: '/settings/database', description: 'Supabase connection', permission: 'canManageSystem' },
      ]
    },
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getVisibleSections = () => {
    // For now, show all sections (later filter by user permissions)
    return settingsStructure
  }

  const visibleSections = getVisibleSections()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center transition-colors border border-gray-600"
        title="Settings"
      >
        <Settings className="w-5 h-5 text-gray-300" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 rounded-xl shadow-xl border border-gray-700 py-4 z-50 bg-gray-800" style={{ minWidth: '650px' }}>
            <div className="px-4 pb-3 border-b border-gray-700">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">⚙️ DEV COMMAND CENTER SETTINGS</p>
            </div>

            <div className="grid grid-cols-3 gap-4 px-4 pt-4">
              {/* Column 1 */}
              <div className="space-y-4">
                {visibleSections.servers && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">{visibleSections.servers.title}</p>
                    <div className="space-y-1">
                      {visibleSections.servers.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { router.push(item.path); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                        >
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {visibleSections.alerts && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">{visibleSections.alerts.title}</p>
                    <div className="space-y-1">
                      {visibleSections.alerts.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { router.push(item.path); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                        >
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2 */}
              <div className="space-y-4">
                {visibleSections.credentials && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">{visibleSections.credentials.title}</p>
                    <div className="space-y-1">
                      {visibleSections.credentials.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { router.push(item.path); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                        >
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {visibleSections.system && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">{visibleSections.system.title}</p>
                    <div className="space-y-1">
                      {visibleSections.system.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { router.push(item.path); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                        >
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3 */}
              <div className="space-y-4">
                {visibleSections.team && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">{visibleSections.team.title}</p>
                    <div className="space-y-1">
                      {visibleSections.team.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { router.push(item.path); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                        >
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold mb-2">🔗 QUICK LINKS</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => { router.push('/dev-controls'); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                    >
                      <p className="font-medium text-sm">Dev Controls</p>
                      <p className="text-xs text-gray-500">Deploy, SSH, Git, Logs</p>
                    </button>
                    <button
                      onClick={() => { router.push('/helpdesk'); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-all rounded-lg"
                    >
                      <p className="font-medium text-sm">Helpdesk</p>
                      <p className="text-xs text-gray-500">System & user tickets</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
