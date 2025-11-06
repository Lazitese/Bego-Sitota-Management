import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function MentorDashboard() {
  const { profile, signOut } = useAuth()
  const [assignedStudents, setAssignedStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('students') // 'students', 'academic', 'reports', 'weekly'

  // Navigation items for mobile menu
  const navigationItems = [
    { id: 'students', label: 'Students', icon: '🎓' },
    { id: 'academic', label: 'Academic', icon: '📋' },
    { id: 'reports', label: 'Sessions', icon: '📝' },
    { id: 'weekly', label: 'Weekly', icon: '📅' },
  ]

  // Academic Reports State
  const [pendingAcademicReports, setPendingAcademicReports] = useState([])

  // Mentor Session Reports State
  const [sessionReports, setSessionReports] = useState([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionFormData, setSessionFormData] = useState({
    student_id: '',
    session_date: '',
    session_type: 'academic',
    summary: '',
    student_progress: '',
    challenges_identified: '',
    next_steps: '',
  })

  // Weekly Reports State (for assigned students)
  const [weeklyReports, setWeeklyReports] = useState([])

  useEffect(() => {
    fetchAssignedStudents()
  }, [profile?.id])

  useEffect(() => {
    if (activeTab === 'academic' && profile?.id) {
      fetchPendingAcademicReports()
    } else if (activeTab === 'reports' && profile?.id) {
      fetchSessionReports()
    } else if (activeTab === 'weekly' && profile?.id) {
      fetchWeeklyReports()
    }
  }, [activeTab, profile?.id])

  const fetchAssignedStudents = async () => {
    try {
      setLoading(true)

      if (!profile?.id) {
        setAssignedStudents([])
        setLoading(false)
        return
      }

      // Fetch ALL students assigned to this mentor from the students table (source of truth)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, school_name, grade_level, gpa, status, mentor_id')
        .eq('mentor_id', profile.id)

      if (studentsError) {
        console.error('Error fetching assigned students:', studentsError)
        throw studentsError
      }

      if (!studentsData || studentsData.length === 0) {
        setAssignedStudents([])
        setLoading(false)
        return
      }

      // Get student IDs
      const studentIds = studentsData.map(s => s.id)

      // Fetch student profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds)

      if (profilesError) {
        console.warn('Error fetching student profiles:', profilesError)
      }

      // Fetch sponsorship links for these students (to get donor info)
      const { data: linksData, error: linksError } = await supabase
        .from('sponsorship_links')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'active')

      if (linksError) {
        console.warn('Error fetching sponsorship links:', linksError)
      }

      // Get donor IDs from sponsorship links
      const donorIds = [...new Set((linksData || []).map(l => l.donor_id).filter(Boolean))]
      
      // Fetch donor profiles
      let donorsData = []
      if (donorIds.length > 0) {
        const { data: d } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', donorIds)
        donorsData = d || []
      }

      // Build a map of student_id -> sponsorship link
      const linksByStudentId = {}
      if (linksData && linksData.length > 0) {
        linksData.forEach(link => {
          linksByStudentId[link.student_id] = link
        })
      }

      // Merge data: create a list of students with their sponsorship info
      const assignedStudentsList = studentsData.map(student => {
        const profileData = profilesData?.find(p => p.id === student.id)
        const link = linksByStudentId[student.id]
        const donor = link ? donorsData.find(d => d.id === link.donor_id) : null

        return {
          id: link?.id || student.id, // Use link ID if exists, otherwise use student ID
          student_id: student.id,
          student: {
            id: student.id,
            school_name: student.school_name,
            grade_level: student.grade_level,
            gpa: student.gpa,
            status: student.status,
            profiles: profileData ? {
              full_name: profileData.full_name,
              email: profileData.email,
            } : null,
          },
          donor: donor || null,
          start_date: link?.start_date || null,
          annual_amount: link?.annual_amount || null,
          status: link?.status || 'unsponsored', // 'active' if sponsored, 'unsponsored' if not
          hasSponsorship: !!link,
        }
      })

      console.log('Assigned students:', assignedStudentsList)
      setAssignedStudents(assignedStudentsList)
    } catch (error) {
      console.error('Error fetching assigned students:', error)
      setError('Failed to load assigned students')
      setAssignedStudents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingAcademicReports = async () => {
    try {
      // Get assigned student IDs
      const studentIds = assignedStudents.map(s => s.student_id).filter(Boolean)
      
      if (studentIds.length === 0) {
        setPendingAcademicReports([])
        return
      }

      // Fetch pending academic reports for assigned students
      const { data: academicData, error: academicError } = await supabase
        .from('academic_reports')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (academicError) throw academicError

      // Fetch student profiles
      if (academicData && academicData.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)

        academicData.forEach(report => {
          report.student = profilesData?.find(p => p.id === report.student_id)
        })
      }

      setPendingAcademicReports(academicData || [])
    } catch (error) {
      console.error('Error fetching pending academic reports:', error)
      setError('Failed to load pending academic reports')
    }
  }

  const fetchSessionReports = async () => {
    try {
      const { data, error } = await supabase
        .from('mentor_session_reports')
        .select('*')
        .eq('mentor_id', profile?.id)
        .order('session_date', { ascending: false })

      if (error) throw error

      // Fetch student profiles
      if (data && data.length > 0) {
        const studentIds = [...new Set(data.map(r => r.student_id).filter(Boolean))]
        if (studentIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentIds)

          data.forEach(report => {
            report.student = profilesData?.find(p => p.id === report.student_id)
          })
        }
      }

      setSessionReports(data || [])
    } catch (error) {
      console.error('Error fetching session reports:', error)
      setError('Failed to load session reports')
    }
  }

  const fetchWeeklyReports = async () => {
    try {
      // Get assigned student IDs
      const studentIds = assignedStudents.map(s => s.student_id).filter(Boolean)
      
      if (studentIds.length === 0) {
        setWeeklyReports([])
        return
      }

      // Fetch weekly reports for assigned students
      const { data, error } = await supabase
        .from('weekly_volunteer_reports')
        .select('*')
        .in('student_id', studentIds)
        .order('week_start_date', { ascending: false })

      if (error) throw error

      // Fetch student profiles
      if (data && data.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)

        data.forEach(report => {
          report.student = profilesData?.find(p => p.id === report.student_id)
        })
      }

      setWeeklyReports(data || [])
    } catch (error) {
      console.error('Error fetching weekly reports:', error)
      setError('Failed to load weekly reports')
    }
  }

  const handleApproveAcademicReport = async (reportId, notes = '') => {
    try {
      const { error } = await supabase
        .from('academic_reports')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          reviewer_role: 'mentor',
          mentor_notes: notes || null,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Academic report approved')
      fetchPendingAcademicReports()
    } catch (error) {
      console.error('Error approving academic report:', error)
      setError(error.message || 'Failed to approve academic report')
    }
  }

  const handleRejectAcademicReport = async (reportId, notes = '') => {
    try {
      const { error } = await supabase
        .from('academic_reports')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          reviewer_role: 'mentor',
          mentor_notes: notes || null,
          can_resubmit: true,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Academic report rejected')
      fetchPendingAcademicReports()
    } catch (error) {
      console.error('Error rejecting academic report:', error)
      setError(error.message || 'Failed to reject academic report')
    }
  }

  const handleSessionReportSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase
        .from('mentor_session_reports')
        .insert({
          mentor_id: profile?.id,
          student_id: sessionFormData.student_id,
          session_date: sessionFormData.session_date,
          session_type: sessionFormData.session_type,
          summary: sessionFormData.summary,
          student_progress: sessionFormData.student_progress || null,
          challenges_identified: sessionFormData.challenges_identified || null,
          next_steps: sessionFormData.next_steps || null,
        })
        .select()
        .single()

      if (error) throw error

      setSuccess('Mentor session report submitted successfully!')
      setShowSessionForm(false)
      setSessionFormData({
        student_id: '',
        session_date: '',
        session_type: 'academic',
        summary: '',
        student_progress: '',
        challenges_identified: '',
        next_steps: '',
      })
      fetchSessionReports()
    } catch (error) {
      console.error('Error submitting session report:', error)
      setError(error.message || 'Failed to submit session report')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-md border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Mentor Dashboard</h1>
            <div className="hidden lg:flex items-center space-x-4">
              <span className="text-gray-700 font-medium">
                Welcome, {profile?.full_name || 'Mentor'}
              </span>
              <button
                onClick={signOut}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Sign Out
              </button>
            </div>
            <div className="lg:hidden flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'M'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">🎓</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Assigned Students</h3>
              <p className="text-3xl font-bold text-green-600">{assignedStudents.length}</p>
            </div>
          </div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-200/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📋</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Academic Reports</h3>
              <p className="text-3xl font-bold text-yellow-600">{pendingAcademicReports.length}</p>
            </div>
          </div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-200/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📝</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Session Reports</h3>
              <p className="text-3xl font-bold text-indigo-600">{sessionReports.length}</p>
            </div>
          </div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📅</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Weekly Reports</h3>
              <p className="text-3xl font-bold text-blue-600">{weeklyReports.length}</p>
            </div>
          </div>
        </div>

        {/* Tabs - Desktop */}
        <div className="hidden lg:block bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl border border-white/20 mb-6">
          <div className="border-b border-gray-200/50">
            <nav className="flex -mb-px">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                    activeTab === item.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.id === 'students' ? 'Assigned Students' : item.id === 'academic' ? 'Academic Reports' : item.id === 'reports' ? 'Session Reports' : 'Weekly Reports'}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Assigned Students Tab */}
        {activeTab === 'students' && (
          <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">My Assigned Students</h2>
            </div>
            {loading ? (
              <div className="p-6 text-center">Loading...</div>
            ) : assignedStudents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No students assigned yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sponsor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assignedStudents.map((link) => (
                      <tr key={link.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {link.student?.profiles?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.student?.school_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.student?.grade_level || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.student?.gpa || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.donor?.full_name || 'No sponsor'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.start_date ? new Date(link.start_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.annual_amount ? `$${link.annual_amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            link.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {link.hasSponsorship ? link.status : 'Unsponsored'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Academic Reports Tab */}
        {activeTab === 'academic' && (
          <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Pending Academic Reports for Review</h2>
            </div>
            {pendingAcademicReports.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No pending academic reports</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingAcademicReports.map((report) => (
                      <tr key={report.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.student?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.semester}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.academic_year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.gpa || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.courses_completed || 0}/{report.courses_enrolled || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(report.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveAcademicReport(report.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectAcademicReport(report.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Session Reports Tab */}
        {activeTab === 'reports' && (
          <>
            <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl border border-white/20 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Mentor Session Reports</h2>
                <button
                  onClick={() => setShowSessionForm(!showSessionForm)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                >
                  {showSessionForm ? 'Cancel' : '+ Submit Report'}
                </button>
              </div>

              {showSessionForm && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Submit Mentor Session Report</h3>
                  <form onSubmit={handleSessionReportSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Student *
                        </label>
                        <select
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={sessionFormData.student_id}
                          onChange={(e) => setSessionFormData({ ...sessionFormData, student_id: e.target.value })}
                        >
                          <option value="">Select Student...</option>
                          {assignedStudents.map((link) => (
                            <option key={link.student_id} value={link.student_id}>
                              {link.student?.profiles?.full_name || 'Student'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Session Date *
                        </label>
                        <input
                          type="date"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={sessionFormData.session_date}
                          onChange={(e) => setSessionFormData({ ...sessionFormData, session_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Session Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={sessionFormData.session_type}
                          onChange={(e) => setSessionFormData({ ...sessionFormData, session_type: e.target.value })}
                        >
                          <option value="academic">Academic</option>
                          <option value="personal">Personal</option>
                          <option value="career">Career</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Summary *
                      </label>
                      <textarea
                        required
                        rows="4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={sessionFormData.summary}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, summary: e.target.value })}
                        placeholder="Describe the session..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Progress
                      </label>
                      <textarea
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={sessionFormData.student_progress}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, student_progress: e.target.value })}
                        placeholder="Describe student's progress..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Challenges Identified
                      </label>
                      <textarea
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={sessionFormData.challenges_identified}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, challenges_identified: e.target.value })}
                        placeholder="Identify any challenges..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Next Steps
                      </label>
                      <textarea
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={sessionFormData.next_steps}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, next_steps: e.target.value })}
                        placeholder="Outline next steps..."
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
                      >
                        Submit Report
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSessionForm(false)
                          setSessionFormData({
                            student_id: '',
                            session_date: '',
                            session_type: 'academic',
                            summary: '',
                            student_progress: '',
                            challenges_identified: '',
                            next_steps: '',
                          })
                        }}
                        className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                {sessionReports.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No session reports submitted yet</div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sessionReports.map((report) => (
                        <tr key={report.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {report.student?.full_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(report.session_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.session_type || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">
                              {report.summary}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(report.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* Weekly Reports Tab */}
        {activeTab === 'weekly' && (
          <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Weekly Volunteer Reports (Assigned Students)</h2>
            </div>
            {weeklyReports.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No weekly reports from assigned students yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {weeklyReports.map((report) => (
                      <tr key={report.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.student?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(report.week_start_date).toLocaleDateString()} - {new Date(report.week_end_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.volunteer_hours || '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.location || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(report.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </main>

      {/* Bottom Menu - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 shadow-lg z-20 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[60px] transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                  : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium truncate max-w-[60px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
