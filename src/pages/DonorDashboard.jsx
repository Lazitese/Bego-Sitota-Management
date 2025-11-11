import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  FiHeart, 
  FiFileText, 
  FiDollarSign, 
  FiSearch,
  FiLogOut,
  FiClock,
  FiUsers
} from 'react-icons/fi'
import logo from '../assets/logo.jpg'

export default function DonorDashboard() {
  const { profile, signOut } = useAuth()
  const [students, setStudents] = useState([])
  const [requests, setRequests] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [requestData, setRequestData] = useState({
    message: '',
    requested_amount: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('sponsorships') // 'sponsorships', 'reports', 'receipts'

  // Mobile Profile Menu State
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false)

  // Reports & Receipts State
  const [approvedWeeklyReports, setApprovedWeeklyReports] = useState([])
  const [approvedAcademicReports, setApprovedAcademicReports] = useState([])
  const [verifiedReceipts, setVerifiedReceipts] = useState([])

  useEffect(() => {
    if (profile?.id) {
      fetchData()
    }
  }, [profile?.id])

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

  useEffect(() => {
    if (activeTab === 'reports' && profile?.id) {
      fetchApprovedReports()
    } else if (activeTab === 'receipts' && profile?.id) {
      fetchVerifiedReceipts()
    }
  }, [activeTab, profile?.id])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all available students with their profile information
      // Get all students who have profile records with role 'student'
      // Note: Admin creates users/profiles, student details can be filled later (optional)
      const { data: studentProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, gender, created_at, updated_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (profilesError) {
        if (import.meta.env.DEV) {
          console.error('Error fetching student profiles:', profilesError)
        }
        throw profilesError
      }

      // Student profiles fetched successfully

      // Initialize studentsData with all profiles (student records are optional)
      let studentsData = []
      if (studentProfiles && studentProfiles.length > 0) {
        const studentIds = studentProfiles.map(p => p.id)
        
        // Fetch student records for these profiles (optional - students may not have records yet)
        let studentRecords = []
        if (studentIds.length > 0) {
          const { data: records, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .in('id', studentIds)

          if (studentsError) {
            // Don't throw - student records are optional
            if (import.meta.env.DEV) {
              console.warn('Error fetching student records (non-critical):', studentsError)
            }
          } else {
            studentRecords = records || []
          }
        }

        // Student records processed

        // Merge profiles with student records
        // Show ALL students from profiles table, even if they don't have student records yet
        // Student information is optional and can be filled by Admin or Student later
        studentsData = studentProfiles.map(profile => {
          const studentRecord = studentRecords.find(s => s.id === profile.id)
          return {
            id: profile.id,
            // Student-specific information (optional - can be null if not filled yet)
            school_name: studentRecord?.school_name || null,
            grade_level: studentRecord?.grade_level || null,
            academic_year: studentRecord?.academic_year || null,
            gpa: studentRecord?.gpa || null,
            address: studentRecord?.address || null,
            date_of_birth: studentRecord?.date_of_birth || null,
            guardian_name: studentRecord?.guardian_name || null,
            guardian_phone: studentRecord?.guardian_phone || null,
            guardian_relationship: studentRecord?.guardian_relationship || null,
            // Status defaults to 'active' if no student record exists
            status: studentRecord?.status || 'active',
            created_at: studentRecord?.created_at || profile.created_at,
            updated_at: studentRecord?.updated_at || profile.updated_at,
            // Profile information (always available)
            profiles: {
              full_name: profile.full_name,
              email: profile.email,
              phone_number: profile.phone_number || null,
              gender: profile.gender || null,
            }
          }
        })
      } else {
        // No student profiles found
        studentsData = []
        if (import.meta.env.DEV) {
          console.warn('No student profiles found - check RLS policies')
        }
      }

      // First, fetch all active sponsorships to filter out sponsored students
      // We need to get students who have active sponsorships from ANY donor
      const { data: allActiveLinks, error: allLinksError } = await supabase
        .from('sponsorship_links')
        .select('student_id')
        .eq('status', 'active')

      // Get list of student IDs that have active sponsorships
      const sponsoredStudentIds = new Set()
      if (!allLinksError && allActiveLinks && allActiveLinks.length > 0) {
        allActiveLinks.forEach(link => {
          if (link.student_id) {
            sponsoredStudentIds.add(link.student_id)
          }
        })
      } else if (allLinksError) {
        if (import.meta.env.DEV) {
          console.warn('Error fetching active sponsorships (non-critical):', allLinksError)
        }
      }

      // Filter out students who have active sponsorships
      // Only show students that don't have active sponsorships
      const filteredStudents = studentsData.filter(student => {
        const isSponsored = sponsoredStudentIds.has(student.id)
        return !isSponsored
      })
      
      studentsData = filteredStudents

      // Fetch my sponsorship requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('sponsorship_requests')
        .select('*')
        .eq('donor_id', profile?.id)
        .order('created_at', { ascending: false })

      // Fetch students and profiles for requests separately
      if (requestsData && requestsData.length > 0) {
        const requestStudentIds = [...new Set(requestsData.map(r => r.student_id).filter(Boolean))]
        if (requestStudentIds.length > 0) {
          const { data: requestStudentsData } = await supabase
            .from('students')
            .select('id, school_name, grade_level')
            .in('id', requestStudentIds)

          const { data: requestProfilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', requestStudentIds)

          // Merge data
          requestsData.forEach(request => {
            request.student = {
              ...requestStudentsData?.find(s => s.id === request.student_id),
              profiles: requestProfilesData?.find(p => p.id === request.student_id)
            }
          })
        }
      }

      if (requestsError) throw requestsError

      // Fetch my active sponsorships (for the sponsored students tab)
      const { data: linksData, error: linksError } = await supabase
        .from('sponsorship_links')
        .select('*')
        .eq('donor_id', profile?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      // Fetch related data separately for sponsored students
      if (linksData && linksData.length > 0) {
        const mySponsoredStudentIds = [...new Set(linksData.map(l => l.student_id).filter(Boolean))]
        const mentorIds = [...new Set(linksData.map(l => l.mentor_id).filter(Boolean))]

        let sponsoredStudentsData = []
        let sponsoredProfilesData = []
        let mentorsData = []

        if (mySponsoredStudentIds.length > 0) {
          const { data: s } = await supabase
            .from('students')
            .select('id, school_name, grade_level')
            .in('id', mySponsoredStudentIds)
          sponsoredStudentsData = s || []

          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', mySponsoredStudentIds)
          sponsoredProfilesData = p || []
        }

        if (mentorIds.length > 0) {
          const { data: m } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', mentorIds)
          mentorsData = m || []
        }

        // Merge data for sponsored students
        linksData.forEach(link => {
          link.student = {
            ...sponsoredStudentsData.find(s => s.id === link.student_id),
            profiles: sponsoredProfilesData.find(p => p.id === link.student_id)
          }
          link.mentor = mentorsData.find(m => m.id === link.mentor_id)
        })
      }

      if (linksError) throw linksError

      // Set all available students (this includes students with or without student records)
      // Note: Admin creates user profiles, student details can be filled optionally later
      setStudents(studentsData || [])
      setRequests(requestsData || [])
      setLinks(linksData || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching data:', error)
      }
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSponsorship = async (student) => {
    setSelectedStudent(student)
    setShowRequestForm(true)
    setRequestData({ message: '', requested_amount: '' })
    setError('')
    setSuccess('')
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (!selectedStudent?.id) {
        throw new Error('No student selected')
      }

      // Ensure student record exists before creating sponsorship request
      // Check if student record exists
      const { data: existingStudent, error: checkError } = await supabase
        .from('students')
        .select('id')
        .eq('id', selectedStudent.id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Unable to verify student record: ${checkError.message}`)
      }

      // If student record doesn't exist, create it using the database function
      if (!existingStudent) {
        const { data: studentId, error: ensureError } = await supabase
          .rpc('ensure_student_record_exists', {
            p_student_id: selectedStudent.id
          })

        if (ensureError) {
          throw new Error(`Failed to create student record: ${ensureError.message}`)
        }

        // Student record created/ensured successfully
      }

      // Now create the sponsorship request
      const { data, error: requestError } = await supabase
        .from('sponsorship_requests')
        .insert({
          donor_id: profile?.id,
          student_id: selectedStudent.id,
          message: requestData.message || null,
          requested_amount: requestData.requested_amount ? parseFloat(requestData.requested_amount) : null,
          status: 'pending',
        })
        .select()
        .single()

      if (requestError) throw requestError

      setSuccess('Sponsorship request submitted successfully!')
      setShowRequestForm(false)
      setSelectedStudent(null)
      setRequestData({ message: '', requested_amount: '' })
      fetchData()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating request:', error)
      }
      setError(error.message || 'Failed to submit request')
    }
  }

  const fetchApprovedReports = async () => {
    try {
      // Get sponsored student IDs
      const studentIds = links.map(l => l.student_id).filter(Boolean)
      
      if (studentIds.length === 0) {
        setApprovedWeeklyReports([])
        setApprovedAcademicReports([])
        return
      }

      // Fetch approved weekly reports for sponsored students
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_volunteer_reports')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'approved')
        .order('week_start_date', { ascending: false })

      if (weeklyError) throw weeklyError

      // Fetch student profiles
      if (weeklyData && weeklyData.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)

        weeklyData.forEach(report => {
          report.student = profilesData?.find(p => p.id === report.student_id)
        })
      }

      // Fetch approved academic reports for sponsored students
      const { data: academicData, error: academicError } = await supabase
        .from('academic_reports')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'approved')
        .order('academic_year', { ascending: false })
        .order('semester', { ascending: false })

      if (academicError) throw academicError

      // Fetch student profiles for academic reports
      if (academicData && academicData.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)

        academicData.forEach(report => {
          report.student = profilesData?.find(p => p.id === report.student_id)
        })
      }

      setApprovedWeeklyReports(weeklyData || [])
      setApprovedAcademicReports(academicData || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching approved reports:', error)
      }
      setError('Failed to load approved reports')
    }
  }

  const fetchVerifiedReceipts = async () => {
    try {
      // Get sponsored student IDs
      const studentIds = links.map(l => l.student_id).filter(Boolean)
      
      if (studentIds.length === 0) {
        setVerifiedReceipts([])
        return
      }

      // Fetch verified receipts for sponsored students
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('tuition_receipts')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'verified')
        .order('receipt_date', { ascending: false })

      if (receiptsError) throw receiptsError

      // Fetch student profiles
      if (receiptsData && receiptsData.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)

        receiptsData.forEach(receipt => {
          receipt.student = profilesData?.find(p => p.id === receipt.student_id)
        })
      }

      setVerifiedReceipts(receiptsData || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching verified receipts:', error)
      }
      setError('Failed to load verified receipts')
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
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Navigation items
  const navigationItems = [
    { id: 'sponsorships', label: 'Sponsorships', icon: FiHeart },
    { id: 'reports', label: 'Reports', icon: FiFileText },
    { id: 'receipts', label: 'Receipts', icon: FiDollarSign },
  ]

  const [searchQuery, setSearchQuery] = useState('')

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
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'D'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black truncate">
                  {profile?.full_name || 'Donor'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {profile?.email || 'donor@example.com'}
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
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'D'}
              </button>
              
              {/* Mobile Profile Menu Dropdown */}
              {showMobileProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-black">
                      {profile?.full_name || 'Donor'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {profile?.email || 'donor@example.com'}
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
                {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to Donor Dashboard'}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6 mb-6">
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiHeart className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Active Sponsorships</p>
                <p className="text-3xl font-bold text-black">{links.length}</p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiClock className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Pending Requests</p>
                <p className="text-3xl font-bold text-black">
                  {requests.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiUsers className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Available Students</p>
                <p className="text-3xl font-bold text-black">{students.length}</p>
              </div>
              <div className="group text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="w-14 h-14 mx-auto mb-4 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <FiFileText className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Reports & Receipts</p>
                <p className="text-3xl font-bold text-black">
                  {(approvedWeeklyReports.length || 0) + (approvedAcademicReports.length || 0) + (verifiedReceipts.length || 0)}
                </p>
              </div>
            </div>

        {/* Sponsorships Tab */}
        {activeTab === 'sponsorships' && (
          <>
            {/* Request Form Modal */}
            {showRequestForm && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">
                Request Sponsorship for {selectedStudent.profiles?.full_name || 'Student'}
              </h2>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (Optional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    rows="4"
                    value={requestData.message}
                    onChange={(e) =>
                      setRequestData({ ...requestData, message: e.target.value })
                    }
                    placeholder="Tell us why you want to sponsor this student..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requested Amount (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    value={requestData.requested_amount}
                    onChange={(e) =>
                      setRequestData({ ...requestData, requested_amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600"
                  >
                    Submit Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestForm(false)
                      setSelectedStudent(null)
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

            {/* Active Sponsorships */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">My Active Sponsorships</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : links.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No active sponsorships yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {link.student?.profiles?.full_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {link.student?.school_name} - Grade {link.student?.grade_level}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {link.mentor?.full_name || 'Not assigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${link.annual_amount?.toLocaleString() || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(link.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(link.status)}`}>
                          {link.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

            {/* My Requests */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">My Sponsorship Requests</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No requests submitted yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.student?.profiles?.full_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${request.requested_amount?.toLocaleString() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

            {/* Available Students */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Available Students for Sponsorship</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : students.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No students available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => {
                    const hasRequest = requests.some(r => r.student_id === student.id && r.status !== 'rejected')
                    const hasLink = links.some(l => l.student_id === student.id)
                    const canRequest = !hasRequest && !hasLink

                    return (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.profiles?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.profiles?.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.school_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.grade_level || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.gpa || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(student.status || 'active')}`}>
                            {student.status || 'active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {canRequest ? (
                            <button
                              onClick={() => handleRequestSponsorship(student)}
                              className="text-black hover:text-gray-700 font-medium"
                            >
                              Request Sponsorship
                            </button>
                          ) : (
                            <span className="text-gray-400">
                              {hasLink ? 'Already Sponsored' : 'Request Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}

        {/* Approved Reports Tab */}
        {activeTab === 'reports' && (
          <>
            {/* Weekly Reports Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">Approved Weekly Volunteer Reports</h2>
              </div>
              {approvedWeeklyReports.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No approved weekly reports yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {approvedWeeklyReports.map((report) => (
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">
                              {report.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Academic Reports Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">Approved Academic Reports</h2>
              </div>
              {approvedAcademicReports.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No approved academic reports yet</div>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {approvedAcademicReports.map((report) => (
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
                            {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Verified Receipts Tab */}
        {activeTab === 'receipts' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Verified Tuition Receipts</h2>
            </div>
            {verifiedReceipts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No verified tuition receipts yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {verifiedReceipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {receipt.student?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(receipt.receipt_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${receipt.amount?.toLocaleString() || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {receipt.semester || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {receipt.academic_year || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-xs truncate">
                            {receipt.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {receipt.reviewed_at ? new Date(receipt.reviewed_at).toLocaleDateString() : '-'}
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
                  <span className="text-xs font-medium truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
