import { useState, useEffect } from 'react'
import { supabase, supabaseUrl } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    gender: '',
    phone_number: '',
    role: 'student',
    password: '',
  })
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    gender: '',
    phone_number: '',
    role: 'student',
    password: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sponsorshipRequests, setSponsorshipRequests] = useState([])
  const [activeSponsorships, setActiveSponsorships] = useState([])
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDonors: 0,
    pendingRequests: 0,
    activeSponsorships: 0,
    pendingApprovals: 0,
  })
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard', 'users', 'sponsorships', or 'reports'
  const [userCategoryFilter, setUserCategoryFilter] = useState('all') // 'all', 'admin', 'donor', 'mentor', 'student'
  const [sponsorshipCategoryFilter, setSponsorshipCategoryFilter] = useState('all') // 'all', 'requests', 'active'
  const [reportsCategoryFilter, setReportsCategoryFilter] = useState('all') // 'all', 'weekly', 'academic', 'receipts'

  // Reports & Receipts State
  const [weeklyReports, setWeeklyReports] = useState([])
  const [academicReports, setAcademicReports] = useState([])
  const [receipts, setReceipts] = useState([])
  const [reportStatusFilter, setReportStatusFilter] = useState('pending') // 'pending', 'approved', 'rejected', 'all'

  // Mentor Assignment State
  const [mentors, setMentors] = useState([])
  const [showMentorModal, setShowMentorModal] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedMentorId, setSelectedMentorId] = useState('')
  const [students, setStudents] = useState([]) // List of students with mentor info

  // Student Information Edit State
  const [showEditStudentModal, setShowEditStudentModal] = useState(false)
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState(null)
  const [editStudentFormData, setEditStudentFormData] = useState({
    school_name: '',
    grade_level: '',
    gpa: '',
  })

  // User Detail View State
  const [showUserDetailModal, setShowUserDetailModal] = useState(false)
  const [selectedUserForView, setSelectedUserForView] = useState(null)
  const [userDetailData, setUserDetailData] = useState({
    sponsorships: [],
    requests: [],
    weeklyReports: [],
    academicReports: [],
    receipts: [],
    assignedStudents: [],
    sponsoredStudents: []
  })
  const [loadingUserDetails, setLoadingUserDetails] = useState(false)

  // Sponsorship Detail View State
  const [showSponsorshipDetailModal, setShowSponsorshipDetailModal] = useState(false)
  const [selectedSponsorshipForView, setSelectedSponsorshipForView] = useState(null)
  const [sponsorshipDetailType, setSponsorshipDetailType] = useState(null) // 'request' or 'active'

  // Reports & Receipts Detail View State
  const [showReportDetailModal, setShowReportDetailModal] = useState(false)
  const [selectedReportForView, setSelectedReportForView] = useState(null)
  const [reportDetailType, setReportDetailType] = useState(null) // 'weekly', 'academic', 'receipt'

  useEffect(() => {
    fetchUsers()
    fetchSponsorshipData()
    fetchMentors()
    fetchStudents()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchAllReportsAndReceipts()
    }
  }, [activeTab, reportStatusFilter])

  const fetchMentors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'mentor')
        .order('full_name', { ascending: true })

      if (error) throw error
      setMentors(data || [])
    } catch (error) {
      console.error('Error fetching mentors:', error)
    }
  }

  const fetchStudents = async () => {
    try {
      // Fetch all students with their mentor assignments
      const { data: studentProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, gender')
        .eq('role', 'student')
        .order('full_name', { ascending: true })

      if (profilesError) throw profilesError

      if (studentProfiles && studentProfiles.length > 0) {
        const studentIds = studentProfiles.map(p => p.id)
        
        // Fetch student records with mentor info
        const { data: studentRecords, error: studentsError } = await supabase
          .from('students')
          .select('id, school_name, grade_level, gpa, mentor_id, status')
          .in('id', studentIds)

        if (studentsError && studentsError.code !== 'PGRST116') {
          console.warn('Error fetching student records:', studentsError)
        }

        // Fetch mentor profiles
        const mentorIds = [...new Set((studentRecords || []).map(s => s.mentor_id).filter(Boolean))]
        let mentorsData = []
        if (mentorIds.length > 0) {
          const { data: m } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', mentorIds)
          mentorsData = m || []
        }

        // Merge data
        const studentsData = studentProfiles.map(profile => {
          const studentRecord = studentRecords?.find(s => s.id === profile.id)
          const mentor = mentorsData.find(m => m.id === studentRecord?.mentor_id)
          
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone_number: profile.phone_number,
            gender: profile.gender,
            school_name: studentRecord?.school_name || null,
            grade_level: studentRecord?.grade_level || null,
            gpa: studentRecord?.gpa || null,
            status: studentRecord?.status || 'active',
            mentor_id: studentRecord?.mentor_id || null,
            mentor: mentor || null,
            created_at: profile.created_at || new Date().toISOString(),
          }
        })

        setStudents(studentsData)
      } else {
        setStudents([])
      }
    } catch (error) {
      console.error('Error fetching students:', error)
      setStudents([])
    }
  }

  const fetchSponsorshipData = async () => {
    try {
      // Fetch ALL sponsorship requests (pending, approved, rejected)
      const { data: requestsData, error: requestsError } = await supabase
        .from('sponsorship_requests')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch related data separately
      if (requestsData && requestsData.length > 0) {
        const donorIds = [...new Set(requestsData.map(r => r.donor_id).filter(Boolean))]
        const studentIds = [...new Set(requestsData.map(r => r.student_id).filter(Boolean))]

        let donorsData = []
        let studentsData = []
        let profilesData = []

        if (donorIds.length > 0) {
          const { data: d } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', donorIds)
          donorsData = d || []
        }

        if (studentIds.length > 0) {
          const { data: s } = await supabase
            .from('students')
            .select('id, school_name, grade_level')
            .in('id', studentIds)
          studentsData = s || []

          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)
          profilesData = p || []
        }

        // Merge data
        requestsData.forEach(request => {
          request.donor = donorsData.find(d => d.id === request.donor_id)
          request.student = {
            ...studentsData.find(s => s.id === request.student_id),
            profiles: profilesData.find(p => p.id === request.student_id)
          }
        })
      }

      if (requestsError) throw requestsError

      // Fetch active sponsorships for mentor assignment
      const { data: linksData, error: linksError } = await supabase
        .from('sponsorship_links')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      // Fetch related data for active sponsorships
      if (linksData && linksData.length > 0) {
        const studentIds = [...new Set(linksData.map(l => l.student_id).filter(Boolean))]
        const donorIds = [...new Set(linksData.map(l => l.donor_id).filter(Boolean))]
        const mentorIds = [...new Set(linksData.map(l => l.mentor_id).filter(Boolean))]

        let studentsData = []
        let profilesData = []
        let donorsData = []
        let mentorsData = []

        if (studentIds.length > 0) {
          // Fetch student records including mentor_id (source of truth for mentor assignment)
          const { data: s } = await supabase
            .from('students')
            .select('id, school_name, grade_level, mentor_id')
            .in('id', studentIds)
          studentsData = s || []

          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)
          profilesData = p || []
        }

        if (donorIds.length > 0) {
          const { data: d } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', donorIds)
          donorsData = d || []
        }

        // Get mentor IDs from student records (source of truth for mentor assignment)
        const mentorIdsFromStudents = [...new Set(
          studentsData.map(s => s.mentor_id).filter(Boolean)
        )]

        if (mentorIdsFromStudents.length > 0) {
          const { data: m } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', mentorIdsFromStudents)
          mentorsData = m || []
        }

        // Merge data - use mentor from students table (source of truth)
        linksData.forEach(link => {
          const studentRecord = studentsData.find(s => s.id === link.student_id)
          link.student = {
            ...studentRecord,
            profiles: profilesData.find(p => p.id === link.student_id)
          }
          link.donor = donorsData.find(d => d.id === link.donor_id)
          // Get mentor from student's mentor_id (source of truth), not from link.mentor_id
          const studentMentorId = studentRecord?.mentor_id
          link.mentor = studentMentorId ? mentorsData.find(m => m.id === studentMentorId) : null
        })
      }

      if (linksError) console.warn('Error fetching active sponsorships:', linksError)

      // Fetch stats
      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')

      const { count: donorsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'donor')

      const { count: linksCount } = await supabase
        .from('sponsorship_links')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Fetch pending approvals count
      const { count: pendingWeeklyCount } = await supabase
        .from('weekly_volunteer_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingAcademicCount } = await supabase
        .from('academic_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingReceiptsCount } = await supabase
        .from('tuition_receipts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const totalPendingApprovals = (pendingWeeklyCount || 0) + (pendingAcademicCount || 0) + (pendingReceiptsCount || 0)

      setSponsorshipRequests(requestsData || [])
      setActiveSponsorships(linksData || [])
      setStats({
        totalStudents: studentsCount || 0,
        totalDonors: donorsCount || 0,
        pendingRequests: requestsData?.length || 0,
        activeSponsorships: linksCount || 0,
        pendingApprovals: totalPendingApprovals,
      })
    } catch (error) {
      console.error('Error fetching sponsorship data:', error)
    }
  }

  const fetchAllReportsAndReceipts = async () => {
    try {
      // Fetch ALL weekly reports (pending, approved, rejected)
      let weeklyQuery = supabase
        .from('weekly_volunteer_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportStatusFilter !== 'all') {
        weeklyQuery = weeklyQuery.eq('status', reportStatusFilter)
      }

      const { data: weeklyData, error: weeklyError } = await weeklyQuery

      if (weeklyError) throw weeklyError

      // Fetch student profiles for weekly reports
      if (weeklyData && weeklyData.length > 0) {
        const studentIds = [...new Set(weeklyData.map(r => r.student_id).filter(Boolean))]
        if (studentIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)

          weeklyData.forEach(report => {
            report.student = profilesData?.find(p => p.id === report.student_id)
          })
        }
      }

      // Fetch ALL academic reports (pending, approved, rejected)
      let academicQuery = supabase
        .from('academic_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportStatusFilter !== 'all') {
        academicQuery = academicQuery.eq('status', reportStatusFilter)
      }

      const { data: academicData, error: academicError } = await academicQuery

      if (academicError) throw academicError

      // Fetch student profiles for academic reports
      if (academicData && academicData.length > 0) {
        const studentIds = [...new Set(academicData.map(r => r.student_id).filter(Boolean))]
        if (studentIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)

          academicData.forEach(report => {
            report.student = profilesData?.find(p => p.id === report.student_id)
          })
        }
      }

      // Fetch ALL tuition receipts (pending, verified, rejected)
      let receiptsQuery = supabase
        .from('tuition_receipts')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportStatusFilter !== 'all') {
        receiptsQuery = receiptsQuery.eq('status', reportStatusFilter)
      }

      const { data: receiptsData, error: receiptsError } = await receiptsQuery

      if (receiptsError) throw receiptsError

      // Fetch student profiles for receipts
      if (receiptsData && receiptsData.length > 0) {
        const studentIds = [...new Set(receiptsData.map(r => r.student_id).filter(Boolean))]
        if (studentIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)

          receiptsData.forEach(receipt => {
            receipt.student = profilesData?.find(p => p.id === receipt.student_id)
          })
        }
      }

      setWeeklyReports(weeklyData || [])
      setAcademicReports(academicData || [])
      setReceipts(receiptsData || [])
    } catch (error) {
      console.error('Error fetching reports and receipts:', error)
      setError('Failed to load reports and receipts')
    }
  }

  const handleApproveWeeklyReport = async (reportId, notes = '') => {
    try {
      const { error } = await supabase
        .from('weekly_volunteer_reports')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Weekly report approved')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData() // Update stats
    } catch (error) {
      console.error('Error approving weekly report:', error)
      setError(error.message || 'Failed to approve weekly report')
    }
  }

  const handleRejectWeeklyReport = async (reportId, notes = '') => {
    try {
      const { error } = await supabase
        .from('weekly_volunteer_reports')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Weekly report rejected')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData()
    } catch (error) {
      console.error('Error rejecting weekly report:', error)
      setError(error.message || 'Failed to reject weekly report')
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
          reviewer_role: 'admin',
          admin_notes: notes || null,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Academic report approved')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData()
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
          reviewer_role: 'admin',
          admin_notes: notes || null,
          can_resubmit: true,
        })
        .eq('id', reportId)

      if (error) throw error

      setSuccess('Academic report rejected')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData()
    } catch (error) {
      console.error('Error rejecting academic report:', error)
      setError(error.message || 'Failed to reject academic report')
    }
  }

  const handleVerifyReceipt = async (receiptId, notes = '') => {
    try {
      const { error } = await supabase
        .from('tuition_receipts')
        .update({
          status: 'verified',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq('id', receiptId)

      if (error) throw error

      setSuccess('Tuition receipt verified')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData()
    } catch (error) {
      console.error('Error verifying receipt:', error)
      setError(error.message || 'Failed to verify receipt')
    }
  }

  const handleRejectReceipt = async (receiptId, notes = '') => {
    try {
      const { error } = await supabase
        .from('tuition_receipts')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: notes || null,
          can_resubmit: true,
        })
        .eq('id', receiptId)

      if (error) throw error

      setSuccess('Tuition receipt rejected')
      fetchAllReportsAndReceipts()
      fetchSponsorshipData()
    } catch (error) {
      console.error('Error rejecting receipt:', error)
      setError(error.message || 'Failed to reject receipt')
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password || null,
            full_name: formData.full_name,
            gender: formData.gender || null,
            phone_number: formData.phone_number || null,
            role: formData.role,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }

      setSuccess(`User created successfully! Password: ${result.password}`)
      setFormData({
        full_name: '',
        email: '',
        gender: '',
        phone_number: '',
        role: 'student',
        password: '',
      })
      setShowCreateForm(false)
      fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      setError(error.message || 'Failed to create user')
    }
  }

  const handleEditUser = (user) => {
    setEditingUser(user)
    setEditFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      gender: user.gender || '',
      phone_number: user.phone_number || '',
      role: user.role || 'student',
      password: '', // Don't pre-fill password
    })
    setShowCreateForm(false)
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditFormData({
      full_name: '',
      email: '',
      gender: '',
      phone_number: '',
      role: 'student',
      password: '',
    })
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const updateData = {
        userId: editingUser.id,
        full_name: editFormData.full_name,
        email: editFormData.email,
        gender: editFormData.gender || null,
        phone_number: editFormData.phone_number || null,
        role: editFormData.role,
      }

      // Only include password if provided
      if (editFormData.password && editFormData.password.trim() !== '') {
        updateData.password = editFormData.password
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/update-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updateData),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user')
      }

      setSuccess('User updated successfully')
      setEditingUser(null)
      setEditFormData({
        full_name: '',
        email: '',
        gender: '',
        phone_number: '',
        role: 'student',
        password: '',
      })
      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      setError(error.message || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId, email) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }

      setSuccess('User deleted successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      setError(error.message || 'Failed to delete user')
    }
  }

  const handleApproveRequest = async (requestId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Get request details
      const request = sponsorshipRequests.find(r => r.id === requestId)
      if (!request) return

      // Update request status
      const { error: updateError } = await supabase
        .from('sponsorship_requests')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Get student's assigned mentor from students table
      let assignedMentorId = null
      const { data: studentRecord } = await supabase
        .from('students')
        .select('mentor_id')
        .eq('id', request.student_id)
        .single()

      if (studentRecord) {
        assignedMentorId = studentRecord.mentor_id
      }

      // Create sponsorship link (mentor comes from student's assignment, not from request approval)
      const { error: linkError } = await supabase
        .from('sponsorship_links')
        .insert({
          donor_id: request.donor_id,
          student_id: request.student_id,
          mentor_id: assignedMentorId || null, // Use student's assigned mentor
          request_id: requestId,
          status: 'active',
          annual_amount: request.requested_amount || null,
          start_date: new Date().toISOString().split('T')[0],
          created_by: profile?.id,
        })

      if (linkError) throw linkError

      setSuccess('Sponsorship request approved and link created successfully!')
      fetchSponsorshipData()
      fetchUsers()
      fetchStudents()
    } catch (error) {
      console.error('Error approving request:', error)
      setError(error.message || 'Failed to approve request')
    }
  }


  const handleAssignMentorClick = (studentId, currentMentorId) => {
    setSelectedStudentId(studentId)
    setSelectedMentorId(currentMentorId || '')
    setError('') // Clear any previous errors
    setSuccess('') // Clear any previous success messages
    setShowMentorModal(true)
  }

  const handleEditStudentClick = (student) => {
    setSelectedStudentForEdit(student)
    setEditStudentFormData({
      school_name: student.school_name || '',
      grade_level: student.grade_level || '',
      gpa: student.gpa || '',
    })
    setError('')
    setSuccess('')
    setShowEditStudentModal(true)
  }

  const handleUpdateStudentInfo = async () => {
    if (!selectedStudentForEdit?.id) {
      setError('No student selected')
      return
    }

    try {
      // First, check if student record exists
      const { data: existingStudent, error: checkError } = await supabase
        .from('students')
        .select('id')
        .eq('id', selectedStudentForEdit.id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      const updateData = {
        school_name: editStudentFormData.school_name.trim() || null,
        grade_level: editStudentFormData.grade_level.trim() || null,
        gpa: editStudentFormData.gpa.trim() ? parseFloat(editStudentFormData.gpa) : null,
        updated_at: new Date().toISOString(),
      }

      let result

      if (existingStudent) {
        // Student record exists, update it
        const { data, error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', selectedStudentForEdit.id)
          .select()

        if (error) throw error
        result = data
      } else {
        // Student record doesn't exist, create it
        const { data, error } = await supabase
          .from('students')
          .insert({
            id: selectedStudentForEdit.id,
            ...updateData,
            status: 'active',
          })
          .select()

        if (error) throw error
        result = data
      }

      setSuccess('Student information updated successfully!')
      setShowEditStudentModal(false)
      setSelectedStudentForEdit(null)
      setEditStudentFormData({ school_name: '', grade_level: '', gpa: '' })
      fetchStudents() // Refresh student list
    } catch (error) {
      console.error('Error updating student information:', error)
      setError(error.message || 'Failed to update student information')
    }
  }

  const handleUpdateStudentMentor = async () => {
    if (!selectedStudentId) {
      setError('No student selected')
      return
    }

    try {
      // Convert empty string to null for mentor_id
      const mentorId = selectedMentorId && selectedMentorId.trim() !== '' ? selectedMentorId : null

      console.log('Updating student mentor:', {
        studentId: selectedStudentId,
        mentorId: mentorId,
      })

      // First, check if student record exists
      const { data: existingStudent, error: checkError } = await supabase
        .from('students')
        .select('id')
        .eq('id', selectedStudentId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking student record:', checkError)
        throw checkError
      }

      let updateResult

      if (existingStudent) {
        // Student record exists, update it
        const { data, error } = await supabase
          .from('students')
          .update({
            mentor_id: mentorId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedStudentId)
          .select()

        if (error) {
          console.error('Supabase update error:', error)
          throw error
        }

        updateResult = data
        console.log('Update result:', data)
      } else {
        // Student record doesn't exist, create it with mentor_id
        const { data, error } = await supabase
          .from('students')
          .insert({
            id: selectedStudentId,
            mentor_id: mentorId,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .select()

        if (error) {
          console.error('Supabase insert error:', error)
          throw error
        }

        updateResult = data
        console.log('Insert result:', data)
      }

      setSuccess(mentorId ? 'Mentor assigned successfully!' : 'Mentor removed successfully!')
      setShowMentorModal(false)
      setSelectedStudentId(null)
      setSelectedMentorId('')
      fetchStudents()
      
      // Also update sponsorship links if they exist for this student
      // Update all active sponsorship links for this student
      const { error: linkError } = await supabase
        .from('sponsorship_links')
        .update({
          mentor_id: mentorId,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', selectedStudentId)
        .eq('status', 'active')

      if (linkError) {
        console.warn('Error updating sponsorship links:', linkError)
      } else {
        fetchSponsorshipData() // Refresh sponsorship data
      }
    } catch (error) {
      console.error('Error updating student mentor:', error)
      setError(error.message || 'Failed to update mentor. Please check console for details.')
    }
  }

  const handleRejectRequest = async (requestId, notes = '') => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const { error } = await supabase
        .from('sponsorship_requests')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq('id', requestId)

      if (error) throw error

      setSuccess('Sponsorship request rejected')
      fetchSponsorshipData()
    } catch (error) {
      console.error('Error rejecting request:', error)
      setError(error.message || 'Failed to reject request')
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'donor':
        return 'bg-blue-100 text-blue-800'
      case 'mentor':
        return 'bg-green-100 text-green-800'
      case 'student':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'verified':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const fetchUserDetailData = async (user) => {
    if (!user) return

    setLoadingUserDetails(true)
    try {
      let sponsorships = []
      let requests = []
      let weeklyReports = []
      let academicReports = []
      let receipts = []
      let assignedStudents = []
      let sponsoredStudents = []

      if (user.role === 'student') {
        // Fetch sponsorships for this student
        const { data: linksData } = await supabase
          .from('sponsorship_links')
          .select('*')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })

        if (linksData && linksData.length > 0) {
          const donorIds = [...new Set(linksData.map(l => l.donor_id).filter(Boolean))]
          const mentorIds = [...new Set(linksData.map(l => l.mentor_id).filter(Boolean))]

          let donorsData = []
          let mentorsData = []

          if (donorIds.length > 0) {
            const { data: d } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', donorIds)
            donorsData = d || []
          }

          if (mentorIds.length > 0) {
            const { data: m } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', mentorIds)
            mentorsData = m || []
          }

          sponsorships = linksData.map(link => ({
            ...link,
            donor: donorsData.find(d => d.id === link.donor_id),
            mentor: mentorsData.find(m => m.id === link.mentor_id)
          }))
        }

        // Fetch sponsorship requests
        const { data: requestsData } = await supabase
          .from('sponsorship_requests')
          .select('*')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })

        if (requestsData && requestsData.length > 0) {
          const donorIds = [...new Set(requestsData.map(r => r.donor_id).filter(Boolean))]
          if (donorIds.length > 0) {
            const { data: donorsData } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', donorIds)

            requests = requestsData.map(req => ({
              ...req,
              donor: donorsData?.find(d => d.id === req.donor_id)
            }))
          } else {
            requests = requestsData
          }
        }

        // Fetch weekly reports
        const { data: weeklyData } = await supabase
          .from('weekly_volunteer_reports')
          .select('*')
          .eq('student_id', user.id)
          .order('week_start_date', { ascending: false })
        weeklyReports = weeklyData || []

        // Fetch academic reports
        const { data: academicData } = await supabase
          .from('academic_reports')
          .select('*')
          .eq('student_id', user.id)
          .order('academic_year', { ascending: false })
          .order('semester', { ascending: false })
        academicReports = academicData || []

        // Fetch tuition receipts
        const { data: receiptsData } = await supabase
          .from('tuition_receipts')
          .select('*')
          .eq('student_id', user.id)
          .order('receipt_date', { ascending: false })
        receipts = receiptsData || []
      } else if (user.role === 'donor') {
        // Fetch sponsorships where this donor is involved
        const { data: linksData } = await supabase
          .from('sponsorship_links')
          .select('*')
          .eq('donor_id', user.id)
          .order('created_at', { ascending: false })

        if (linksData && linksData.length > 0) {
          const studentIds = [...new Set(linksData.map(l => l.student_id).filter(Boolean))]
          const mentorIds = [...new Set(linksData.map(l => l.mentor_id).filter(Boolean))]

          let studentsData = []
          let mentorsData = []

          if (studentIds.length > 0) {
            const { data: s } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', studentIds)
            studentsData = s || []

            const { data: studentRecords } = await supabase
              .from('students')
              .select('id, school_name, grade_level')
              .in('id', studentIds)

            sponsoredStudents = studentsData.map(profile => ({
              ...profile,
              ...studentRecords?.find(s => s.id === profile.id)
            }))
          }

          if (mentorIds.length > 0) {
            const { data: m } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', mentorIds)
            mentorsData = m || []
          }

          sponsorships = linksData.map(link => ({
            ...link,
            student: studentsData.find(s => s.id === link.student_id),
            mentor: mentorsData.find(m => m.id === link.mentor_id)
          }))
        }

        // Fetch sponsorship requests made by this donor
        const { data: requestsData } = await supabase
          .from('sponsorship_requests')
          .select('*')
          .eq('donor_id', user.id)
          .order('created_at', { ascending: false })

        if (requestsData && requestsData.length > 0) {
          const studentIds = [...new Set(requestsData.map(r => r.student_id).filter(Boolean))]
          if (studentIds.length > 0) {
            const { data: studentsData } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', studentIds)

            requests = requestsData.map(req => ({
              ...req,
              student: studentsData?.find(s => s.id === req.student_id)
            }))
          } else {
            requests = requestsData
          }
        }
      } else if (user.role === 'mentor') {
        // Fetch students assigned to this mentor
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, school_name, grade_level, gpa, status')
          .eq('mentor_id', user.id)

        if (studentsData && studentsData.length > 0) {
          const studentIds = studentsData.map(s => s.id)
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)

          assignedStudents = studentsData.map(student => ({
            ...student,
            profile: profilesData?.find(p => p.id === student.id)
          }))
        }

        // Fetch reports from assigned students
        if (assignedStudents.length > 0) {
          const studentIds = assignedStudents.map(s => s.id)
          
          const { data: weeklyData } = await supabase
            .from('weekly_volunteer_reports')
            .select('*')
            .in('student_id', studentIds)
            .order('week_start_date', { ascending: false })
          weeklyReports = weeklyData || []

          const { data: academicData } = await supabase
            .from('academic_reports')
            .select('*')
            .in('student_id', studentIds)
            .order('academic_year', { ascending: false })
          academicReports = academicData || []
        }
      }

      setUserDetailData({
        sponsorships,
        requests,
        weeklyReports,
        academicReports,
        receipts,
        assignedStudents,
        sponsoredStudents
      })
    } catch (error) {
      console.error('Error fetching user detail data:', error)
    } finally {
      setLoadingUserDetails(false)
    }
  }

  // Define navigation items
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📈' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'sponsorships', label: 'Sponsorships', icon: '🤝' },
    { id: 'reports', label: 'Reports & Receipts', icon: '📊' },
  ]

  // Check if we need extra menu items on mobile (more than 5 items)
  const showExtraMobileMenu = navigationItems.length > 5

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white/80 backdrop-blur-sm border-r border-gray-200/50 shadow-lg">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200/50 bg-gradient-to-r from-indigo-600 to-indigo-700">
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="px-4 py-4 border-t border-gray-200/50">
            <div className="flex items-center space-x-3 mb-4 px-4 py-2 rounded-lg bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {profile?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-gray-500 truncate">Administrator</p>
              </div>
            </div>
              <button
                onClick={signOut}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm transition-colors duration-200"
              >
              <span>🚪</span>
              <span>Sign Out</span>
              </button>
            </div>
          </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top Header - Mobile */}
        <header className="lg:hidden bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between h-16 px-4">
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
        </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8">
        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

            {/* Page Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {navigationItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to Admin Dashboard'}
              </p>
          </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Total Users Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1">Total Users</h2>
                  <p className="text-sm text-gray-500">All registered users in the system</p>
          </div>
                <div className="text-right">
                  <span className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{users.length}</span>
                  <p className="text-xs text-gray-500">total</p>
          </div>
          </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-5 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200/50 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👨‍💼</span>
                  </div>
                  <p className="text-xs font-medium text-red-700 mb-1">Admins</p>
                  <p className="text-2xl font-bold text-red-900">{users.filter(u => u.role === 'admin').length}</p>
                </div>
                <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💙</span>
                  </div>
                  <p className="text-xs font-medium text-blue-700 mb-1">Donors</p>
                  <p className="text-2xl font-bold text-blue-900">{users.filter(u => u.role === 'donor').length}</p>
                </div>
                <div className="text-center p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200/50 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎓</span>
                  </div>
                  <p className="text-xs font-medium text-purple-700 mb-1">Mentors</p>
                  <p className="text-2xl font-bold text-purple-900">{users.filter(u => u.role === 'mentor').length}</p>
                </div>
                <div className="text-center p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200/50 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <p className="text-xs font-medium text-indigo-700 mb-1">Students</p>
                  <p className="text-2xl font-bold text-indigo-900">{users.filter(u => u.role === 'student').length}</p>
                </div>
          </div>
        </div>

            {/* Quick Overview */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Quick Overview</h2>
                <p className="text-sm text-gray-500">Key metrics at a glance</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="relative text-center p-6 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 rounded-xl border border-blue-200/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-2xl">🤝</span>
                    </div>
                    <p className="text-sm font-semibold text-blue-700 mb-2">Sponsorship Requests</p>
                    <p className="text-3xl font-bold text-blue-900">{sponsorshipRequests.length}</p>
                  </div>
                </div>
                <div className="relative text-center p-6 bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 rounded-xl border border-purple-200/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-200/30 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="text-sm font-semibold text-purple-700 mb-2">Weekly Reports</p>
                    <p className="text-3xl font-bold text-purple-900">{weeklyReports.length}</p>
                  </div>
                </div>
                <div className="relative text-center p-6 bg-gradient-to-br from-green-50 via-green-100 to-green-50 rounded-xl border border-green-200/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-2xl">💰</span>
                    </div>
                    <p className="text-sm font-semibold text-green-700 mb-2">Tuition Receipts</p>
                    <p className="text-3xl font-bold text-green-900">{receipts.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {/* Category Filter Buttons and Create Button */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Category Buttons */}
                <div className="flex flex-wrap gap-2">
            <button
                    onClick={() => setUserCategoryFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      userCategoryFilter === 'all'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Users
            </button>
            <button
                    onClick={() => setUserCategoryFilter('admin')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      userCategoryFilter === 'admin'
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Admins
            </button>
            <button
                    onClick={() => setUserCategoryFilter('donor')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      userCategoryFilter === 'donor'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Donors
            </button>
                  <button
                    onClick={() => setUserCategoryFilter('mentor')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      userCategoryFilter === 'mentor'
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Mentors
                  </button>
                  <button
                    onClick={() => setUserCategoryFilter('student')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      userCategoryFilter === 'student'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Students
                  </button>
        </div>

                {/* Create New User Button */}
              <button
                onClick={() => {
                  setShowCreateForm(!showCreateForm)
                  setEditingUser(null)
                  setError('')
                  setSuccess('')
                }}
                  className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                    showCreateForm
                      ? 'bg-gray-500 text-white hover:bg-gray-600'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800'
                  }`}
                >
                  {showCreateForm ? '✕ Cancel' : '+ Create New User'}
              </button>
              </div>
            </div>

        {/* Edit User Form */}
        {editingUser && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Edit User: {editingUser.full_name}</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={editFormData.full_name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={editFormData.phone_number}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, phone_number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={editFormData.gender}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, gender: e.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={editFormData.role}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, role: e.target.value })
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="donor">Donor</option>
                    <option value="mentor">Mentor</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password (leave empty to keep current)
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter new password or leave empty"
                    value={editFormData.password}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, password: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
                >
                  Update User
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="donor">Donor</option>
                    <option value="mentor">Mentor</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password (leave empty to auto-generate)
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
              >
                Create User
              </button>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">All Users</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gender
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users
                    .filter((user) => userCategoryFilter === 'all' || user.role === userCategoryFilter)
                    .map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.phone_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.gender || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <button
                            onClick={async () => {
                              setSelectedUserForView(user)
                              setShowUserDetailModal(true)
                              await fetchUserDetailData(user)
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
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
          </>
        )}

        {/* Sponsorships Tab */}
        {activeTab === 'sponsorships' && (
          <>
            {/* Category Filter Buttons */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSponsorshipCategoryFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    sponsorshipCategoryFilter === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Sponsorships
                </button>
                <button
                  onClick={() => setSponsorshipCategoryFilter('requests')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    sponsorshipCategoryFilter === 'requests'
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Requests ({sponsorshipRequests.length})
                </button>
                <button
                  onClick={() => setSponsorshipCategoryFilter('active')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    sponsorshipCategoryFilter === 'active'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Active Sponsorships ({activeSponsorships.length})
                </button>
              </div>
            </div>

            {/* Sponsorship Requests Section */}
            {(sponsorshipCategoryFilter === 'all' || sponsorshipCategoryFilter === 'requests') && (
              <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-xl border border-white/20 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200/50">
              <h2 className="text-xl font-semibold">Sponsorship Requests</h2>
            </div>
            {sponsorshipRequests.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No sponsorship requests</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sponsorshipRequests.map((request) => (
                          <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.donor?.full_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {request.student?.profiles?.full_name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.student?.school_name} - Grade {request.student?.grade_level}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${request.requested_amount?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-xs truncate">
                            {request.message || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {request.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => {
                                    setSelectedSponsorshipForView(request)
                                    setSponsorshipDetailType('request')
                                    setShowSponsorshipDetailModal(true)
                                  }}
                                  className="text-blue-600 hover:text-blue-900 font-medium"
                                >
                                  View
                                </button>
                                {request.status === 'pending' && (
                                  <>
                              <button
                                onClick={() => handleApproveRequest(request.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(request.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                                  </>
                                )}
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

            {/* Active Sponsorships Section */}
            {(sponsorshipCategoryFilter === 'all' || sponsorshipCategoryFilter === 'active') && (
              <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-xl border border-white/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200/50">
                <h2 className="text-xl font-semibold">Active Sponsorships</h2>
              </div>
              {activeSponsorships.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No active sponsorships</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mentor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeSponsorships.map((link) => (
                          <tr key={link.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {link.student?.profiles?.full_name || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {link.student?.school_name || '-'} - Grade {link.student?.grade_level || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {link.donor?.full_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {link.mentor?.full_name || 'Not assigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${link.annual_amount?.toLocaleString() || '0.00'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {link.start_date ? new Date(link.start_date).toLocaleDateString() : '-'}
                          </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => {
                                  setSelectedSponsorshipForView(link)
                                  setSponsorshipDetailType('active')
                                  setShowSponsorshipDetailModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View
                              </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
            )}
          </>
        )}

        {/* Reports & Receipts Tab */}
        {activeTab === 'reports' && (
          <>
            {/* Category Filter Buttons */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 mb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReportsCategoryFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    reportsCategoryFilter === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Reports & Receipts
                </button>
                <button
                  onClick={() => setReportsCategoryFilter('weekly')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    reportsCategoryFilter === 'weekly'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Weekly Reports ({weeklyReports.length})
                </button>
                <button
                  onClick={() => setReportsCategoryFilter('academic')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    reportsCategoryFilter === 'academic'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Academic Reports ({academicReports.length})
                </button>
                <button
                  onClick={() => setReportsCategoryFilter('receipts')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    reportsCategoryFilter === 'receipts'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tuition Receipts ({receipts.length})
                </button>
              </div>
              
              {/* Status Filter - Available for all categories */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200/50">
                <span className="text-sm font-semibold text-gray-700 mr-2">Status Filter:</span>
                  <button
                    onClick={() => setReportStatusFilter('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${
                    reportStatusFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setReportStatusFilter('pending')}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${
                    reportStatusFilter === 'pending' ? 'bg-yellow-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setReportStatusFilter('approved')}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${
                    reportStatusFilter === 'approved' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => setReportStatusFilter('rejected')}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${
                    reportStatusFilter === 'rejected' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Rejected
                  </button>
                {/* Add Verified status for receipts */}
                {(reportsCategoryFilter === 'all' || reportsCategoryFilter === 'receipts') && (
                  <button
                    onClick={() => setReportStatusFilter('verified')}
                    className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${
                      reportStatusFilter === 'verified' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Verified
                  </button>
                )}
                </div>
            </div>

            {/* Weekly Reports Section */}
            {(reportsCategoryFilter === 'all' || reportsCategoryFilter === 'weekly') && (
              <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-xl border border-white/20 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200/50">
                  <h2 className="text-xl font-semibold">Weekly Volunteer Reports</h2>
              </div>
              {weeklyReports.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No weekly reports found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">
                              {report.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              report.status === 'approved' ? 'bg-green-100 text-green-800' :
                              report.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {report.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(report.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => {
                                  setSelectedReportForView(report)
                                  setReportDetailType('weekly')
                                  setShowReportDetailModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View
                              </button>
                              {report.status === 'pending' && (
                                <>
                                <button
                                  onClick={() => handleApproveWeeklyReport(report.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectWeeklyReport(report.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Reject
                                </button>
                                </>
                              )}
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

            {/* Academic Reports Section */}
            {(reportsCategoryFilter === 'all' || reportsCategoryFilter === 'academic') && (
              <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-xl border border-white/20 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200/50">
                <h2 className="text-xl font-semibold">Academic Reports</h2>
              </div>
              {academicReports.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No academic reports found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPA</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {academicReports.map((report) => (
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              report.status === 'approved' ? 'bg-green-100 text-green-800' :
                              report.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {report.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(report.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => {
                                  setSelectedReportForView(report)
                                  setReportDetailType('academic')
                                  setShowReportDetailModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View
                              </button>
                              {report.status === 'pending' && (
                                <>
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
                                </>
                              )}
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

            {/* Tuition Receipts Section */}
            {(reportsCategoryFilter === 'all' || reportsCategoryFilter === 'receipts') && (
              <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-xl border border-white/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200/50">
                <h2 className="text-xl font-semibold">Tuition Receipts</h2>
              </div>
              {receipts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No tuition receipts found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {receipts.map((receipt) => (
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              receipt.status === 'verified' ? 'bg-green-100 text-green-800' :
                              receipt.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {receipt.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(receipt.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => {
                                  setSelectedReportForView(receipt)
                                  setReportDetailType('receipt')
                                  setShowReportDetailModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View
                              </button>
                              {receipt.status === 'pending' && (
                                <>
                                <button
                                  onClick={() => handleVerifyReceipt(receipt.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => handleRejectReceipt(receipt.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Reject
                                </button>
                                </>
                              )}
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
          </>
        )}
      </div>

      {/* Mentor Assignment Modal */}
      {showMentorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">
              Assign/Reassign Mentor
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Mentor (Optional)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                >
                  <option value="">No mentor assigned</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.full_name} ({mentor.email})
                    </option>
                  ))}
                </select>
                {mentors.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No mentors available. Create mentors in User Management.</p>
                )}
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleUpdateStudentMentor()}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowMentorModal(false)
                    setSelectedStudentId(null)
                    setSelectedMentorId('')
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Information Modal */}
      {showEditStudentModal && selectedStudentForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">
              Edit Student Information - {selectedStudentForEdit.full_name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={editStudentFormData.school_name}
                  onChange={(e) => setEditStudentFormData({ ...editStudentFormData, school_name: e.target.value })}
                  placeholder="Enter school name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Level
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={editStudentFormData.grade_level}
                  onChange={(e) => setEditStudentFormData({ ...editStudentFormData, grade_level: e.target.value })}
                  placeholder="e.g., Grade 10, 11, 12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GPA (Last Semester)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={editStudentFormData.gpa}
                  onChange={(e) => setEditStudentFormData({ ...editStudentFormData, gpa: e.target.value })}
                  placeholder="e.g., 3.5"
                />
                <p className="text-xs text-gray-500 mt-1">Enter GPA on a 4.0 scale (0.0 - 4.0)</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleUpdateStudentInfo()}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowEditStudentModal(false)
                    setSelectedStudentForEdit(null)
                    setEditStudentFormData({ school_name: '', grade_level: '', gpa: '' })
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail View Modal */}
      {showUserDetailModal && selectedUserForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">User Details</h2>
              <button
                onClick={() => {
                  setShowUserDetailModal(false)
                  setSelectedUserForView(null)
                }}
                className="text-white hover:text-gray-200 text-2xl font-bold transition-colors duration-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information Section */}
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Full Name</label>
                    <p className="text-base text-gray-900 font-medium">{selectedUserForView.full_name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                    <p className="text-base text-gray-900 font-medium">{selectedUserForView.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Phone Number</label>
                    <p className="text-base text-gray-900 font-medium">{selectedUserForView.phone_number || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Gender</label>
                    <p className="text-base text-gray-900 font-medium">{selectedUserForView.gender || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Role</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(selectedUserForView.role)}`}>
                      {selectedUserForView.role || '-'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">User ID</label>
                    <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedUserForView.id || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Dates Section */}
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Account Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Account Created</label>
                    <p className="text-base text-gray-900 font-medium">
                      {selectedUserForView.created_at 
                        ? new Date(selectedUserForView.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Last Updated</label>
                    <p className="text-base text-gray-900 font-medium">
                      {selectedUserForView.updated_at 
                        ? new Date(selectedUserForView.updated_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {loadingUserDetails && (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <p className="text-gray-600">Loading user details...</p>
                </div>
              )}

              {/* Student-Specific Information */}
              {selectedUserForView.role === 'student' && !loadingUserDetails && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    {(() => {
                      const studentInfo = students.find(s => s.id === selectedUserForView.id)
                      return studentInfo ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">School Name</label>
                            <p className="text-base text-gray-900 font-medium">{studentInfo.school_name || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Grade Level</label>
                            <p className="text-base text-gray-900 font-medium">{studentInfo.grade_level || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">GPA (Last Semester)</label>
                            <p className="text-base text-gray-900 font-medium">{studentInfo.gpa || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Assigned Mentor</label>
                            <p className="text-base text-gray-900 font-medium">{studentInfo.mentor?.full_name || 'Not assigned'}</p>
                            {studentInfo.mentor?.email && (
                              <p className="text-sm text-gray-500 mt-1">{studentInfo.mentor.email}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(studentInfo.status || 'active')}`}>
                              {studentInfo.status || 'active'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No additional student information available.</p>
                      )
                    })()}
                  </div>

                  {/* Sponsorships */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Sponsorships ({userDetailData.sponsorships.length})</h3>
                    {userDetailData.sponsorships.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailData.sponsorships.map((sponsorship) => (
                          <div key={sponsorship.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Donor:</span>
                                <p className="text-gray-900">{sponsorship.donor?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Mentor:</span>
                                <p className="text-gray-900">{sponsorship.mentor?.full_name || 'Not assigned'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Amount:</span>
                                <p className="text-gray-900">${sponsorship.annual_amount?.toLocaleString() || '0'}/year</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(sponsorship.status || 'active')}`}>
                                  {sponsorship.status || 'active'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No sponsorships found.</p>
                    )}
                  </div>

                  {/* Sponsorship Requests */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Sponsorship Requests ({userDetailData.requests.length})</h3>
                    {userDetailData.requests.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailData.requests.map((request) => (
                          <div key={request.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Donor:</span>
                                <p className="text-gray-900">{request.donor?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Amount:</span>
                                <p className="text-gray-900">${request.requested_amount?.toLocaleString() || '0'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status || 'pending')}`}>
                                  {request.status || 'pending'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Date:</span>
                                <p className="text-gray-900">{new Date(request.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No sponsorship requests found.</p>
                    )}
                  </div>

                  {/* Weekly Reports */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Weekly Reports ({userDetailData.weeklyReports.length})</h3>
                    {userDetailData.weeklyReports.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {userDetailData.weeklyReports.slice(0, 10).map((report) => (
                          <div key={report.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Week:</span>
                                <p className="text-gray-900">{new Date(report.week_start_date).toLocaleDateString()} - {new Date(report.week_end_date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Hours:</span>
                                <p className="text-gray-900">{report.volunteer_hours || '0'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status || 'pending')}`}>
                                  {report.status || 'pending'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Submitted:</span>
                                <p className="text-gray-900">{new Date(report.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {userDetailData.weeklyReports.length > 10 && (
                          <p className="text-xs text-gray-500 text-center">Showing 10 of {userDetailData.weeklyReports.length} reports</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No weekly reports found.</p>
                    )}
                  </div>

                  {/* Academic Reports */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Academic Reports ({userDetailData.academicReports.length})</h3>
                    {userDetailData.academicReports.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {userDetailData.academicReports.slice(0, 10).map((report) => (
                          <div key={report.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Semester:</span>
                                <p className="text-gray-900">{report.semester || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Academic Year:</span>
                                <p className="text-gray-900">{report.academic_year || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">GPA:</span>
                                <p className="text-gray-900">{report.gpa || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status || 'pending')}`}>
                                  {report.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {userDetailData.academicReports.length > 10 && (
                          <p className="text-xs text-gray-500 text-center">Showing 10 of {userDetailData.academicReports.length} reports</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No academic reports found.</p>
                    )}
                  </div>

                  {/* Tuition Receipts */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Tuition Receipts ({userDetailData.receipts.length})</h3>
                    {userDetailData.receipts.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {userDetailData.receipts.slice(0, 10).map((receipt) => (
                          <div key={receipt.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Date:</span>
                                <p className="text-gray-900">{new Date(receipt.receipt_date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Amount:</span>
                                <p className="text-gray-900">${receipt.amount?.toLocaleString() || '0.00'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Semester:</span>
                                <p className="text-gray-900">{receipt.semester || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(receipt.status || 'pending')}`}>
                                  {receipt.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {userDetailData.receipts.length > 10 && (
                          <p className="text-xs text-gray-500 text-center">Showing 10 of {userDetailData.receipts.length} receipts</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No tuition receipts found.</p>
                    )}
                  </div>
                </>
              )}

              {/* Donor-Specific Information */}
              {selectedUserForView.role === 'donor' && !loadingUserDetails && (
                <>
                  {/* Sponsorships */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Active Sponsorships ({userDetailData.sponsorships.length})</h3>
                    {userDetailData.sponsorships.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailData.sponsorships.map((sponsorship) => (
                          <div key={sponsorship.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Student:</span>
                                <p className="text-gray-900">{sponsorship.student?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Mentor:</span>
                                <p className="text-gray-900">{sponsorship.mentor?.full_name || 'Not assigned'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Amount:</span>
                                <p className="text-gray-900">${sponsorship.annual_amount?.toLocaleString() || '0'}/year</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Start Date:</span>
                                <p className="text-gray-900">{new Date(sponsorship.start_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No active sponsorships found.</p>
                    )}
                  </div>

                  {/* Sponsorship Requests */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Sponsorship Requests ({userDetailData.requests.length})</h3>
                    {userDetailData.requests.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailData.requests.map((request) => (
                          <div key={request.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Student:</span>
                                <p className="text-gray-900">{request.student?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Amount:</span>
                                <p className="text-gray-900">${request.requested_amount?.toLocaleString() || '0'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status || 'pending')}`}>
                                  {request.status || 'pending'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Date:</span>
                                <p className="text-gray-900">{new Date(request.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No sponsorship requests found.</p>
                    )}
                  </div>
                </>
              )}

              {/* Mentor-Specific Information */}
              {selectedUserForView.role === 'mentor' && !loadingUserDetails && (
                <>
                  {/* Assigned Students */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Assigned Students ({userDetailData.assignedStudents.length})</h3>
                    {userDetailData.assignedStudents.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailData.assignedStudents.map((student) => (
                          <div key={student.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Name:</span>
                                <p className="text-gray-900">{student.profile?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Email:</span>
                                <p className="text-gray-900">{student.profile?.email || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">School:</span>
                                <p className="text-gray-900">{student.school_name || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Grade:</span>
                                <p className="text-gray-900">{student.grade_level || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">GPA:</span>
                                <p className="text-gray-900">{student.gpa || '-'}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600">Status:</span>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(student.status || 'active')}`}>
                                  {student.status || 'active'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No assigned students found.</p>
                    )}
                  </div>

                  {/* Reports from Assigned Students */}
                  {(userDetailData.weeklyReports.length > 0 || userDetailData.academicReports.length > 0) && (
                    <>
                      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Weekly Reports ({userDetailData.weeklyReports.length})</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {userDetailData.weeklyReports.slice(0, 10).map((report) => (
                            <div key={report.id} className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-semibold text-gray-600">Week:</span>
                                  <p className="text-gray-900">{new Date(report.week_start_date).toLocaleDateString()} - {new Date(report.week_end_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Hours:</span>
                                  <p className="text-gray-900">{report.volunteer_hours || '0'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Status:</span>
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status || 'pending')}`}>
                                    {report.status || 'pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Academic Reports ({userDetailData.academicReports.length})</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {userDetailData.academicReports.slice(0, 10).map((report) => (
                            <div key={report.id} className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-semibold text-gray-600">Semester:</span>
                                  <p className="text-gray-900">{report.semester || '-'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Academic Year:</span>
                                  <p className="text-gray-900">{report.academic_year || '-'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">GPA:</span>
                                  <p className="text-gray-900">{report.gpa || '-'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Status:</span>
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status || 'pending')}`}>
                                    {report.status || 'pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowUserDetailModal(false)
                    handleEditUser(selectedUserForView)
                  }}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Edit User
                </button>
                <button
                  onClick={() => {
                    setShowUserDetailModal(false)
                    setSelectedUserForView(null)
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sponsorship Detail View Modal */}
      {showSponsorshipDetailModal && selectedSponsorshipForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {sponsorshipDetailType === 'request' ? 'Sponsorship Request Details' : 'Active Sponsorship Details'}
              </h2>
              <button
                onClick={() => {
                  setShowSponsorshipDetailModal(false)
                  setSelectedSponsorshipForView(null)
                  setSponsorshipDetailType(null)
                }}
                className="text-white hover:text-gray-200 text-2xl font-bold transition-colors duration-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Request Details (if viewing a request) */}
              {sponsorshipDetailType === 'request' && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Request Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Request ID</label>
                        <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedSponsorshipForView.id || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedSponsorshipForView.status || 'pending')}`}>
                          {selectedSponsorshipForView.status || 'pending'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Requested Amount</label>
                        <p className="text-base text-gray-900 font-medium">${selectedSponsorshipForView.requested_amount?.toLocaleString() || '0'}/year</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Date Submitted</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedSponsorshipForView.created_at 
                            ? new Date(selectedSponsorshipForView.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </p>
                      </div>
                      {selectedSponsorshipForView.reviewed_at && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed At</label>
                            <p className="text-base text-gray-900 font-medium">
                              {new Date(selectedSponsorshipForView.reviewed_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed By</label>
                            <p className="text-base text-gray-900 font-medium">
                              {selectedSponsorshipForView.reviewed_by || 'N/A'}
                            </p>
                          </div>
                        </>
                      )}
                      {selectedSponsorshipForView.message && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Message</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedSponsorshipForView.message}
                          </p>
                        </div>
                      )}
                      {selectedSponsorshipForView.admin_notes && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Admin Notes</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedSponsorshipForView.admin_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Donor Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Donor Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.donor?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.donor?.email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.profiles?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.profiles?.email || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">School</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.school_name || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Grade Level</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.grade_level || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Active Sponsorship Details */}
              {sponsorshipDetailType === 'active' && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Sponsorship Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Sponsorship ID</label>
                        <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedSponsorshipForView.id || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedSponsorshipForView.status || 'active')}`}>
                          {selectedSponsorshipForView.status || 'active'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Annual Amount</label>
                        <p className="text-base text-gray-900 font-medium">${selectedSponsorshipForView.annual_amount?.toLocaleString() || '0.00'}/year</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Start Date</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedSponsorshipForView.start_date 
                            ? new Date(selectedSponsorshipForView.start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : '-'}
                        </p>
                      </div>
                      {selectedSponsorshipForView.end_date && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">End Date</label>
                          <p className="text-base text-gray-900 font-medium">
                            {new Date(selectedSponsorshipForView.end_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Created At</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedSponsorshipForView.created_at 
                            ? new Date(selectedSponsorshipForView.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Student Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.profiles?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.profiles?.email || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">School</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.school_name || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Grade Level</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.student?.grade_level || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Donor Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Donor Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.donor?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.donor?.email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mentor Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Mentor Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.mentor?.full_name || 'Not assigned'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedSponsorshipForView.mentor?.email || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowSponsorshipDetailModal(false)
                    setSelectedSponsorshipForView(null)
                    setSponsorshipDetailType(null)
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report & Receipt Detail View Modal */}
      {showReportDetailModal && selectedReportForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {reportDetailType === 'weekly' && 'Weekly Report Details'}
                {reportDetailType === 'academic' && 'Academic Report Details'}
                {reportDetailType === 'receipt' && 'Tuition Receipt Details'}
              </h2>
              <button
                onClick={() => {
                  setShowReportDetailModal(false)
                  setSelectedReportForView(null)
                  setReportDetailType(null)
                }}
                className="text-white hover:text-gray-200 text-2xl font-bold transition-colors duration-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Weekly Report Details */}
              {reportDetailType === 'weekly' && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Report Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Report ID</label>
                        <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedReportForView.id || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedReportForView.status || 'pending')}`}>
                          {selectedReportForView.status || 'pending'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Week Start Date</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.week_start_date 
                            ? new Date(selectedReportForView.week_start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Week End Date</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.week_end_date 
                            ? new Date(selectedReportForView.week_end_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Volunteer Hours</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.volunteer_hours || '0'} hours</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Submitted At</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.created_at 
                            ? new Date(selectedReportForView.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </p>
                      </div>
                      {selectedReportForView.reviewed_at && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed At</label>
                            <p className="text-base text-gray-900 font-medium">
                              {new Date(selectedReportForView.reviewed_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed By</label>
                            <p className="text-base text-gray-900 font-medium">
                              {selectedReportForView.reviewed_by || 'N/A'}
                            </p>
                          </div>
                        </>
                      )}
                      {selectedReportForView.description && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedReportForView.description}
                          </p>
                        </div>
                      )}
                      {selectedReportForView.admin_notes && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Admin Notes</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedReportForView.admin_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.email || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Academic Report Details */}
              {reportDetailType === 'academic' && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Report Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Report ID</label>
                        <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedReportForView.id || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedReportForView.status || 'pending')}`}>
                          {selectedReportForView.status || 'pending'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Semester</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.semester || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Academic Year</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.academic_year || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">GPA</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.gpa || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Submitted At</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.created_at 
                            ? new Date(selectedReportForView.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </p>
                      </div>
                      {selectedReportForView.reviewed_at && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed At</label>
                            <p className="text-base text-gray-900 font-medium">
                              {new Date(selectedReportForView.reviewed_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed By</label>
                            <p className="text-base text-gray-900 font-medium">
                              {selectedReportForView.reviewed_by || 'N/A'}
                            </p>
                          </div>
                        </>
                      )}
                      {selectedReportForView.admin_notes && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Admin Notes</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedReportForView.admin_notes}
                          </p>
                        </div>
                      )}
                      {selectedReportForView.can_resubmit !== undefined && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Can Resubmit</label>
                          <p className="text-base text-gray-900 font-medium">{selectedReportForView.can_resubmit ? 'Yes' : 'No'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.email || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tuition Receipt Details */}
              {reportDetailType === 'receipt' && (
                <>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Receipt Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Receipt ID</label>
                        <p className="text-base text-gray-900 font-mono text-xs break-all">{selectedReportForView.id || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedReportForView.status || 'pending')}`}>
                          {selectedReportForView.status || 'pending'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Receipt Date</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.receipt_date 
                            ? new Date(selectedReportForView.receipt_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Amount</label>
                        <p className="text-base text-gray-900 font-medium">${selectedReportForView.amount?.toLocaleString() || '0.00'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Semester</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.semester || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Submitted At</label>
                        <p className="text-base text-gray-900 font-medium">
                          {selectedReportForView.created_at 
                            ? new Date(selectedReportForView.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </p>
                      </div>
                      {selectedReportForView.reviewed_at && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed At</label>
                            <p className="text-base text-gray-900 font-medium">
                              {new Date(selectedReportForView.reviewed_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Reviewed By</label>
                            <p className="text-base text-gray-900 font-medium">
                              {selectedReportForView.reviewed_by || 'N/A'}
                            </p>
                          </div>
                        </>
                      )}
                      {selectedReportForView.admin_notes && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Admin Notes</label>
                          <p className="text-base text-gray-900 font-medium whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                            {selectedReportForView.admin_notes}
                          </p>
                        </div>
                      )}
                      {selectedReportForView.receipt_url && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Receipt File</label>
                          <a 
                            href={selectedReportForView.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 underline font-medium"
                          >
                            View Receipt File
                          </a>
                        </div>
                      )}
                      {selectedReportForView.can_resubmit !== undefined && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Can Resubmit</label>
                          <p className="text-base text-gray-900 font-medium">{selectedReportForView.can_resubmit ? 'Yes' : 'No'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Information */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Student Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                        <p className="text-base text-gray-900 font-medium">{selectedReportForView.student?.email || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowReportDetailModal(false)
                    setSelectedReportForView(null)
                    setReportDetailType(null)
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </main>

        {/* Bottom Menu - Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 shadow-lg z-20 safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {navigationItems.slice(0, 5).map((item) => (
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
                <span className="text-xs font-medium truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
              </button>
            ))}
            {showExtraMobileMenu && navigationItems.length > 5 && (
              <button
                onClick={() => setActiveTab(navigationItems[5].id)}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[60px] transition-all duration-200 ${
                  activeTab === navigationItems[5].id
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl mb-1">{navigationItems[5].icon}</span>
                <span className="text-xs font-medium truncate max-w-[60px]">{navigationItems[5].label.split(' ')[0]}</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}
