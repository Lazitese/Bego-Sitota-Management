# NGO Student Sponsorship System

A role-based authentication system for managing student sponsorships in an NGO setting.

## 🔐 Overview

This application provides a secure authentication system with four user roles:
- **Admin**: Full access - can create/manage users, approve sponsorships, reports, and receipts
- **Donor**: Can log in, view sponsored students, see approved reports & receipts
- **Mentor**: Can log in, view assigned students, submit mentor reports, approve academic reports
- **Student**: Can log in, upload weekly volunteer reports, academic reports, and tuition receipts

**Important**: Only Admins can create users - there's no public registration.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (already configured)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 🏗️ Tech Stack

- **Frontend**: React with Vite
- **Backend**: Supabase (Auth + Database + Storage)
- **Styling**: TailwindCSS
- **Routing**: React Router
- **State Management**: React Context API

## 📁 Project Structure

```
src/
├── lib/
│   └── supabase.js          # Supabase client configuration
├── contexts/
│   └── AuthContext.jsx      # Authentication context provider
├── components/
│   └── ProtectedRoute.jsx   # Route protection component
├── pages/
│   ├── Login.jsx            # Login page
│   ├── AdminDashboard.jsx   # Admin user management dashboard
│   ├── DonorDashboard.jsx   # Donor dashboard
│   ├── MentorDashboard.jsx  # Mentor dashboard
│   ├── StudentDashboard.jsx # Student dashboard
│   └── Unauthorized.jsx     # 403 error page
└── App.jsx                  # Main app with routing
```

## 🗄️ Database Schema

### `profiles` table
- `id` (uuid) - Primary key, references `auth.users.id`
- `full_name` (text) - User's full name
- `email` (text) - User's email (synced from auth.users)
- `gender` (text) - Optional gender field
- `phone_number` (text) - Optional phone number
- `role` (enum) - User role: 'admin', 'donor', 'mentor', or 'student'
- `created_at` (timestamp) - Account creation timestamp
- `updated_at` (timestamp) - Last update timestamp

## 🔒 Security Features

- Row Level Security (RLS) enabled on all tables
- Role-based access control (RBAC)
- Protected routes with role verification
- Edge Functions for secure admin operations (user creation/deletion)
- Automatic profile creation via database triggers

## 🛠️ Features

### Authentication
- Email/password login via Supabase Auth
- Automatic role-based redirect after login
- Session management

### Admin Dashboard
- Create new users with role assignment
- View all users
- Delete users
- Auto-generate secure passwords
- User details: name, email, phone, gender, role

### Role-Based Dashboards
Each role has its own dashboard with role-specific placeholder content:
- **Admin**: User management interface
- **Donor**: Placeholder for sponsored students view
- **Mentor**: Placeholder for assigned students view
- **Student**: Placeholder for report uploads

## 📝 Usage

### Creating the First Admin User

Since only admins can create users, you'll need to create the first admin user manually:

1. Go to your Supabase dashboard
2. Navigate to Authentication > Users
3. Click "Add user" manually
4. Set the email and password
5. In the Database tab, insert a profile record:
   ```sql
   INSERT INTO public.profiles (id, full_name, email, role)
   VALUES (
     '<user-id-from-auth-users>',
     'Admin Name',
     'admin@example.com',
     'admin'
   );
   ```

Alternatively, you can use the Supabase Management API or SQL to create the first admin user.

### Creating Users (Admin Only)

1. Log in as an Admin
2. Navigate to the Admin Dashboard
3. Click "Create New User"
4. Fill in the user details:
   - Full Name (required)
   - Email (required)
   - Phone Number (optional)
   - Gender (optional)
   - Role (required)
   - Password (optional - will be auto-generated if left empty)
5. Click "Create User"
6. Copy the generated password to share with the new user

## 🔧 Edge Functions

The application uses Supabase Edge Functions for secure admin operations:

- **create-user**: Creates new users (admin only)
- **delete-user**: Deletes users (admin only)

These functions verify admin permissions before executing operations.

## 📄 License

This project is private and proprietary.
