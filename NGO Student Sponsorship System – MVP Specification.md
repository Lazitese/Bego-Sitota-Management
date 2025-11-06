# **NGO Student Sponsorship System – MVP Specification**

## **1\. System Overview**

This system streamlines the **sponsorship process between Admins, Sponsored Students, Donors, and Mentors**. It ensures **transparent communication, easy student-donor linking, and proper monitoring of sponsored students' activities**.  
 The MVP focuses on **core functionality only**—no unnecessary complexity.

---

## **2\. User Roles & Permissions**

### **2.1 Admin**

**Responsibilities:**

* Manage all users (create, edit, delete).

* Approve sponsorship requests, reports, and receipts.

* Oversee donor-student-mentor assignments.

* Manage notifications and maintain overall system integrity.

**Key Features:**

1. **User Management**

   * Create and manage:

     * Admins

     * Donors

     * Mentors

     * Students

   * **Student Registration Form:**

     * Full Name

     * University/School Name

     * Gender

     * Phone Number

     * Email

     * File Upload (optional additional details)

   * **Mentor, Donor, Admin Registration Form:**

     * Full Name

     * Gender

     * Phone Number

     * Email

2. **Student Management**

   * View, edit, or delete student profiles.

   * Assign/reassign mentors.

   * View all reports, receipts, sponsorship status.

3. **Donor Management**

   * View, edit, or delete donor profiles.

   * See students linked to each donor.

   * Assign one or more students manually to donors (optional).

4. **Sponsor Management**

   * Receive sponsorship requests from donors.

   * Approve or reject requests (one-click decision).

   * Assign students to donors manually (optional).

   * Allow multiple donors per student if needed.

5. **Reports & Receipts Approval**

   * Review:

     * Weekly Volunteer Reports

     * Academic Reports (per semester)

     * Tuition Receipts

   * Approve or reject submissions.

   * If rejected, students can **resubmit corrected versions**.

6. **Notifications Center**

   * Receive alerts for:

     * New donor sponsorship requests.

     * New report or receipt submissions.

     * Skipped weekly volunteer reports.

     * Resubmitted reports.

7. **Export Data (Optional but Recommended)**

   * Export student and donor lists to CSV or Excel.

---

### **2.2 Mentor**

**Responsibilities:**

* Support assigned students.

* Monitor student progress and verify reports.

**Key Features:**

* View assigned students and their submissions.

* Submit mentoring session reports to Admin.

* Approve/reject academic reports (shared responsibility with Admin).

* Receive notifications for:

  * New reports

  * Skipped weekly reports

---

### **2.3 Donor**

**Responsibilities:**

* Select students to sponsor.

* View approved student updates and financial proof.

**Key Features:**

* Browse student list and **click “Sponsor”** to send a sponsorship request to Admin.

* Wait for Admin approval before sponsorship is confirmed.

* Access:

  * Academic reports (approved)

  * Weekly volunteer reports (approved)

  * Tuition receipts (verified by Admin)

* View full student profiles (read-only, **no direct chat**).

* Receive notifications for:

  * Request approval or rejection

  * New approved reports or receipts from sponsored students

---

### **2.4 Sponsored Student**

**Responsibilities:**

* Keep donors and mentors informed about their progress.

* Provide documentation for fund usage.

**Key Features:**

1. **Weekly Volunteer Reports**

   * Mandatory submission every week.

   * If skipped, notification sent to Admin and Mentor.

   * Option to upload supporting documents (approval letters, confirmations).

2. **Academic Reports (Per Semester)**

   * Upload academic performance files.

   * Await approval from Admin or Mentor before donor can view.

   * Can resubmit if rejected.

3. **Tuition Receipts**

   * Upload payment receipts as proof of fund usage.

   * Must be verified by Admin before donors can access.

   * Resubmission allowed if rejected.

4. **Notifications**

   * Receive alerts for:

     * Approval/rejection of reports or receipts

     * Sponsorship status updates

---

## **3\. System-Wide Notifications**

* Triggered for:

  * Sponsorship requests and approvals/rejections.

  * New or skipped student reports.

  * New tuition receipts uploaded.

  * Resubmitted reports or receipts.

  * Mentor session updates.

---

## **4\. MVP Functional Scope**

1. **Authentication:** Basic login with email/password for all users.

2. **User Management:** CRUD (Create, Read, Update, Delete) for all roles.

3. **Sponsor Management:** Request-approval flow for donors.

4. **Report Management:** Upload, approve/reject, resubmit process.

5. **Receipts Management:** Upload, approve/reject, resubmit process.

6. **Notifications:** Basic notification center for all relevant events.

7. **Dashboard Summaries (Admin):**

   * Total Students

   * Total Donors

   * Pending Sponsorship Requests

   * Pending Approvals (Reports/Receipts)

---

## **Goal of MVP**

Deliver a **simple but functional** platform that:

* Connects students with donors transparently.

* Allows Admin to oversee and control all processes.

* Provides donors with confidence in how funds are used.

* Ensures proper student activity and reporting flow.

