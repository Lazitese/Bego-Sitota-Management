import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  FiUsers, 
  FiFileText, 
  FiEdit3, 
  FiCalendar, 
  FiSearch,
  FiLogOut
} from 'react-icons/fi'
import logo from '../assets/logo.jpg'

export default function MentorDashboard() {
  const { profile, signOut } = useAuth()
  const [assignedStudents, setAssignedStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('students') // 'students', 'academic', 'reports', 'weekly'

  // Mobile Profile Menu State
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false)

  // Navigation items
  const navigationItems = [
    { id: 'students', label: 'Students', icon: FiUsers },
    { id: 'academic', label: 'Academic', icon: FiFileText },
    { id: 'reports', label: 'Sessions', icon: FiEdit3 },
    { id: 'weekly', label: 'Weekly', icon: FiCalendar },
  ]

  const [searchQuery, setSearchQuery] = useState('')

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

  // Close mobile profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMobileProfileMenu && !event.target.closest('.mobile-profile-menu')) {
        setShowMobileProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMobileProfileMenu])

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
        if (import.meta.env.DEV) {
          console.error('Error fetching assigned students:', studentsError)
        }
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
        if (import.meta.env.DEV) {
          console.warn('Error fetching student profiles:', profilesError)
        }
      }

      // Fetch sponsorship links for these students (to get donor info)
      const { data: linksData, error: linksError } = await supabase
        .from('sponsorship_links')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'active')

      if (linksError) {
        if (import.meta.env.DEV) {
          console.warn('Error fetching sponsorship links:', linksError)
        }
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

      setAssignedStudents(assignedStudentsList)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching assigned students:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error fetching pending academic reports:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error fetching session reports:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error fetching weekly reports:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error approving academic report:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error rejecting academic report:', error)
      }
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
      if (import.meta.env.DEV) {
        console.error('Error submitting session report:', error)
      }
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
    <div className="min-h-screen bg-white flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white border-r border-gray-200">
          {/* Brand Section */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
            <div className="flex-shrink-0 w-10 h-10 relative">
              <img 
                src={logo} 
                alt="Bego Sitota Logo" 
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <h1 className="text-lg font-bold text-black">Bego Sitota</h1>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const IconComponent = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-700'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Sidebar Footer - User Profile */}
          <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'M'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black truncate">
                  {profile?.full_name || 'Mentor'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {profile?.email || 'mentor@example.com'}
                </p>
              </div>
              <button
                onClick={signOut}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-200 flex-shrink-0"
                title="Sign Out"
              >
                <FiLogOut className="w-5 h-5 text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 bg-gray-50">
        {/* Top Header - Mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex-shrink-0 w-10 h-10 relative">
              <img 
                src={logo} 
                alt="Bego Sitota Logo" 
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="relative mobile-profile-menu">
              <button
                onClick={() => setShowMobileProfileMenu(!showMobileProfileMenu)}
                className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'M'}
              </button>
              
              {/* Mobile Profile Menu Dropdown */}
              {showMobileProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-black">
                      {profile?.full_name || 'Mentor'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {profile?.email || 'mentor@example.com'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMobileProfileMenu(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors duration-200"
                  >
                    <FiLogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8">
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

            {/* Page Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black">
                {navigationItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to Mentor Dashboard'}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6 mb-6">
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiUsers className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Assigned Students</p>
                <p className="text-3xl font-bold text-black">{assignedStudents.length}</p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiFileText className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Pending Academic Reports</p>
                <p className="text-3xl font-bold text-black">{pendingAcademicReports.length}</p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiEdit3 className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Session Reports</p>
                <p className="text-3xl font-bold text-black">{sessionReports.length}</p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiCalendar className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Weekly Reports</p>
                <p className="text-3xl font-bold text-black">{weeklyReports.length}</p>
              </div>
            </div>

            {/* Assigned Students Tab */}
            {activeTab === 'students' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Mentor Session Reports</h2>
                <button
                  onClick={() => setShowSessionForm(!showSessionForm)}
                  className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm"
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                          value={sessionFormData.session_date}
                          onChange={(e) => setSessionFormData({ ...sessionFormData, session_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Session Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
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
                        className="bg-orange-500 text-white px-6 py-2 rounded-md hover:bg-orange-600"
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20 safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {navigationItems.map((item) => {
              const IconComponent = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[60px] transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium truncate max-w-[60px]">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
