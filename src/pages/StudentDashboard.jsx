import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { uploadToR2 } from '../lib/upload'
import { 
  FiBarChart2, 
  FiCalendar, 
  FiFileText, 
  FiDollarSign, 
  FiSearch,
  FiLogOut
} from 'react-icons/fi'
import logo from '../assets/logo.jpg'

export default function StudentDashboard() {
  const { profile, signOut } = useAuth()
  const [sponsorshipLink, setSponsorshipLink] = useState(null)
  const [requests, setRequests] = useState([])
  const [studentData, setStudentData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'weekly', 'academic', 'receipts'

  // Mobile Profile Menu State
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false)

  // Navigation items
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'weekly', label: 'Weekly', icon: FiCalendar },
    { id: 'academic', label: 'Academic', icon: FiFileText },
    { id: 'receipts', label: 'Receipts', icon: FiDollarSign },
  ]

  const [searchQuery, setSearchQuery] = useState('')

  // Weekly Reports State
  const [weeklyReports, setWeeklyReports] = useState([])
  const [showWeeklyForm, setShowWeeklyForm] = useState(false)
  const [weeklyFormData, setWeeklyFormData] = useState({
    week_start_date: '',
    week_end_date: '',
    description: '',
    volunteer_hours: '',
    location: '',
    supporting_documents: [], // Array of File objects
  })
  const [uploadingWeekly, setUploadingWeekly] = useState(false)

  // Academic Reports State
  const [academicReports, setAcademicReports] = useState([])
  const [showAcademicForm, setShowAcademicForm] = useState(false)
  const [academicFormData, setAcademicFormData] = useState({
    semester: '',
    academic_year: '',
    gpa: '',
    courses_completed: '',
    courses_enrolled: '',
    report_file: null, // File object
  })
  const [uploadingAcademic, setUploadingAcademic] = useState(false)

  // Tuition Receipts State
  const [tuitionReceipts, setTuitionReceipts] = useState([])
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [receiptFormData, setReceiptFormData] = useState({
    receipt_date: '',
    amount: '',
    description: '',
    semester: '',
    academic_year: '',
    receipt_file: null, // File object
  })
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  useEffect(() => {
    fetchData()
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
    if (activeTab === 'weekly') {
      fetchWeeklyReports()
    } else if (activeTab === 'academic') {
      fetchAcademicReports()
    } else if (activeTab === 'receipts') {
      fetchTuitionReceipts()
    }
  }, [activeTab, profile?.id])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch student data
      const { data: studentInfo, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', profile?.id)
        .maybeSingle()

      if (studentError && studentError.code !== 'PGRST116' && studentError.code !== '42P17') {
        if (import.meta.env.DEV) {
          console.warn('Error fetching student data:', studentError)
        }
      }
      setStudentData(studentInfo || null)

      // Fetch active sponsorship link
      const { data: linkData, error: linkError } = await supabase
        .from('sponsorship_links')
        .select('*')
        .eq('student_id', profile?.id)
        .eq('status', 'active')
        .maybeSingle()

      if (linkData && !linkError) {
        const idsToFetch = [linkData.donor_id, linkData.mentor_id].filter(Boolean)
        if (idsToFetch.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', idsToFetch)

          linkData.donor = profilesData?.find(p => p.id === linkData.donor_id)
          linkData.mentor = profilesData?.find(p => p.id === linkData.mentor_id)
        }
      }

      if (linkError && linkError.code !== 'PGRST116' && linkError.code !== '42P17' && linkError.status !== 406) {
        if (import.meta.env.DEV) {
          console.warn('Error fetching sponsorship link:', linkError)
        }
      }
      setSponsorshipLink(linkData || null)

      // Fetch requests for this student
      const { data: requestsData, error: requestsError } = await supabase
        .from('sponsorship_requests')
        .select('*')
        .eq('student_id', profile?.id)
        .order('created_at', { ascending: false })

      if (requestsData && requestsData.length > 0) {
        const donorIds = [...new Set(requestsData.map(r => r.donor_id).filter(Boolean))]
        if (donorIds.length > 0) {
          const { data: donorsData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', donorIds)

          requestsData.forEach(request => {
            request.donor = donorsData?.find(d => d.id === request.donor_id)
          })
        }
      }

      if (requestsError) throw requestsError
      setRequests(requestsData || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching data:', error)
      }
      setError('Failed to load sponsorship data')
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyReports = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_volunteer_reports')
        .select('*')
        .eq('student_id', profile?.id)
        .order('week_start_date', { ascending: false })

      if (error) throw error
      setWeeklyReports(data || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching weekly reports:', error)
      }
      setError('Failed to load weekly reports')
    }
  }

  const fetchAcademicReports = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_reports')
        .select('*')
        .eq('student_id', profile?.id)
        .order('academic_year', { ascending: false })
        .order('semester', { ascending: false })

      if (error) throw error
      setAcademicReports(data || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching academic reports:', error)
      }
      setError('Failed to load academic reports')
    }
  }

  const fetchTuitionReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('tuition_receipts')
        .select('*')
        .eq('student_id', profile?.id)
        .order('receipt_date', { ascending: false })

      if (error) throw error
      setTuitionReceipts(data || [])
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching tuition receipts:', error)
      }
      setError('Failed to load tuition receipts')
    }
  }

  const handleWeeklyReportSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUploadingWeekly(true)

    try {
      // Ensure student record exists - use database function to create if needed
      let currentStudentData = studentData
      
      if (!currentStudentData && profile?.id) {
        // Try to fetch the student record (might not have been loaded yet)
        const { data: existingStudent, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('id', profile?.id)
          .maybeSingle()

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(`Unable to verify student record: ${fetchError.message}`)
        }
        
        if (existingStudent) {
          currentStudentData = existingStudent
          setStudentData(existingStudent)
        } else {
          // Student record doesn't exist, create it using the database function
          const { data: createdStudentId, error: createError } = await supabase
            .rpc('create_student_record')

          if (createError) {
            throw new Error(`Failed to create student record: ${createError.message}`)
          }

          // Fetch the newly created student record (function returns the user ID)
          const { data: newStudent, error: newStudentError } = await supabase
            .from('students')
            .select('*')
            .eq('id', profile?.id)
            .single()

          if (newStudentError) {
            throw new Error(`Student record created but could not be retrieved: ${newStudentError.message}`)
          }

          if (newStudent) {
            currentStudentData = newStudent
            setStudentData(newStudent)
          }
        }
      }

      // Verify we have a student record before proceeding
      if (!currentStudentData || !profile?.id) {
        throw new Error('Student record not found. Please contact an administrator if this issue persists.')
      }

      // Upload supporting documents if any
      const documentUrls = []
      if (weeklyFormData.supporting_documents && weeklyFormData.supporting_documents.length > 0) {
        for (const file of weeklyFormData.supporting_documents) {
          try {
            const uploadResult = await uploadToR2(file, `weekly-reports/${profile?.id}`)
            documentUrls.push(uploadResult.url)
          } catch (uploadError) {
            if (import.meta.env.DEV) {
              console.error('Error uploading file:', uploadError)
            }
            throw new Error(`Failed to upload file: ${file.name}`)
          }
        }
      }

      const { data, error } = await supabase
        .from('weekly_volunteer_reports')
        .insert({
          student_id: profile?.id,
          week_start_date: weeklyFormData.week_start_date,
          week_end_date: weeklyFormData.week_end_date,
          description: weeklyFormData.description,
          volunteer_hours: weeklyFormData.volunteer_hours ? parseFloat(weeklyFormData.volunteer_hours) : 0,
          location: weeklyFormData.location || null,
          supporting_documents: documentUrls, // Store array of URLs
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      setSuccess('Weekly volunteer report submitted successfully!')
      setShowWeeklyForm(false)
      setWeeklyFormData({
        week_start_date: '',
        week_end_date: '',
        description: '',
        volunteer_hours: '',
        location: '',
        supporting_documents: [],
      })
      fetchWeeklyReports()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error submitting weekly report:', error)
      }
      setError(error.message || 'Failed to submit weekly report')
    } finally {
      setUploadingWeekly(false)
    }
  }

  const handleAcademicReportSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUploadingAcademic(true)

    try {
      // Ensure student record exists - use database function to create if needed
      let currentStudentData = studentData
      
      if (!currentStudentData && profile?.id) {
        // Try to fetch the student record (might not have been loaded yet)
        const { data: existingStudent, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('id', profile?.id)
          .maybeSingle()

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(`Unable to verify student record: ${fetchError.message}`)
        }
        
        if (existingStudent) {
          currentStudentData = existingStudent
          setStudentData(existingStudent)
        } else {
          // Student record doesn't exist, create it using the database function
          const { data: createdStudentId, error: createError } = await supabase
            .rpc('create_student_record')

          if (createError) {
            throw new Error(`Failed to create student record: ${createError.message}`)
          }

          // Fetch the newly created student record (function returns the user ID)
          const { data: newStudent, error: newStudentError } = await supabase
            .from('students')
            .select('*')
            .eq('id', profile?.id)
            .single()

          if (newStudentError) {
            throw new Error(`Student record created but could not be retrieved: ${newStudentError.message}`)
          }

          if (newStudent) {
            currentStudentData = newStudent
            setStudentData(newStudent)
          }
        }
      }

      // Verify we have a student record before proceeding
      if (!currentStudentData || !profile?.id) {
        throw new Error('Student record not found. Please contact an administrator if this issue persists.')
      }

      let reportFileUrl = null
      
      // Upload file to R2 if selected
      if (academicFormData.report_file) {
        try {
          const uploadResult = await uploadToR2(academicFormData.report_file, `academic-reports/${profile?.id}`)
          reportFileUrl = uploadResult.url
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError)
          throw new Error(`Failed to upload file: ${academicFormData.report_file.name}`)
        }
      }

      const { data, error } = await supabase
        .from('academic_reports')
        .insert({
          student_id: profile?.id,
          semester: academicFormData.semester,
          academic_year: academicFormData.academic_year,
          gpa: academicFormData.gpa ? parseFloat(academicFormData.gpa) : null,
          courses_completed: academicFormData.courses_completed ? parseInt(academicFormData.courses_completed) : null,
          courses_enrolled: academicFormData.courses_enrolled ? parseInt(academicFormData.courses_enrolled) : null,
          report_file: reportFileUrl, // Using report_file column
          status: 'pending',
          can_resubmit: true,
        })
        .select()
        .single()

      if (error) throw error

      setSuccess('Academic report submitted successfully!')
      setShowAcademicForm(false)
      setAcademicFormData({
        semester: '',
        academic_year: '',
        gpa: '',
        courses_completed: '',
        courses_enrolled: '',
        report_file: null,
      })
      fetchAcademicReports()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error submitting academic report:', error)
      }
      setError(error.message || 'Failed to submit academic report')
    } finally {
      setUploadingAcademic(false)
    }
  }

  const handleReceiptSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUploadingReceipt(true)

    try {
      // Verify student record exists - students cannot create their own records
      let currentStudentData = studentData
      
      if (!currentStudentData && profile?.id) {
        // Try to fetch the student record (might not have been loaded yet)
        const { data: existingStudent, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('id', profile?.id)
          .maybeSingle()

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(`Unable to verify student record: ${fetchError.message}`)
        }
        
        if (existingStudent) {
          currentStudentData = existingStudent
          setStudentData(existingStudent)
        }
      }

      // Verify we have a student record before proceeding
      if (!currentStudentData || !profile?.id) {
        throw new Error('Student record not found. Please contact an administrator to set up your student profile before submitting receipts.')
      }

      let receiptFileUrl = null
      
      // Upload file to R2 if selected
      if (receiptFormData.receipt_file) {
        try {
          const uploadResult = await uploadToR2(receiptFormData.receipt_file, `tuition-receipts/${profile?.id}`)
          receiptFileUrl = uploadResult.url
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError)
          throw new Error(`Failed to upload file: ${receiptFormData.receipt_file.name}`)
        }
      }

      const { data, error } = await supabase
        .from('tuition_receipts')
        .insert({
          student_id: profile?.id,
          receipt_date: receiptFormData.receipt_date,
          amount: parseFloat(receiptFormData.amount),
          description: receiptFormData.description || null,
          semester: receiptFormData.semester || null,
          academic_year: receiptFormData.academic_year || null,
          receipt_file: receiptFileUrl, // Using receipt_file column
          status: 'pending',
          can_resubmit: true,
        })
        .select()
        .single()

      if (error) throw error

      setSuccess('Tuition receipt submitted successfully!')
      setShowReceiptForm(false)
      setReceiptFormData({
        receipt_date: '',
        amount: '',
        description: '',
        semester: '',
        academic_year: '',
        receipt_file: null,
      })
      fetchTuitionReceipts()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error submitting tuition receipt:', error)
      }
      setError(error.message || 'Failed to submit tuition receipt')
    } finally {
      setUploadingReceipt(false)
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
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black truncate">
                  {profile?.full_name || 'Student'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {profile?.email || 'student@example.com'}
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
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </button>
              
              {/* Mobile Profile Menu Dropdown */}
              {showMobileProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-black">
                      {profile?.full_name || 'Student'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {profile?.email || 'student@example.com'}
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
                {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to Student Dashboard'}
              </p>
            </div>

            {loading && activeTab === 'overview' ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">Loading...</div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <>
                    {/* Current Sponsorship */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Current Sponsorship Status</h2>
                  {sponsorshipLink ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Sponsor</p>
                          <p className="text-lg font-medium text-gray-900">
                            {sponsorshipLink.donor?.full_name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Mentor</p>
                          <p className="text-lg font-medium text-gray-900">
                            {sponsorshipLink.mentor?.full_name || 'Not assigned'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Annual Amount</p>
                          <p className="text-lg font-medium text-gray-900">
                            ${sponsorshipLink.annual_amount?.toLocaleString() || '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Start Date</p>
                          <p className="text-lg font-medium text-gray-900">
                            {new Date(sponsorshipLink.start_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(sponsorshipLink.status)}`}>
                          {sponsorshipLink.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-lg mb-2">No active sponsorship</p>
                      <p className="text-sm">Sponsorship requests are pending approval</p>
                    </div>
                  )}
                </div>

                    {/* Student Information */}
                    {studentData && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">My Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">School</p>
                        <p className="text-lg font-medium text-gray-900">
                          {studentData.school_name || 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Grade Level</p>
                        <p className="text-lg font-medium text-gray-900">
                          {studentData.grade_level || 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">GPA</p>
                        <p className="text-lg font-medium text-gray-900">
                          {studentData.gpa || 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p className="text-lg font-medium text-gray-900">
                          {studentData.status || 'active'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                    {/* Sponsorship Requests */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold">Sponsorship Requests</h2>
                  </div>
                  {requests.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No requests yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {requests.map((request) => (
                            <tr key={request.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {request.donor?.full_name || 'N/A'}
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
              </>
            )}

                {/* Weekly Reports Tab */}
                {activeTab === 'weekly' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-xl font-semibold">Weekly Volunteer Reports</h2>
                      <button
                        onClick={() => setShowWeeklyForm(!showWeeklyForm)}
                        className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm"
                      >
                        {showWeeklyForm ? 'Cancel' : '+ Submit Report'}
                      </button>
                    </div>

                {showWeeklyForm && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Submit Weekly Volunteer Report</h3>
                    <form onSubmit={handleWeeklyReportSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Week Start Date *
                          </label>
                          <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={weeklyFormData.week_start_date}
                            onChange={(e) => setWeeklyFormData({ ...weeklyFormData, week_start_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Week End Date *
                          </label>
                          <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={weeklyFormData.week_end_date}
                            onChange={(e) => setWeeklyFormData({ ...weeklyFormData, week_end_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Volunteer Hours
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={weeklyFormData.volunteer_hours}
                            onChange={(e) => setWeeklyFormData({ ...weeklyFormData, volunteer_hours: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Location
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={weeklyFormData.location}
                            onChange={(e) => setWeeklyFormData({ ...weeklyFormData, location: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description *
                        </label>
                        <textarea
                          required
                          rows="4"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={weeklyFormData.description}
                          onChange={(e) => setWeeklyFormData({ ...weeklyFormData, description: e.target.value })}
                          placeholder="Describe your volunteer activities for this week..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Supporting Documents (Optional)
                        </label>
                        <input
                          type="file"
                          multiple
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || [])
                            setWeeklyFormData({ ...weeklyFormData, supporting_documents: files })
                          }}
                        />
                        {weeklyFormData.supporting_documents.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {weeklyFormData.supporting_documents.length} file(s) selected
                          </p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingWeekly}
                        className="bg-orange-500 text-white px-6 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingWeekly ? 'Uploading...' : 'Submit Report'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {weeklyReports.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No weekly reports submitted yet</div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {weeklyReports.map((report) => (
                          <tr key={report.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(report.week_start_date).toLocaleDateString()} - {new Date(report.week_end_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {report.volunteer_hours || '0'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {report.location || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(report.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(report.status)}`}>
                                {report.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

                {/* Academic Reports Tab */}
                {activeTab === 'academic' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-xl font-semibold">Academic Reports</h2>
                      <button
                        onClick={() => setShowAcademicForm(!showAcademicForm)}
                        className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm"
                      >
                        {showAcademicForm ? 'Cancel' : '+ Submit Report'}
                      </button>
                    </div>

                {showAcademicForm && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Submit Academic Report</h3>
                    <form onSubmit={handleAcademicReportSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Semester *
                          </label>
                          <select
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={academicFormData.semester}
                            onChange={(e) => setAcademicFormData({ ...academicFormData, semester: e.target.value })}
                          >
                            <option value="">Select...</option>
                            <option value="Fall">Fall</option>
                            <option value="Spring">Spring</option>
                            <option value="Summer">Summer</option>
                            <option value="Winter">Winter</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Academic Year *
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={academicFormData.academic_year}
                            onChange={(e) => setAcademicFormData({ ...academicFormData, academic_year: e.target.value })}
                            placeholder="e.g., 2024-2025"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            GPA
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="4"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={academicFormData.gpa}
                            onChange={(e) => setAcademicFormData({ ...academicFormData, gpa: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Courses Enrolled
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={academicFormData.courses_enrolled}
                            onChange={(e) => setAcademicFormData({ ...academicFormData, courses_enrolled: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Courses Completed
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={academicFormData.courses_completed}
                            onChange={(e) => setAcademicFormData({ ...academicFormData, courses_completed: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Report File
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            onChange={(e) => setAcademicFormData({ ...academicFormData, report_file: e.target.files?.[0] || null })}
                          />
                          {academicFormData.report_file && (
                            <p className="text-xs text-gray-500 mt-1">
                              Selected: {academicFormData.report_file.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingAcademic}
                        className="bg-orange-500 text-white px-6 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingAcademic ? 'Uploading...' : 'Submit Report'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {academicReports.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No academic reports submitted yet</div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPA</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {academicReports.map((report) => (
                          <tr key={report.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(report.status)}`}>
                                {report.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

                {/* Tuition Receipts Tab */}
                {activeTab === 'receipts' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-xl font-semibold">Tuition Receipts</h2>
                      <button
                        onClick={() => setShowReceiptForm(!showReceiptForm)}
                        className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm"
                      >
                        {showReceiptForm ? 'Cancel' : '+ Upload Receipt'}
                      </button>
                    </div>

                {showReceiptForm && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Upload Tuition Receipt</h3>
                    <form onSubmit={handleReceiptSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Receipt Date *
                          </label>
                          <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={receiptFormData.receipt_date}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, receipt_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={receiptFormData.amount}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, amount: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Semester
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={receiptFormData.semester}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, semester: e.target.value })}
                          >
                            <option value="">Select...</option>
                            <option value="Fall">Fall</option>
                            <option value="Spring">Spring</option>
                            <option value="Summer">Summer</option>
                            <option value="Winter">Winter</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Academic Year
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={receiptFormData.academic_year}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, academic_year: e.target.value })}
                            placeholder="e.g., 2024-2025"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            value={receiptFormData.description}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, description: e.target.value })}
                            placeholder="Additional notes about this receipt..."
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Receipt File *
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, receipt_file: e.target.files?.[0] || null })}
                          />
                          {receiptFormData.receipt_file && (
                            <p className="text-xs text-gray-500 mt-1">
                              Selected: {receiptFormData.receipt_file.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingReceipt}
                        className="bg-orange-500 text-white px-6 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingReceipt ? 'Uploading...' : 'Upload Receipt'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {tuitionReceipts.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No tuition receipts uploaded yet</div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tuitionReceipts.map((receipt) => (
                          <tr key={receipt.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(receipt.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(receipt.status)}`}>
                                {receipt.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
              </>
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
