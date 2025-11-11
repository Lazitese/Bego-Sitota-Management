import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi'
import logo from '../assets/logo.jpg'
import { isValidEmail } from '../utils/validation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, profile, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && profile) {
      redirectBasedOnRole(profile.role)
    }
  }, [user, profile])

  const redirectBasedOnRole = (role) => {
    switch (role) {
      case 'admin':
        navigate('/admin')
        break
      case 'donor':
        navigate('/donor')
        break
      case 'mentor':
        navigate('/mentor')
        break
      case 'student':
        navigate('/student')
        break
      default:
        navigate('/unauthorized')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Input validation
    if (!email || !email.trim()) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    if (!password || password.length < 1) {
      setError('Please enter your password')
      setLoading(false)
      return
    }

    const result = await signIn(email.trim().toLowerCase(), password)

    if (result.success) {
      // Redirect will happen via useEffect
    } else {
      // Don't expose specific error details for security
      const errorMessage = result.error || 'Failed to sign in'
      if (errorMessage.includes('Invalid login') || errorMessage.includes('Invalid credentials')) {
        setError('Invalid email or password')
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Please verify your email address before signing in')
      } else {
        setError('Failed to sign in. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-10 space-y-8">
          {/* Logo and Brand */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center mb-6">
              <div className="flex-shrink-0 w-32 h-32 relative">
                <img 
                  src={logo} 
                  alt="Bego Sitota Logo" 
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                Sign in to your account
              </p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white text-sm"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500 transition-all duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <FiLogIn className="w-5 h-5" />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

