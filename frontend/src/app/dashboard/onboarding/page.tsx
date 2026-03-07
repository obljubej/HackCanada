'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { organizationAPI } from '@/lib/api'
import Link from 'next/link'

type Step = 'welcome' | 'departments' | 'employees' | 'skills' | 'complete'

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  full_name: string
  email: string
  role: string
  department_id: string
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departmentName, setDepartmentName] = useState('')
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    role: '',
    department_id: '',
  })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/'
        return
      }
      setUser(session.user)
      
      // Check if setup is complete
      const empRes = await organizationAPI.getEmployees()
      if (empRes.employees && empRes.employees.length > 0) {
        window.location.href = '/dashboard'
      }
    }
    checkAuth()
  }, [])

  const addDepartment = async () => {
    if (!departmentName.trim()) return
    
    try {
      setLoading(true)
      const res = await organizationAPI.createDepartment({
        name: departmentName,
      })
      if (res.department) {
        setDepartments([...departments, res.department])
        setDepartmentName('')
      }
    } finally {
      setLoading(false)
    }
  }

  const addEmployee = async () => {
    if (!employeeForm.full_name || !employeeForm.email || !employeeForm.role || !employeeForm.department_id) {
      alert('Please fill all fields')
      return
    }

    try {
      setLoading(true)
      const res = await organizationAPI.createEmployee(employeeForm)
      if (res.employee) {
        setEmployees([...employees, res.employee])
        setEmployeeForm({ full_name: '', email: '', role: '', department_id: '' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 'welcome') setStep('departments')
    else if (step === 'departments' && departments.length > 0) setStep('employees')
    else if (step === 'employees' && employees.length > 0) setStep('complete')
  }

  const handleSkip = () => {
    if (step === 'departments') setStep('employees')
    else if (step === 'employees') setStep('complete')
  }

  return (
    <div className="min-h-screen bg-black p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        {/* Logo/Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">RelAI</h1>
          <p className="text-gray-300">AI-Powered Team Intelligence</p>
        </div>

        {step === 'welcome' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to RelAI</h2>
            <p className="text-gray-300 text-lg mb-8">
              Let's set up your company hierarchy. In a few quick steps, you'll be able to create projects and let AI automatically find and assign the perfect team members.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🏢</span>
                <div>
                  <p className="text-white font-medium">Set Up Departments</p>
                  <p className="text-gray-400 text-sm">Define your organizational structure</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-3xl">👥</span>
                <div>
                  <p className="text-white font-medium">Add Employees</p>
                  <p className="text-gray-400 text-sm">Build your team roster</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-3xl">⚡</span>
                <div>
                  <p className="text-white font-medium">AI Takes Over</p>
                  <p className="text-gray-400 text-sm">Create projects and let AI handle the rest</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Let's Get Started
            </button>
          </div>
        )}

        {step === 'departments' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-2">Step 1: Create Departments</h2>
            <p className="text-gray-300 mb-8">Set up your company departments (e.g., Engineering, Marketing, Design)</p>

            <div className="space-y-4 mb-8">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Engineering"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
                  className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={addDepartment}
                  disabled={loading || !departmentName.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Add
                </button>
              </div>

              {departments.length > 0 && (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-3 bg-white/10 rounded-lg text-white flex items-center gap-2">
                      <span>🏢</span>
                      <span>{dept.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={departments.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'employees' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-2">Step 2: Add Employees</h2>
            <p className="text-gray-300 mb-8">Add your team members to the system</p>

            <div className="space-y-4 mb-8">
              <input
                type="text"
                placeholder="Full Name"
                value={employeeForm.full_name}
                onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
              <input
                type="email"
                placeholder="Email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
              <input
                type="text"
                placeholder="Role (e.g., Senior Engineer)"
                value={employeeForm.role}
                onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
              {departments.length > 0 && (
                <select
                  value={employeeForm.department_id}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, department_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={addEmployee}
                disabled={loading}
                className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Add Employee
              </button>

              {employees.length > 0 && (
                <div className="space-y-2 mt-6">
                  {employees.map((emp) => (
                    <div key={emp.id} className="p-3 bg-white/10 rounded-lg text-white">
                      <p className="font-medium">{emp.full_name}</p>
                      <p className="text-sm text-gray-400">{emp.role} • {emp.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={employees.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-6">✨</div>
            <h2 className="text-3xl font-bold text-white mb-4">You're All Set!</h2>
            <p className="text-gray-300 text-lg mb-8">
              Your company hierarchy is ready. Now create projects and let AI find the best team members automatically.
            </p>

            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
