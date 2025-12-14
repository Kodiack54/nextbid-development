'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface TimePunch {
  id: string
  user_id: string
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  status: string
}

interface BreakPeriod {
  id: string
  time_punch_id: string
  break_start: string
  break_end: string | null
  break_type: 'break' | 'lunch'
}

export default function TimeClockDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [clockState, setClockState] = useState<'clocked_out' | 'working' | 'on_break' | 'on_lunch'>('clocked_out')
  const [currentPunch, setCurrentPunch] = useState<TimePunch | null>(null)
  const [currentBreak, setCurrentBreak] = useState<BreakPeriod | null>(null)
  const [duration, setDuration] = useState(0)
  const [needsBreak, setNeedsBreak] = useState(false)
  const [needsLunch, setNeedsLunch] = useState(false)
  const [breakOverdue, setBreakOverdue] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadClockStatus()
      const interval = setInterval(loadClockStatus, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [currentUser])

  useEffect(() => {
    // Update duration every second when clocked in
    if (currentPunch && clockState !== 'clocked_out') {
      const interval = setInterval(() => {
        updateDuration()
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [currentPunch, clockState])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Get user details from dev_users table
      const { data: devUser } = await supabase
        .from('dev_users')
        .select('*')
        .eq('id', user.id)
        .single()

      setCurrentUser(devUser || { id: user.id, email: user.email })
    }
  }

  async function loadClockStatus() {
    if (!currentUser) return

    const today = new Date().toISOString().split('T')[0]

    // Get today's active punch from dev_time_punches
    const { data: punches } = await supabase
      .from('dev_time_punches')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('clock_in', `${today}T00:00:00`)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)

    if (punches && punches.length > 0) {
      const punch = punches[0] as TimePunch
      setCurrentPunch(punch)

      // Check for active break from dev_break_periods
      const { data: breaks } = await supabase
        .from('dev_break_periods')
        .select('*')
        .eq('time_punch_id', punch.id)
        .is('break_end', null)
        .order('break_start', { ascending: false })
        .limit(1)

      if (breaks && breaks.length > 0) {
        const breakPeriod = breaks[0] as BreakPeriod
        setCurrentBreak(breakPeriod)
        setClockState(breakPeriod.break_type === 'lunch' ? 'on_lunch' : 'on_break')
      } else {
        setCurrentBreak(null)
        setClockState('working')
        checkBreakAlerts(punch)
      }

      updateDuration()
    } else {
      setCurrentPunch(null)
      setCurrentBreak(null)
      setClockState('clocked_out')
      setNeedsBreak(false)
      setNeedsLunch(false)
      setBreakOverdue(false)
    }
  }

  function checkBreakAlerts(punch: TimePunch) {
    const hoursWorked = (new Date().getTime() - new Date(punch.clock_in).getTime()) / (1000 * 60 * 60)

    // Check if breaks were taken
    supabase
      .from('dev_break_periods')
      .select('*')
      .eq('time_punch_id', punch.id)
      .then(({ data: breaks }) => {
        const hadBreak = breaks && breaks.some((b: BreakPeriod) => b.break_type === 'break')
        const hadLunch = breaks && breaks.some((b: BreakPeriod) => b.break_type === 'lunch')

        // Set alerts - 3 hours for break, 5.5 hours for lunch
        setNeedsBreak(!hadBreak && hoursWorked >= 3)
        setNeedsLunch(!hadLunch && hoursWorked >= 5.5)
        setBreakOverdue(!hadBreak && hoursWorked >= 5.5) // Red at 5.5 hours if no break
      })
  }

  function updateDuration() {
    if (!currentPunch) return

    if (currentBreak) {
      const breakDuration = (new Date().getTime() - new Date(currentBreak.break_start).getTime()) / 1000
      setDuration(breakDuration)
    } else {
      const workDuration = (new Date().getTime() - new Date(currentPunch.clock_in).getTime()) / 1000
      setDuration(workDuration)
    }
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  async function handleStartWork() {
    if (!currentUser) return

    const { data, error } = await supabase
      .from('dev_time_punches')
      .insert([{
        user_id: currentUser.id,
        clock_in: new Date().toISOString(),
        status: 'active'
      }])
      .select()
      .single()

    if (error) {
      console.error('Error clocking in:', error)
      alert('Error starting work')
      return
    }

    await loadClockStatus()
    setIsOpen(false)
  }

  async function handleStartBreak(breakType: 'break' | 'lunch' = 'break') {
    if (!currentPunch) return

    const { data, error } = await supabase
      .from('dev_break_periods')
      .insert([{
        time_punch_id: currentPunch.id,
        break_start: new Date().toISOString(),
        break_type: breakType
      }])
      .select()
      .single()

    if (error) {
      console.error('Error starting break:', error)
      alert('Error starting break: ' + error.message)
      return
    }

    await loadClockStatus()
    setIsOpen(false)
  }

  async function handleEndBreak() {
    if (!currentBreak) return

    const { error } = await supabase
      .from('dev_break_periods')
      .update({ break_end: new Date().toISOString() })
      .eq('id', currentBreak.id)

    if (error) {
      console.error('Error ending break:', error)
      alert('Error ending break')
      return
    }

    await loadClockStatus()
    setIsOpen(false)
  }

  async function handleEndWork() {
    if (!currentPunch) return

    // End any active break first
    if (currentBreak) {
      await supabase
        .from('dev_break_periods')
        .update({ break_end: new Date().toISOString() })
        .eq('id', currentBreak.id)
    }

    const clockOut = new Date()
    const clockIn = new Date(currentPunch.clock_in)

    // Get all break periods for this punch
    const { data: breaks } = await supabase
      .from('dev_break_periods')
      .select('*')
      .eq('time_punch_id', currentPunch.id)

    // Calculate total lunch time (unpaid - subtract from hours)
    let totalLunchMinutes = 0
    if (breaks) {
      breaks.forEach((b: BreakPeriod) => {
        if (b.break_type === 'lunch' && b.break_start && b.break_end) {
          const lunchStart = new Date(b.break_start)
          const lunchEnd = new Date(b.break_end)
          totalLunchMinutes += (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60)
        }
      })
    }

    // Calculate total hours = (clock_out - clock_in) - lunch_time
    const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
    const workedMinutes = totalMinutes - totalLunchMinutes
    const totalHours = (workedMinutes / 60).toFixed(2)

    const { error } = await supabase
      .from('dev_time_punches')
      .update({
        clock_out: clockOut.toISOString(),
        total_hours: parseFloat(totalHours),
        status: 'completed'
      })
      .eq('id', currentPunch.id)

    if (error) {
      console.error('Error clocking out:', error)
      alert('Error ending work')
      return
    }

    await loadClockStatus()
    setIsOpen(false)
  }

  // Determine icon color and animation
  function getIconClasses() {
    const baseClasses = "w-5 h-5 transition-colors"

    if (breakOverdue) {
      return `${baseClasses} text-red-400 animate-pulse`
    }
    if (needsBreak || needsLunch) {
      return `${baseClasses} text-orange-400 animate-pulse`
    }
    if (clockState === 'on_break' || clockState === 'on_lunch') {
      return `${baseClasses} text-sky-400`
    }
    if (clockState === 'working') {
      return `${baseClasses} text-emerald-400`
    }
    return `${baseClasses} text-gray-400`
  }

  function getButtonClasses() {
    const baseClasses = "w-10 h-10 rounded-xl flex items-center justify-center transition-all"

    if (breakOverdue) {
      return `${baseClasses} bg-red-500/20 hover:bg-red-500/30 border border-red-500/50`
    }
    if (needsBreak || needsLunch) {
      return `${baseClasses} bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50`
    }
    if (clockState === 'on_break' || clockState === 'on_lunch') {
      return `${baseClasses} bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50`
    }
    if (clockState === 'working') {
      return `${baseClasses} bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50`
    }
    return `${baseClasses} bg-gray-700 hover:bg-gray-600 border border-gray-600`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={getButtonClasses()}
        title={
          clockState === 'clocked_out'
            ? 'Time Clock - Not clocked in'
            : clockState === 'working'
            ? `Working - ${formatDuration(duration)}${needsBreak ? ' - Break time!' : ''}${needsLunch ? ' - Lunch time!' : ''}${breakOverdue ? ' - OVERDUE!' : ''}`
            : clockState === 'on_break'
            ? `On Break - ${formatDuration(duration)}`
            : `On Lunch - ${formatDuration(duration)}`
        }
      >
        <Clock className={getIconClasses()} />

        {/* Notification dot for alerts */}
        {(needsBreak || needsLunch || breakOverdue) && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden z-50">
          {clockState === 'clocked_out' && (
            <div className="p-4">
              <div className="text-sm text-gray-400 mb-3 text-center">
                Not clocked in
              </div>
              <button
                onClick={handleStartWork}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <Clock className="w-4 h-4" />
                <span>Start Work</span>
              </button>
            </div>
          )}

          {clockState === 'working' && (
            <div className="p-4">
              <div className="mb-3 pb-3 border-b border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-300">Working</span>
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/50">Active</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatDuration(duration)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Started {currentPunch && new Date(currentPunch.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Break alerts */}
              {(needsBreak || needsLunch || breakOverdue) && (
                <div className={`mb-3 p-2 rounded-lg text-xs ${breakOverdue ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-orange-500/20 border border-orange-500/50 text-orange-300'}`}>
                  {breakOverdue && '🔴 Break overdue! (5.5+ hours)'}
                  {!breakOverdue && needsLunch && '🍽️ Lunch break recommended'}
                  {!breakOverdue && needsBreak && !needsLunch && '☕ Break time approaching'}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => handleStartBreak('break')}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  ☕ Start Break
                </button>
                <button
                  onClick={() => handleStartBreak('lunch')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  🍽️ Start Lunch
                </button>
                <button
                  onClick={handleEndWork}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  🏁 End Work
                </button>
              </div>
            </div>
          )}

          {(clockState === 'on_break' || clockState === 'on_lunch') && (
            <div className="p-4">
              <div className="mb-3 pb-3 border-b border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-300">
                    {clockState === 'on_lunch' ? '🍽️ On Lunch' : '☕ On Break'}
                  </span>
                  <span className="text-xs px-2 py-1 bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/50">Break</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatDuration(duration)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Started {currentBreak && new Date(currentBreak.break_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <button
                onClick={handleEndBreak}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
              >
                ✅ End Break
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
