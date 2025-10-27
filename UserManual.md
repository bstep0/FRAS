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
## <span style="color:#00853E;">4. Getting Started</span>

### For Students
- Log in with your assigned student credentials.   
- After successfully logging in you'll be directed to the Student Dashboard.  

### For Instructors
- Log in with your assigned instructor credentials.   
- After successfully logging in you'll be directed to the Instructor Dashboard.   

### For Administrators
- Log in with your assigned administrator credentials.   
- After successfully logging in you'll be directed to the Administrator Dashboard.   

![Login Page](https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/LoginPage.png "Login Page")

![Student Dashboard](https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/StudentDashboard.png "Student Dashboard")

![Instructor Dashboard](https://github.com/bstep0/FRAS/blob/main/Images%20for%20User%20Manual/InstructorDashboard.png "Instructor Dashboard")
&nbsp;
## <span style="color:#00853E;">5. Features and Functions</span>

| **Feature** | **Description** | **Accessible By** |
|--------------|-----------------|------------------|
| Facial Recognition Attendance | Automatically detects and records attendance via webcam. | Student, Instructor |
| Manual Override | Allows instructors to manually update attendance if needed. | Instructor |
| Role-Based Access | Secure role permissions for Admin, Instructor, and Student. | All |
| Attendance Reports | Detailed logs and analytics per class. | Instructor, Admin |
| Performance Analytics | Displays attendance trends and metrics. | Admin |
| User Authentication | Secure Firebase Authentication login. | All |

📸 *Placeholder: Insert screenshots of dashboards and reports here.*


&nbsp;
## <span style="color:#00853E;">6. Troubleshooting</span>

| **Issue** | **Possible Cause** | **Solution** |
|------------|--------------------|---------------|
| Camera not detected | Browser permissions disabled | Enable camera permissions in browser settings |
| Face not recognized | Poor lighting or camera angle | Adjust lighting or face camera directly |
| Slow load times | Weak internet connection | Refresh page or change network |
| Attendance missing | Recognition timeout | Instructor can manually mark student present |
| Login error | Incorrect credentials | Reset password or contact admin |

📸 *Placeholder: Insert screenshot of troubleshooting page here.*


&nbsp;
## <span style="color:#00853E;">7. FAQ (Optional Extra Credit)</span>

**Q:** Can I use my phone’s camera?  
**A:** Yes, if your mobile browser supports it — though desktop webcams are more reliable.  

**Q:** What happens if multiple students appear at once?  
**A:** The system flags it for instructor review to ensure accuracy.  

**Q:** How is my data stored?  
**A:** All attendance data is encrypted and securely stored in Firebase Firestore.



## <span style="color:#00853E;">8. Contact Information</span>
For help or technical support, contact:  

**Team 3 – FRAS Support**  
📧 fras.group3@unt.edu  
📍 University of North Texas – Department of Computer Science  
🕓 Monday–Friday, 9 AM – 5 PM CST  



*End of Document*  
