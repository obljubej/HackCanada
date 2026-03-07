'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { projectsAPI, organizationAPI } from '@/lib/api'
import Link from 'next/link'

export default function CreateProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    required_roles: '',
    required_skills: '',
    team_size_recommended: '',
    complexity_level: 'medium',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('You must be logged in')
        return
      }

      // Get current user's employee ID
      const { data: employee } = await organizationAPI.getEmployee(session.user.id)

      const requiredRoles = formData.required_roles
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r)

      const requiredSkills = formData.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s)

      const res = await projectsAPI.createProject({
        name: formData.name,
        description: formData.description,
        required_roles: requiredRoles,
        required_skills: requiredSkills,
        team_size_recommended: formData.team_size_recommended
          ? parseInt(formData.team_size_recommended)
          : undefined,
        complexity_level: formData.complexity_level,
        created_by: employee?.id || session.user.id,
      })

      if (res.project) {
        router.push(`/dashboard/projects/${res.project.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/projects"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Create New Project</h1>
          <p className="text-gray-400">
            Define the project requirements and let AI recommend the best team
          </p>
        </div>

        {/* Form */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-white font-medium mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="e.g., Mobile App Redesign"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-white font-medium mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the project goals, scope, and requirements..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Required Roles */}
            <div>
              <label className="block text-white font-medium mb-2">
                Required Roles
              </label>
              <input
                type="text"
                value={formData.required_roles}
                onChange={(e) =>
                  setFormData({ ...formData, required_roles: e.target.value })
                }
                placeholder="e.g., Frontend Engineer, Backend Engineer, Product Manager (comma-separated)"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Required Skills */}
            <div>
              <label className="block text-white font-medium mb-2">
                Required Skills
              </label>
              <input
                type="text"
                value={formData.required_skills}
                onChange={(e) =>
                  setFormData({ ...formData, required_skills: e.target.value })
                }
                placeholder="e.g., React, TypeScript, Node.js (comma-separated)"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Team Size & Complexity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white font-medium mb-2">
                  Recommended Team Size
                </label>
                <input
                  type="number"
                  value={formData.team_size_recommended}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      team_size_recommended: e.target.value,
                    })
                  }
                  placeholder="e.g., 5"
                  min="1"
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">
                  Complexity Level
                </label>
                <select
                  value={formData.complexity_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      complexity_level: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white transition font-medium"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              💡 <strong>Tip:</strong> Once you create the project, AI will analyze
              the requirements and recommend the best team members from your
              organization.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
