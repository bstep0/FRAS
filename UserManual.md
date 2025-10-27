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

**Group 3 – FRAS Support**  @

UNT.FRAS@gmail.com 
