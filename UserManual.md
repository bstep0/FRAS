# <span style="color:#00853E;">Facial Recognition Attendance System (FRAS) – User Manual</span>

**Team:** Group 3  
**Date:** October 25th, 2025  
**Version:** 1.0
&nbsp;
## <span style="color:#00853E;"> Introduction</span>
Our Facial Recognition Attendance System (FRAS) is a web application that we’ve designed to make the attendance-taking process more efficient. It uses facial recognition to identify and verify a student, then accurately records their attendance in real time. The system provides intuitive and functional dashboards for students, instructors, and administrators.  

**Why it’s useful:**
- Saves time by removing manual roll calls  
- Increases classroom efficiency  
&nbsp;
## <span style="color:#00853E;"> System Requirements</span>


**Hardware Requirements:**
- Computer or laptop with webcam 
   - Minimum camera resolution of 720p.
- Reliable internet connection
   - Connected to UNT's wireless network when attempting attendance recording.

**Software Requirements:**
- Web Browser: Chrome, Firefox, Edge, or Safari
- Operating System: Windows 10+, macOS 10.15+, or Linux  
&nbsp;
## <span style="color:#00853E;"> Installation Guide</span>

### For Students, Instructors, and Administrators 
-  Open your browser and navigate to **[https://csce-4095---it-capstone-i.web.app/](#)** .  
&nbsp;
## <span style="color:#00853E;"> Getting Started</span>

### For Students
- Log in with your assigned student credentials.   
- After successfully logging in you'll be directed to the Student Dashboard.  

### For Instructors
- Log in with your assigned instructor credentials.   
- After successfully logging in you'll be directed to the Instructor Dashboard.   

### For Administrators
- Log in with your assigned administrator credentials.   
- After successfully logging in you'll be directed to the Administrator Dashboard.   
&nbsp;

<img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/LoginPage.png?raw=true" alt="Login Page" height="250" width="512">

<img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/StudentDashboard.png?raw=true" alt="Student Dashboard" height="250" width="512">

<img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/InstructorDashboard.png?raw=true" alt="Instructor Dashboard" height="250" width="512">

&nbsp;
## <span style="color:#00853E;"> Features and Functions</span>

Each user role—Student, Instructor, and Administrator—has its own unique workflows, permissions, and interface features.  
&nbsp;
### <span style="color:#00853E;">Core System Features</span>

| **Feature** | **Description** | **Accessible By** |
|--------------|-----------------|-------------------|
| **Facial Recognition Attendance** | Uses DeepFace and OpenCV to verify student identity via webcam and automatically record attendance. | Student |
| **Manual Override** | Allows instructors to manually mark students present or absent if recognition fails or a device issue occurs. | Instructor |
| **Role-Based Access Control** | Each user role has specific permissions (Student, Instructor, Administrator). | All |
| **Real-Time Dashboard** | Displays ongoing attendance results and recognition events in real time. | Student, Instructor |
| **Attendance Reports** | Generates daily or cumulative attendance records viewable by class and date. | Instructor |
| **Secure Authentication** | Utilizes Firebase Authentication for secure login. | All |
| **Encrypted Data Storage** | Attendance logs and recognition data are encrypted in Firebase Firestore. | Admin |
| **Error Logging** | Records failed recognition attempts or network errors for future review. | Admin |
| **Multi-Device Compatibility** | Accessible on modern browsers across Windows, macOS, and Linux devices. | All |
| **AI Notification** | Notifications are generated 5 minutes before the scheduled class start time and at the scheduled class start time. If a student has >= 5 recorded absences, the instructor is notified | Student, Instructor |
| **IP Geofencing** | For an extra layer of verification, the system checks that the student is and remains in class by making sure the student is connected to UNT's wireless network | All |

&nbsp;
### <span style="color:#00853E;">Student Workflow</span>

Students will primarily use FRAS to record their attendance and view their individual attendance history.

#### Key Actions
- **Login to FRAS**
   - Visit the FRAS web portal and sign in using your UNT or provided credentials.  
   - Grant permission for camera access when prompted.
<img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/LoginPage.png?raw=true" alt="Login Page" height="250" width="512">

- **Facial Recognition Check-In**
   - Select "Start Scan" on Student Dashboard
   <img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/StudentStartScan.png?raw=true" alt="Login Page" height="auto" width="auto">
   - Select a class from the dropdown menu.
   <img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/StudentSelectAClass.png?raw=true" alt="Login Page" height="auto" width="auto">
   - Look directly into the camera and hit "Capture Face".
   <img src="https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/StudentCaptureFace.png?raw=true" alt="Login Page" height="auto" width="auto">
   - The system scans and verifies your identity in real time.  
   - If successful, a confirmation message appears.
- **View Attendance History**
   - Navigate to **My Attendance** to see attendance by course and date.  
   - Check session timestamps, recognition status, and total absences.

#### Student Dashboard Highlights
- Simplified layout showing only enrolled courses.  
- Quick status indicators (✅ Present / ⚠️ Not Recorded).  
- Lightweight for mobile or low-bandwidth devices.  

📸 *Placeholder: Screenshot of Student Dashboard and Check-In Screen.*

---

### <span style="color:#00853E;">Instructor Workflow</span>

Instructors oversee attendance sessions, verify recognition results, and export reports.

#### Key Actions
1. **Login to Instructor Dashboard**
   - Sign in with instructor credentials via the main FRAS login portal.  
   - Verify your class list and session schedule.
2. **Start an Attendance Session**
   - Select a class → click **Start Session**.  
   - The system activates recognition for enrolled students.
3. **Monitor Attendance in Real Time**
   - Watch as students’ faces are detected and marked present automatically.  
   - Each student’s status updates live (green = recognized, gray = pending).
4. **Manual Attendance Edits**
   - Click a student name to override attendance (mark present, absent, or excused).  
   - Useful for edge cases (camera issues or missed scans).
5. **End the Session**
   - Click **End Session** to finalize records.  
   - Data automatically syncs to Firestore and appears in reports.
6. **View & Export Attendance Reports**
   - Navigate to **Reports → Class Summary** to review attendance data.  
   - Export reports as **CSV or PDF** for archival or sharing.

#### Instructor Dashboard Highlights
- Real-time recognition feed  
- Student status list with timestamps  
- Quick buttons for manual correction  
- “End Session” button for closing attendance  

📸 *Placeholder: Screenshot of Instructor Dashboard and Live Recognition Feed.*

---

### <span style="color:#00853E;">Administrator Workflow</span>

Administrators manage system users, roles, database records, and security configurations.

#### Key Actions
1. **Access the Admin Dashboard**
   - Log in with admin credentials.  
   - Admins see system-level metrics, user roles, and application logs.
2. **User and Role Management**
   - Add new users (students, instructors, or other admins).  
   - Assign or modify roles via **User Management** → **Edit Role**.
3. **Course and Roster Management**
   - Create or import course rosters.  
   - Link instructors to courses and students to class lists.
4. **Data Oversight and Maintenance**
   - Review all attendance logs and reports across departments.  
   - Check recognition accuracy and detect repeated failures.
5. **Monitor System Health**
   - View active sessions, failed recognition events, and error logs.  
   - Confirm that Firebase and hosting services are online.
6. **Export Global Reports**
   - Generate institution-wide summaries for attendance trends.  
   - Export as CSV for analytics or auditing purposes.
7. **Security and Backup**
   - Verify database encryption, authentication settings, and API limits.  
   - Perform periodic data integrity checks and backups.

#### Admin Dashboard Highlights
- Global statistics on attendance and recognition accuracy  
- Role-based access editing tools  
- Error log viewer for debugging  
- Quick links to system health reports  

📸 *Placeholder: Screenshot of Admin Dashboard and Analytics Page.*

---

### <span style="color:#00853E;">Additional Functional Notes</span>

- **Session Management:** Instructors can open sessions early to reduce delays at class start.  
- **Error Handling:** All recognition errors are logged and retried automatically where possible.  
- **Cross-Browser Compatibility:** Tested on Chrome, Edge, Firefox, and Safari.  
- **Offline Handling:** If the connection drops, attendance data queues and syncs once the network returns.  
- **Accessibility:** The interface uses high-contrast buttons, large icons, and ARIA labels for accessibility compliance.  

📸 *Placeholder: Screenshots of Error Messages, Reports, and Analytics Graphs.*

---

### <span style="color:#00853E;">Summary</span>

| **User Role** | **Primary Responsibilities** | **Key Tools in Dashboard** |
|----------------|------------------------------|-----------------------------|
| **Student** | Log in, scan face, and verify attendance. | Attendance check-in, attendance history view. |
| **Instructor** | Launch sessions, monitor recognition, adjust attendance. | Live feed, session management, report export. |
| **Administrator** | Manage users, monitor system health, audit data. | User management, analytics, database logs. |

The FRAS platform is designed so that each user can complete their role’s tasks efficiently and intuitively, minimizing manual effort while maintaining security and accuracy across the system.


&nbsp;
## <span style="color:#00853E;">Troubleshooting</span>

If you run into issues while using our Facial Recognition Attendance System (FRAS), use this troubleshooting guide to quickly identify and resolve common problems. Each issue includes the likely cause and a recommended solution.
&nbsp;
### <span style="color:#00853E;">Quick Fix Checklist</span>

Before diving into the detailed fixes, try these steps first:

1. Refresh the page using `Ctrl + F5` (Windows) or `⌘ + Shift + R` (macOS).  
2. Check your internet connection and disable VPNs if active.  
3. Ensure your camera permissions are granted.  
4. Close other apps that might be using the webcam (Zoom, Teams, etc).  
5. Improve lighting and make sure your face is clearly visible.  
6. Log out and back in to refresh your session.  
7. Try another browser (Chrome, Edge, Firefox, or Safari).
&nbsp;
### <span style="color:#00853E;">Common Issues and Solutions</span>

| **Issue** | **Possible Cause** | **Recommended Solution** |
|------------|--------------------|----------------------------|
| **Camera not detected** | Browser permissions are blocked | In Chrome, click the "tune" in the address bar → Camera → Allow Toggle → refresh the page. |
| **Camera already in use** | Another app or browser tab is already using your webcam | Close other tabs or programs (Zoom, Teams, etc.), then reload FRAS. |
| **Face not recognized** | Poor lighting, camera angle, or camera view obstruction | Sit facing the light source, remove hats/masks/face coverings, and clean the camera lens. |
| **Low recognition accuracy** | Outdated or unclear profile photo | Ask an administrator to update your reference photo in FRAS. |
| **Page freezes or loads slowly** | Weak Wi-Fi connection or high CPU usage | Switch to a stronger network and close unused programs/tabs. |
| **Attendance not showing up** | Recognition timeout or sync delay | Wait a few minutes, refresh the dashboard, or ask your instructor to verify your attendance records. |
| **Login error / Invalid credentials** | Typo, expired session, or account mismatch | Re-enter credentials carefully, reset your password through UNT’s portal, or contact support. |
| **Blank dashboard / Missing classes** | Not enrolled or using wrong account | Confirm you’re logged into the correct school account; contact your instructor or administrator if the class isn’t listed. |
| **Report export is empty** | Wrong class or date range selected | Check filters, re-select correct class, and try exporting again. |
| **Database write failed** | Server timeout or Firestore quota | Retry after a few seconds; if persistent, notify the administrator. |  

&nbsp;
### <span style="color:#00853E;">Fixing Camera Permissions</span>

#### Browser Settings
- **Chrome / Edge:** Click the tune icon in the address bar → Camera → Allow Access
- **Firefox:** Go to Settings → Privacy & Security → Permissions → Camera → allow Access   
- **Safari (macOS):** Safari → Settings → Websites → Camera** → set FRAS to Allow

#### Operating System Settings
- **Windows 10/11:**  
  - Settings → Privacy → Camera → Allow apps to access your camera → make sure your browser is toggled ON  
- **macOS:**  
  - System Settings → Privacy & Security → Camera → enable your browser  
&nbsp;
### <span style="color:#00853E;">Network and Performance Issues</span>

| **Issue** | **Possible Cause** | **Recommended Solution** |
|--------------|--------------------|---------------|
| **Slow load times or lag** | Weak network / VPN interference | Connect to a stable Wi-Fi network, disable VPN, refresh the page. |
| **Frequent disconnects** | Browser timeout / unstable internet | Move closer to your router or access point, or switch to a wired Ethernet connection. |
| **Web app not loading** | Browser cache or outdated version | Clear browser cache, close all FRAS tabs, reopen in incognito mode. |  

&nbsp;
### <span style="color:#00853E;">Attendance Syncing</span>

| **Issue** | **Possible Cause** | **Recommended Solution** |
|--------------|-----------|---------|
| **Students not visible in class roster** | Roster not synced yet | Instructor: refresh the dashboard; Admin: reimport class roster. |
| **Attendance missing after class** | Database sync delay | Wait up to 2 minutes, then refresh. Instructors can manually update attendance records. |  

&nbsp;
### <span style="color:#00853E;">Recognition Quality Tips</span>

- Ensure even, preferably front-facing, lighting (avoid sitting in shadows or with bright windows behind you).  
- Keep camera height at eye level and face centered in the frame.  
- Avoid wearing hats, sunglasses, masks, or any type of face covering during attendance check-in.  
- Clean your webcam lens regularly for better image quality.  
- For more consistent results, use the same device throughout the semester.  
&nbsp;
### <span style="color:#00853E;">Instructor-Specific Issues</span>

| **Issue** | **Possible Cause** | **Recommended Solution** |
|--------------|--------------------|---------------|
| **Students not appearing on class view dashboard** | Wrong course selected | Re-select course. |
| **Manual override not saving** | Network or permission issue | Ensure connection is stable and you have instructor privileges. Otherwise, contact administrator or support. |
| **Exported report empty** | Filter or date mismatch | Adjust filters and re-export; verify attendance was recorded. |  

&nbsp;
### <span style="color:#00853E;">Student-Specific Issues</span>

| **Issue** | **Possible Cause** | **Recommended Solution** |
|--------------|--------------------|---------------|
| **Recognition failed** | Poor lighting or camera angle | Re-scan in better lighting or adjust position. |
| **Wrong name displayed** | Database mismatch | Notify instructor or admin to verify your user profile. |
| **Forgot password** | UNT login issue | Reset password via UNT account portal, then re-sign into FRAS. |  

&nbsp;
### <span style="color:#00853E;">Administrator Diagnostics</span>

**If multiple users report ongoing issues:**

1. **Check site status:** Confirm FRAS site loads correctly on another device or browser.  
2. **Verify database:** Open Firebase → Firestore Rules & Usage → look for recent write errors.  
3. **Authentication:** Confirm affected users exist in Firebase Authentication and have correct roles.  
4. **Test Firestore connectivity:** Try reading/writing a small test document.
5. **Review server logs:** Look for network or CORS errors blocking connections.  
6. **Check hosting uptime:** Verify Render/Firebase Hosting status pages for outages.  

If critical services fail, contact **FRAS Support** (see Contact Information section).  
&nbsp;
### <span style="color:#00853E;">Preventive Tips</span>

- Test your webcam and login before class starts.  
- Keep browsers updated to the latest version.  
- Restart your computer weekly to clear cached processes.   
- Avoid browser extensions that block camera/mic access.  
- Maintain consistent classroom lighting conditions for best accuracy.

&nbsp;
## <span style="color:#00853E;"> FAQ</span>

**Q: I forgot my password. Can I change it?**   
**A:** If you happen to forget your password, please reset your password through UNT's account management system. Once you reset your password, you can log back into the FRAS system using your new credentials.

**Q: Can I use my phone’s camera?**   
**A:** Yes, if your mobile browser supports it — though we recommend using desktop webcams are more reliable. At this point in time, our user interface is built for desktop and may not be easily viewable on mobile devices.

**Q: My camera is not working when I try to record attendance. What should I do?**   
**A:** Please make sure that you have allowed your browser to access your camera. You can allow this permission in your browser's privacy settings. If that doesn't fix the issue, please try refreshing the page. If you are using an external webcam, please check that it is connected correctly. 

**Q: What happens if multiple students appear at once?**   
**A:** The system will reject the scan and the student will need to fill the camera.  

**Q: What do I do if FRAS doesn't recognize my face?**   
**A:** If your facial scan fails, please ensure that you are attempting your scan in a well-lit enviroment. Please avoid wearing hats in the process, or anything face coverings. If the issues continues, inform your instructor and they can manually mark your attendance as present. If the issue persist, please contact support at UNT.FRAS@gmail.com.

**Q: How is my data stored?**  
**A:** All attendance data is encrypted and securely stored in Firebase Firestore.

**Q: Is my camera feed stored?**   
**A:** No. FRAS handles facial data in real time, but does not store any video footage or camera images. Once a scan is processed, all data collected from that scan is deleted.

**Q: Who can I contact if I see an issue in my attendance records?**   
**A:** Please contact your instructor if you see an error in your attendance records. They can view your attendance records and correct any issues directly. If the issue is a system error, please contact support at UNT.FRAS@gmail.com. 

**Q: Can I upload a new image?**   
**A:** You cannot upload an image yourself. If you like to upload a new image, please contact support at UNT.FRAS@gmail.com.

**Q: How do I report a bug or technical issue?**   
**A:** Please attempt to capture or screenshot the problem you are experiencing and email it to UNT.FRAS@gmail.com, along with a description of the problem. Also include any important information related to the problem such as your role, the browser you are using, and the hardware you are using. 
&nbsp;
## <span style="color:#00853E;"> Contact Information</span>
For help or technical support, contact:  

**Group 3 – FRAS Support  @** UNT.FRAS@gmail.com 
