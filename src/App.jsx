import React, { Component } from "react";

import {
  MessageSquare,
  Bell,
  LogOut,
  Send,
  Plus,
  Trash2,
  Globe,
  User as UserIcon,
  Lock,
  Mail,
  Edit2,
  CheckCircle,
  X,
  Check,
  Pencil,
} from "lucide-react";

// [1] Localization: Import JSON files (Ensure these exist in src/locales/)

import en from "./locales/en.json";

import de from "./locales/de.json";

// [2] Firebase SDK Imports

import { auth, db } from "./firebase";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const TRANSLATIONS = { en, de };

/** 

* ================================================================================== 

* [3] CONFIGURATION 

* ================================================================================== 

*/

const MAJORS = [
  "Data Science MSc",

  "Digital Business & Data Science BSc",

  "Digital Media & Marketing BSc",

  "Digital Media & Marketing BSc (dual)",

  "Digital Technology MBA",

  "Digital Transformations MSc",

  "Generative Design & AI MA",

  "Innovation Design Management MA",

  "Software Engineering BSc",

  "Software Engineering MSc",

  "UI/UX Design BA",

  "Visual & Experience Design MA",
];

/** 

* ================================================================================== 

* [4] OOP DOMAIN MODELS (Strict adherence to Class Diagram) 

* Encapsulates business logic and Firebase interactions within classes. 

* ================================================================================== 

*/

// Base Class: User

class User {
  constructor(uid, email, name, role) {
    this.uid = uid;

    this.email = email;

    this.name = name;

    this.role = role;
  }

  // --- Static Factory Methods (Authentication) ---

  /** 

* Logs in the user and returns the specific subclass instance (Student or Professor). 

* @param {string} email  

* @param {string} password  

* @returns {Promise<User>} Student or Professor instance 

*/

  static async login(email, password) {
    // 1. Firebase Auth Login

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;

    // 2. Fetch User Profile from Firestore

    const docRef = doc(db, "users", uid);

    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("User profile not found.");
    }

    const data = docSnap.data();

    // 3. Return specific instance based on role (Factory Pattern)

    if (data.role === "student") {
      return new Student(uid, data.email, data.name, data.major);
    } else {
      return new Professor(uid, data.email, data.name);
    }
  }

  /** 

* Registers a new user and saves profile to Firestore. 

* @param {string} email  

* @param {string} password  

* @param {string} name  

* @param {string} role  

* @param {string} major  

* @returns {Promise<User>} Student or Professor instance 

*/

  static async signup(email, password, name, role, major) {
    // 1. Firebase Auth Create

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;

    // 2. Prepare Profile Data

    const profileData = {
      email,

      name,

      role,

      major: role === "student" ? major : null,

      createdAt: serverTimestamp(),
    };

    // 3. Save to Firestore

    await setDoc(doc(db, "users", uid), profileData);

    // 4. Return Instance

    if (role === "student") {
      return new Student(uid, email, name, major);
    } else {
      return new Professor(uid, email, name);
    }
  }

  /** 

* Logs out the current user. 

*/

  async logout() {
    await signOut(auth);
  }
}

// Subclass: Student

class Student extends User {
  constructor(uid, email, name, major) {
    super(uid, email, name, "student");

    this.major = major;
  }

  /** 

* Sends a message to the major-specific chatroom. 

* @param {string} content  

*/

  async sendMessage(content) {
    if (!content.trim()) return;

    await addDoc(collection(db, "messages", this.major, "items"), {
      senderUid: this.uid,

      senderName: this.name,

      content: content.trim(),

      major: this.major,

      createdAt: serverTimestamp(),
    });
  }
}

// Subclass: Professor

class Professor extends User {
  constructor(uid, email, name) {
    super(uid, email, name, "professor");
  }

  /** 

* Posts a new announcement. 

* @param {string} title  

* @param {string} content  

*/

  async postAnnouncement(title, content) {
    if (!title.trim()) return;

    await addDoc(collection(db, "announcements"), {
      title: title.trim(),

      content: content.trim(),

      author: this.name,

      professorUid: this.uid,

      createdAt: serverTimestamp(),
    });
  }

  /** 

* Edits an existing announcement. 

* @param {string} id  

* @param {string} title  

* @param {string} content  

*/

  async editAnnouncement(id, title, content) {
    await updateDoc(doc(db, "announcements", id), {
      title: title.trim(),

      content: content.trim(),
    });
  }

  /** 

* Deletes an announcement. 

* @param {string} id  

*/

  async deleteAnnouncement(id) {
    await deleteDoc(doc(db, "announcements", id));
  }
}

/** 

* ================================================================================== 

* [5] REACT CONTROLLER (App Component) 

* Handles UI rendering and delegates business logic to Domain Objects. 

* ================================================================================== 

*/

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      lang: "en",

      authMode: "login",

      currentUser: null, // Holds an instance of Student or Professor

      // UI State

      loading: true,

      error: "",

      success: "",

      activeTab: "chat",

      // Data State

      chats: [],

      announcements: [],

      // Inputs

      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: "student",
      major: MAJORS[0],

      msgInput: "",
      noticeTitle: "",
      noticeContent: "",

      // Edit Mode State

      editingId: null,
    };

    // Unsubscribers for realtime listeners

    this.unsubAuth = null;

    this.unsubChats = null;

    this.unsubAnnouncements = null;
  }

  // Helper to get translation

  t = (key) => TRANSLATIONS[this.state.lang]?.[key] || key;

  // --- Lifecycle: Auth Observer & Persistence ---

  componentDidMount() {
    this.unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // Re-instantiate User Object on page reload

          const docRef = doc(db, "users", fbUser.uid);

          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            let userInstance;

            if (data.role === "student") {
              userInstance = new Student(
                fbUser.uid,
                data.email,
                data.name,
                data.major
              );

              this.subscribeToChats(data.major);
            } else {
              userInstance = new Professor(fbUser.uid, data.email, data.name);
            }

            this.subscribeToAnnouncements();

            this.setState({
              currentUser: userInstance,

              activeTab: data.role === "professor" ? "notice" : "chat",

              loading: false,
            });
          }
        } catch (e) {
          console.error(e);

          this.setState({ loading: false });
        }
      } else {
        this.setState({ currentUser: null, loading: false });

        this.cleanupListeners();
      }
    });
  }

  componentWillUnmount() {
    if (this.unsubAuth) this.unsubAuth();

    this.cleanupListeners();
  }

  cleanupListeners() {
    if (this.unsubChats) this.unsubChats();

    if (this.unsubAnnouncements) this.unsubAnnouncements();
  }

  // --- Realtime Listeners (Controller Logic) ---

  subscribeToChats(major) {
    if (this.unsubChats) this.unsubChats();

    const q = query(
      collection(db, "messages", major, "items"),
      orderBy("createdAt", "asc")
    );

    this.unsubChats = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map((d) => ({
        id: d.id,

        ...d.data(),

        timestamp:
          d
            .data()
            .createdAt?.toDate()
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ||
          "...",
      }));

      this.setState({ chats });
    });
  }

  subscribeToAnnouncements() {
    if (this.unsubAnnouncements) this.unsubAnnouncements();

    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    this.unsubAnnouncements = onSnapshot(q, (snapshot) => {
      const announcements = snapshot.docs.map((d) => ({
        id: d.id,

        ...d.data(),

        date:
          d.data().createdAt?.toDate().toISOString().split("T")[0] || "Today",
      }));

      this.setState({ announcements });
    });
  }

  // --- Handlers: Authentication ---

  handleLogin = async (e) => {
    e.preventDefault();

    const { email, password } = this.state;

    this.setState({ error: "", success: "", loading: true });

    try {
      // OOP: Call Static Method on User Class

      const userInstance = await User.login(email, password);

      this.setState({
        currentUser: userInstance,

        activeTab: userInstance instanceof Professor ? "notice" : "chat",

        loading: false,
      });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  };

  handleSignup = async (e) => {
    e.preventDefault();

    const { email, password, confirmPassword, name, role, major } = this.state;

    // Validation

    if (password !== confirmPassword) {
      this.setState({ error: "Passwords do not match" });

      return;
    }

    if (!email.endsWith("@ue-germany.de")) {
      this.setState({ error: this.t("errorEmail") });

      return;
    }

    try {
      this.setState({ loading: true });

      // OOP: Call Static Method on User Class

      const userInstance = await User.signup(
        email,
        password,
        name,
        role,
        major
      );

      this.setState({
        currentUser: userInstance,

        activeTab: role === "professor" ? "notice" : "chat",

        loading: false,
      });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  };

  handleLogout = async () => {
    const { currentUser } = this.state;

    if (currentUser) await currentUser.logout(); // Call Instance Method

    this.setState({ currentUser: null });
  };

  // --- Handlers: Language Switcher (Dropdown) ---

  handleLanguageChange = (e) => {
    this.setState({ lang: e.target.value });
  };

  // --- Handlers: Student Features ---

  handleSendMessage = async (e) => {
    e.preventDefault();

    const { currentUser, msgInput } = this.state;

    if (currentUser instanceof Student) {
      // OOP: Delegate to Student Instance

      await currentUser.sendMessage(msgInput);

      this.setState({ msgInput: "" });
    }
  };

  // --- Handlers: Professor Features ---

  handleSaveAnnouncement = async (e) => {
    e.preventDefault();

    const { currentUser, noticeTitle, noticeContent, editingId } = this.state;

    if (currentUser instanceof Professor) {
      if (editingId) {
        // OOP: Edit Method

        await currentUser.editAnnouncement(
          editingId,
          noticeTitle,
          noticeContent
        );
      } else {
        // OOP: Post Method

        await currentUser.postAnnouncement(noticeTitle, noticeContent);
      }

      this.setState({ noticeTitle: "", noticeContent: "", editingId: null });
    }
  };

  handleDeleteNotice = async (id) => {
    const { currentUser } = this.state;

    if (currentUser instanceof Professor) {
      // OOP: Delete Method

      await currentUser.deleteAnnouncement(id);
    }
  };

  // UI Helpers

  handleEditClick = (n) =>
    this.setState({
      noticeTitle: n.title,
      noticeContent: n.content,
      editingId: n.id,
    });

  handleCancelEdit = () =>
    this.setState({ noticeTitle: "", noticeContent: "", editingId: null });

  // --- Render ---

  render() {
    const {
      currentUser,
      lang,
      authMode,
      email,
      password,
      confirmPassword,
      name,
      role,
      major,
      error,

      activeTab,
      chats,
      announcements,
      msgInput,
      noticeTitle,
      noticeContent,
      editingId,
      loading,
    } = this.state;

    // Loading Screen

    if (loading && !currentUser && !error)
      return (
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      );

    // Auth Screen

    if (!currentUser) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
          <div className="absolute top-5 right-5">
            {/* Language Dropdown (Expandable) */}

            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium border">
              <Globe size={16} className="text-gray-600" />

              <select
                value={lang}
                onChange={this.handleLanguageChange}
                className="bg-transparent border-none outline-none text-gray-700 font-bold cursor-pointer"
              >
                <option value="en">English</option>

                <option value="de">Deutsch</option>

                {/* To add Korean: <option value="ko">한국어</option> */}
              </select>
            </div>
          </div>

          <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-blue-700 mb-2">
                {this.t("appTitle")}
              </h1>

              <p className="text-gray-500 font-medium">
                {authMode === "login"
                  ? this.t("loginHeader")
                  : this.t("signupHeader")}
              </p>
            </div>

            <form
              onSubmit={
                authMode === "login" ? this.handleLogin : this.handleSignup
              }
              className="space-y-4"
            >
              <div className="relative">
                <Mail
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />

                <input
                  type="email"
                  placeholder="id@ue-germany.de"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => this.setState({ email: e.target.value })}
                />
              </div>

              <div className="relative">
                <Lock
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />

                <input
                  type="password"
                  placeholder={this.t("passwordLabel")}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => this.setState({ password: e.target.value })}
                />
              </div>

              {authMode === "signup" && (
                <>
                  <div className="relative">
                    <CheckCircle
                      className="absolute left-3 top-3 text-gray-400"
                      size={18}
                    />

                    <input
                      type="password"
                      placeholder={this.t("confirmPasswordLabel")}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      value={confirmPassword}
                      onChange={(e) =>
                        this.setState({ confirmPassword: e.target.value })
                      }
                    />
                  </div>

                  <div className="relative">
                    <UserIcon
                      className="absolute left-3 top-3 text-gray-400"
                      size={18}
                    />

                    <input
                      type="text"
                      placeholder={this.t("nameLabel")}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      value={name}
                      onChange={(e) => this.setState({ name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {this.t("roleLabel")}
                    </label>

                    <select
                      className="w-full px-4 py-2 border rounded-lg bg-white outline-none"
                      value={role}
                      onChange={(e) => this.setState({ role: e.target.value })}
                    >
                      <option value="student">{this.t("student")}</option>

                      <option value="professor">{this.t("professor")}</option>
                    </select>
                  </div>

                  {role === "student" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {this.t("majorLabel")}
                      </label>

                      <select
                        className="w-full px-4 py-2 border rounded-lg bg-white text-sm outline-none"
                        value={major}
                        onChange={(e) =>
                          this.setState({ major: e.target.value })
                        }
                      >
                        {MAJORS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md"
              >
                {authMode === "login"
                  ? this.t("loginBtn")
                  : this.t("signupBtn")}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() =>
                  this.setState({
                    authMode: authMode === "login" ? "signup" : "login",
                    error: "",
                    password: "",
                    confirmPassword: "",
                  })
                }
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                {authMode === "login"
                  ? this.t("switchSignup")
                  : this.t("switchLogin")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. Main Dashboard

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
        <aside className="w-full md:w-72 bg-white shadow-lg z-10 flex flex-col">
          <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
            <h1 className="text-xl font-bold">{this.t("appTitle")}</h1>

            {/* Sidebar Language Dropdown */}

            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
              <Globe size={16} />

              <select
                value={lang}
                onChange={this.handleLanguageChange}
                className="bg-transparent text-white outline-none font-bold cursor-pointer option:text-black"
              >
                <option value="en" className="text-black">
                  EN
                </option>

                <option value="de" className="text-black">
                  DE
                </option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
                {currentUser.name.charAt(0)}
              </div>

              <div>
                <p className="font-bold text-gray-800 truncate">
                  {currentUser.name}
                </p>

                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-600 text-white rounded-full uppercase">
                  {currentUser.role === "student"
                    ? this.t("student")
                    : this.t("professor")}
                </span>
              </div>
            </div>

            {currentUser instanceof Student && (
              <div className="mt-4 text-sm text-gray-600 bg-white p-3 rounded-lg border border-blue-100">
                <p className="font-semibold text-gray-500 text-xs uppercase mb-1">
                  {this.t("myMajor")}
                </p>

                <p className="leading-tight text-blue-900 font-medium">
                  {currentUser.major}
                </p>
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {currentUser instanceof Student && (
              <button
                onClick={() => this.setState({ activeTab: "chat" })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === "chat"
                    ? "bg-blue-100 text-blue-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare size={20} /> {this.t("chatTab")}
              </button>
            )}

            <button
              onClick={() => this.setState({ activeTab: "notice" })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === "notice"
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Bell size={20} /> {this.t("noticeTab")}
            </button>
          </nav>

          <div className="p-4 border-t mt-auto">
            <button
              onClick={this.handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg"
            >
              <LogOut size={20} /> {this.t("logout")}
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden">
          {activeTab === "chat" && currentUser instanceof Student && (
            <div className="flex flex-col h-full bg-gray-50">
              <header className="bg-white p-4 shadow-sm border-b flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {currentUser.major}
                  </h2>

                  <p className="text-xs text-gray-500">Official Group Chat</p>
                </div>

                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  ● {this.t("online")}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex flex-col ${
                      chat.senderUid === currentUser.uid
                        ? "items-end"
                        : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                        chat.senderUid === currentUser.uid
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white border rounded-bl-sm"
                      }`}
                    >
                      {chat.senderUid !== currentUser.uid && (
                        <span className="block text-xs font-bold text-gray-400 mb-1">
                          {chat.senderName}
                        </span>
                      )}

                      {chat.content}
                    </div>

                    <span className="text-[10px] text-gray-400 mt-1">
                      {chat.timestamp}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white border-t">
                <form
                  onSubmit={this.handleSendMessage}
                  className="flex gap-2 relative"
                >
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) =>
                      this.setState({ msgInput: e.target.value })
                    }
                    placeholder={this.t("chatPlaceholder")}
                    className="flex-1 pl-4 pr-12 py-3 border rounded-full focus:outline-none focus:border-blue-500 shadow-inner"
                  />

                  <button
                    type="submit"
                    className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === "notice" && (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-4">
                  {this.t("noticeTitle")}
                </h2>

                {currentUser instanceof Professor && (
                  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8 transition-all">
                    <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                      {editingId ? <Edit2 size={20} /> : <Plus size={20} />}{" "}
                      {editingId ? "Edit" : this.t("noticeCreate")}
                    </h3>

                    <form
                      onSubmit={this.handleSaveAnnouncement}
                      className="space-y-4"
                    >
                      <input
                        type="text"
                        placeholder={this.t("titlePlaceholder")}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={noticeTitle}
                        onChange={(e) =>
                          this.setState({ noticeTitle: e.target.value })
                        }
                      />

                      <textarea
                        placeholder={this.t("contentPlaceholder")}
                        className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={noticeContent}
                        onChange={(e) =>
                          this.setState({ noticeContent: e.target.value })
                        }
                      />

                      <div className="flex justify-end gap-2">
                        {editingId && (
                          <button
                            type="button"
                            onClick={this.handleCancelEdit}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                          >
                            {this.t("cancel")}
                          </button>
                        )}

                        <button
                          type="submit"
                          className={`px-6 py-2 text-white rounded-lg font-bold shadow-sm ${
                            editingId
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {editingId ? this.t("updateBtn") : this.t("postBtn")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="space-y-4">
                  {announcements.map((notice) => (
                    <div
                      key={notice.id}
                      className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {notice.title}
                        </h3>

                        {currentUser instanceof Professor && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => this.handleEditClick(notice)}
                              className="text-gray-400 hover:text-blue-500 p-2 rounded-full hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>

                            <button
                              onClick={() => this.handleDeleteNotice(notice.id)}
                              className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">
                        {notice.content}
                      </p>

                      <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-4">
                        <span className="font-medium text-blue-600 flex items-center gap-1">
                          <UserIcon size={14} /> {notice.author}
                        </span>

                        <span>{notice.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }
}

export default App;
