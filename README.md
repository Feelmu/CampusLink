🎓 CampusLink
Course: Software Engineering II
Institution: University of Europe for Applied Sciences (UE)
Project Type: Group Course Project
👥 Team Members
Jeonghu Heo (30053140)
Segun Abraham Oladimeji (70003844)
Sujal Choudhary (71640579)
Shat Chakra Pawar Amgothu (71075197)
🚀 Overview
CampusLink is a web-based academic communication platform designed for students and professors at the University of Europe for Applied Sciences.
The system enables structured, role-based communication by combining:
Major-specific realtime student group chats
University-wide announcements managed by professors
Access is restricted to users with a valid @ue-germany.de email address, ensuring institutional integrity and academic relevance.
🎯 Project Objectives
The primary objectives of CampusLink are:
Enable reliable realtime communication among students within the same academic major
Provide professors with a centralized announcement channel
Enforce clear role separation between students and professors
Demonstrate practical application of Software Engineering II concepts, including:
Requirement-driven development
Role-based access control
Realtime systems
Clean architecture and maintainability
✨ Key Features
🔐 Authentication & Access Control
Email/password authentication using Firebase Authentication
Strict domain validation for @ue-germany.de emails
Persistent user profiles stored in Cloud Firestore
🎓 Student Features
Mandatory major selection during signup
Automatic connection to a single major-specific chatroom
Realtime messaging using Firestore snapshot listeners
Edit and delete own messages (WhatsApp-like interaction)
🧑‍🏫 Professor Features
Dedicated announcement management interface
Create, edit, and delete announcements
Announcements broadcast to all users in realtime
🌐 General Features
Role-based UI rendering
Realtime data synchronization without page refresh
Optimistic UI updates for improved user experience
Multilingual interface (English and German)
🧱 System Architecture
CampusLink follows a client-centric architecture:
🖥️ Frontend
React single-page application
Class-based components
UI logic separated from business logic
☁️ Backend Services
Firebase Authentication for identity management
Cloud Firestore for realtime database operations
⚡ Realtime Communication
Firestore onSnapshot listeners
Automatic UI updates on data changes
No custom backend server is used. All backend responsibilities are handled by Firebase managed services.
🗄️ Data Model (Cloud Firestore)
👤 Users
users/{uid}
Fields:
email
name
role (student | professor)
major (nullable)
createdAt
📢 Announcements
announcements/{announcementId}
Fields:
title
content
author
professorUid
createdAt
💬 Messages
messages/{major}/items/{messageId}
Fields:
senderUid
senderName
content
major
createdAt
🔐 Security Considerations
Passwords are never stored in Cloud Firestore
Authentication is fully handled by Firebase Authentication
Role-based access control ensures:
Students can only access their own major chat
Professors cannot access student chatrooms
Message edits and deletions are restricted to the original sender
Announcement management is restricted to professors
All communication occurs over HTTPS
🛠️ Technologies Used
Frontend: React (JavaScript, JSX)
Backend Services: Firebase Authentication, Cloud Firestore
Styling: Tailwind CSS
Realtime Data: Firestore snapshot listeners
⚙️ Setup and Installation
Clone the repository
git clone <repository-url>
cd CampusLink
Install dependencies
npm install
Configure environment variables
Create a .env file with Firebase configuration credentials.
⚠️ Do not commit .env to the repository.
Run the application
npm run dev
🚫 Out of Scope Features
The following features are intentionally not implemented:
One-to-one private messaging
Voice or video communication
File uploads or media sharing
Learning Management System (LMS) integration
🎓 Course Context
This project was developed as part of the Software Engineering II course.
All features were derived from a formal Software Requirements Specification (SRS) and implemented accordingly.
The project emphasizes:
Alignment between requirements and implementation
Maintainable architecture
Clear separation of responsibilities
📄 License
This project is developed strictly for academic purposes.