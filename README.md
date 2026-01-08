# CampusLink 🎓

**Course:** Software Engineering II  
**Institution:** University of Europe for Applied Sciences (UE)  
**Project Type:** Group Course Project  

## Team Members
- Jeonghu Heo (30053140)  
- Segun Abraham Oladimeji (70003844)  
- Sujal Choudhary (71640579)  
- Shat Chakra Pawar Amgothu (71075197)  

---

## Overview

CampusLink is a web-based academic communication platform designed for students and professors at the University of Europe for Applied Sciences.

The system supports structured, role-based communication through:
- Major-specific student group chats
- University-wide announcements managed by professors

Access is restricted to users with a valid `@ue-germany.de` email address.

---

## Project Objectives

The objectives of CampusLink are to:
- Enable realtime communication among students within the same academic major
- Provide professors with a centralized announcement system
- Enforce clear role-based access control
- Apply core concepts from the Software Engineering II course

---

## Key Features

### Authentication and Access Control
- Firebase email/password authentication
- Domain restriction to `@ue-germany.de`
- Persistent user profiles stored in Cloud Firestore

### Student Features
- Mandatory major selection during signup
- Automatic assignment to a single major-specific chatroom
- Realtime messaging with edit and delete functionality

### Professor Features
- Create, edit, and delete announcements
- Announcements broadcast to all users in realtime

### General Features
- Role-based user interface rendering
- Realtime data synchronization
- Optimistic UI updates
- Multilingual interface (English and German)

---

## System Architecture

CampusLink follows a client-centric architecture.

**Frontend**
- React single-page application
- Class-based components
- Separation of UI and business logic

**Backend Services**
- Firebase Authentication
- Cloud Firestore (realtime listeners)

No custom backend server is used.

---

## Data Model

**Users**
users/{uid}
Fields: email, name, role, major, createdAt

**Announcements**
announcements/{announcementId}
Fields: title, content, author, professorUid, createdAt

**Messages**
messages/{major}/items/{messageId}
Fields: senderUid, senderName, content, major, createdAt

---

## Security Considerations

- Passwords are not stored in Firestore
- Authentication handled by Firebase Authentication
- Role-based access enforcement
- HTTPS communication only

---

## Technologies Used

- React
- Firebase Authentication
- Cloud Firestore
- Tailwind CSS

---

## Setup and Installation

```bash
git clone <repository-url>
cd CampusLink
npm install
npm run dev
Create a .env file with Firebase credentials.
Do not commit the .env file.
Out of Scope
Private messaging
Voice or video communication
File uploads
LMS integration
Course Context
This project was developed for the Software Engineering II course and follows a formal Software Requirements Specification (SRS).
License
Academic use only.

---

## Final verdict

✔ Clean  
✔ Professional  
✔ Looks good in VS Code  
✔ Safe for grading  
✔ Still modern  

👉 **Use this version.**  
If you want, I can do a **final GitHub preview check** or help you write the **commit m