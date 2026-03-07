'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notificationsAPI } from '@/lib/api'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message?: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/'
        return
      }
      setCurrentUser(session.user)
      await loadNotifications(session.user.id)
    }
    getUser()
  }, [])

  const loadNotifications = async (userId: string) => {
    try {
      setLoading(true)
      const res = await notificationsAPI.getNotifications(userId)
      if (res.notifications) {
        setNotifications(res.notifications)
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await notificationsAPI.markAsRead(notifId)
      setNotifications(
        notifications.map((n) =>
          n.id === notifId ? { ...n, is_read: true } : n
        )
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const handleDelete = async (notifId: string) => {
    try {
      await notificationsAPI.deleteNotification(notifId)
      setNotifications(notifications.filter((n) => n.id !== notifId))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications

  const typeColors: Record<string, string> = {
    project_assignment: 'bg-blue-500/20 text-blue-300',
    skill_recommendation: 'bg-yellow-500/20 text-yellow-300',
    meeting_invite: 'bg-purple-500/20 text-purple-300',
    deadline: 'bg-red-500/20 text-red-300',
    update: 'bg-green-500/20 text-green-300',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-pink-500 rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Notifications</h1>
            <p className="text-gray-400">
              {filteredNotifications.length} {filter === 'unread' ? 'unread' : ''}{' '}
              notification{filteredNotifications.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            ← Back
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'unread'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Unread
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-6 rounded-lg border transition ${
                notif.is_read
                  ? 'bg-gray-800/30 border-gray-700'
                  : 'bg-gray-800/50 border-purple-500/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        typeColors[notif.type] ||
                        'bg-gray-600/20 text-gray-300'
                      }`}
                    >
                      {notif.type.replace(/_/g, ' ')}
                    </span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {notif.title}
                  </h3>
                  {notif.message && (
                    <p className="text-gray-400 text-sm mb-3">
                      {notif.message}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs">
                    {new Date(notif.created_at).toLocaleDateString()}{' '}
                    {new Date(notif.created_at).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition"
                    >
                      Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">
              {filter === 'unread'
                ? 'No unread notifications'
                : 'No notifications yet'}
            </p>
            <Link
              href="/dashboard"
              className="inline-block text-purple-400 hover:text-purple-300"
            >
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
