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
  Pencil,
  X,
  Check,
} from "lucide-react";

import en from "./locales/en.json";
import de from "./locales/de.json";

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
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

/**
 * ==================================================================================
 * [1] LOCALIZATION
 * ==================================================================================
 */
const TRANSLATIONS = { en, de };

/**
 * ==================================================================================
 * [2] CONFIGURATION / SEED DATA (UI fallback only)
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

const INITIAL_ANNOUNCEMENTS = [
  {
    id: 1,
    title: "Semester Break",
    content: "Campus closed from Dec 24.",
    author: "Prof. Weber",
    date: "2024-12-01",
  },
  {
    id: 2,
    title: "Project Deadline",
    content: "Submit SRS by Friday.",
    author: "Prof. Schmidt",
    date: "2024-12-05",
  },
];

const INITIAL_CHATS = [
  {
    id: 1,
    sender: "Hans",
    content: "Is the library open?",
    major: "Software Engineering BSc",
    timestamp: "09:00",
  },
  {
    id: 2,
    sender: "Julia",
    content: "Yes, until 8 PM.",
    major: "Software Engineering BSc",
    timestamp: "09:05",
  },
];

/**
 * ==================================================================================
 * [3] OOP DOMAIN MODELS (business rules, payload builders, validation)
 * ==================================================================================
 */

class UserDomain {
  static isUeEmail(email) {
    return typeof email === "string" && email.endsWith("@ue-germany.de");
  }

  static validateAuth({ authMode, email, password, confirmPassword }) {
    if (!this.isUeEmail(email)) return { ok: false, messageKey: "errorEmail", message: null };

    if (!password || password.length < 6) {
      return { ok: false, messageKey: null, message: "Password must be at least 6 characters." };
    }

    if (authMode === "signup" && password !== confirmPassword) {
      return { ok: false, messageKey: null, message: "Passwords do not match." };
    }

    return { ok: true };
  }

  static defaultDisplayName({ role, name }) {
    if (name && String(name).trim()) return String(name).trim();
    return role === "student" ? "UE Student" : "Prof. Member";
  }

  static toProfileDoc({ email, displayName, role, major }) {
    return {
      email,
      name: displayName,
      role,
      major: role === "student" ? major : null,
      createdAt: serverTimestamp(),
    };
  }
}

class StudentDomain {
  static canSend(currentUser) {
    return !!currentUser && currentUser.role === "student" && !!currentUser.major;
  }

  static buildOptimisticMessage({ currentUser, text }) {
    const tempId = `temp_${Date.now()}`;
    return {
      id: tempId,
      senderUid: currentUser.uid,
      sender: currentUser.name,
      content: text,
      major: currentUser.major,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      _optimistic: true,
    };
  }

  static toFirestoreMessage({ currentUser, text }) {
    return {
      senderUid: currentUser.uid,
      senderName: currentUser.name,
      content: text,
      major: currentUser.major,
      createdAt: serverTimestamp(),
    };
  }

  static isTempId(id) {
    return String(id).startsWith("temp_");
  }

  static isMine({ currentUser, msg }) {
    return !!currentUser && !!msg && msg.senderUid === currentUser.uid;
  }
}

class ProfessorDomain {
  static canPost(currentUser) {
    return !!currentUser && currentUser.role === "professor";
  }

  static toFirestoreAnnouncement({ currentUser, title, content }) {
    return {
      title,
      content,
      author: currentUser.name,
      professorUid: currentUser.uid,
      createdAt: serverTimestamp(),
    };
  }
}

/**
 * ==================================================================================
 * [4] REACT CONTROLLER (App)
 * UI = your Firebase version (unchanged layout)
 * Logic = delegated to domain models where it makes sense
 * ==================================================================================
 */
class App extends Component {
  // Long-press internals (no React state)
  pressTimer = null;
  pressStart = { x: 0, y: 0 };

  constructor(props) {
    super(props);

    this.state = {
      lang: "en",
      authMode: "login",
      currentUser: null,

      error: "",
      success: "",
      loading: false,

      // Data (realtime)
      chats: [],
      announcements: INITIAL_ANNOUNCEMENTS,

      // Listener loading flags
      chatsLoading: false,
      announcementsLoading: false,

      // Auth form
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: "student",
      major: MAJORS[0],

      // Chat input
      msgInput: "",

      // Announcement create inputs
      noticeTitle: "",
      noticeContent: "",

      // Tabs
      activeTab: "chat",

      // Announcement edit state
      editingNoticeId: null,
      editingNoticeTitle: "",
      editingNoticeContent: "",

      // Message edit state
      editingMsgId: null,
      editingMsgText: "",

      // Message menu state
      msgMenuOpen: false,
      msgMenuTarget: null,
      msgMenuPos: { x: 0, y: 0 },
    };

    // Firebase unsubscribe handles
    this.unsubAuth = null;
    this.unsubProfile = null;
    this.unsubChats = null;
    this.unsubAnnouncements = null;

    // Realtime control flags
    this.currentChatMajor = null;
    this.annListenerActive = false;
  }

  t = (key) => TRANSLATIONS[this.state.lang]?.[key] || key;

  toggleLanguage = () => {
    this.setState((prev) => ({ lang: prev.lang === "en" ? "de" : "en" }));
  };

  cleanupRealtime = () => {
    if (this.unsubChats) this.unsubChats();
    if (this.unsubAnnouncements) this.unsubAnnouncements();

    this.unsubChats = null;
    this.unsubAnnouncements = null;
    this.currentChatMajor = null;
    this.annListenerActive = false;

    this.setState({
      chatsLoading: false,
      announcementsLoading: false,
    });
  };

  componentDidMount() {
    // Auth state -> profile snapshot -> realtime listeners
    this.unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      this.cleanupRealtime();

      if (this.unsubProfile) this.unsubProfile();
      this.unsubProfile = null;

      if (!fbUser) {
        this.setState({
          currentUser: null,
          chats: [],
          announcements: INITIAL_ANNOUNCEMENTS,
          error: "",
          success: "",
          loading: false,
          chatsLoading: false,
          announcementsLoading: false,
          msgMenuOpen: false,
          msgMenuTarget: null,
        });
        return;
      }

      const userRef = doc(db, "users", fbUser.uid);

      this.unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) {
            signOut(auth).catch(() => {});
            this.setState({
              currentUser: null,
              chats: [],
              announcements: INITIAL_ANNOUNCEMENTS,
              error: "Account setup incomplete. Please sign up.",
              success: "",
              loading: false,
              chatsLoading: false,
              announcementsLoading: false,
              msgMenuOpen: false,
              msgMenuTarget: null,
            });
            return;
          }

          const userProfile = { uid: fbUser.uid, ...snap.data() };

          this.setState({
            currentUser: userProfile,
            activeTab: userProfile.role === "professor" ? "notice" : "chat",
            error: "",
            success: "",
            loading: false,
          });

          // Announcements realtime (start once per session)
          if (!this.annListenerActive) {
            this.annListenerActive = true;
            this.setState({ announcementsLoading: true });

            const annQ = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
            this.unsubAnnouncements = onSnapshot(
              annQ,
              (annSnap) => {
                const announcements = annSnap.docs.map((d) => {
                  const data = d.data();
                  const dt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
                  return {
                    id: d.id,
                    title: data.title || "",
                    content: data.content || "",
                    author: data.author || "",
                    date: dt ? dt.toISOString().split("T")[0] : "",
                  };
                });

                this.setState({
                  announcements,
                  announcementsLoading: false,
                });
              },
              () => {
                this.setState({
                  announcements: INITIAL_ANNOUNCEMENTS,
                  announcementsLoading: false,
                });
              }
            );
          }

          // Chat realtime (student-major scoped)
          if (userProfile.role === "student" && userProfile.major) {
            if (this.currentChatMajor !== userProfile.major) {
              if (this.unsubChats) this.unsubChats();
              this.currentChatMajor = userProfile.major;

              this.setState({
                chatsLoading: true,
                chats: [],
              });

              const chatQ = query(
                collection(db, "messages", userProfile.major, "items"),
                orderBy("createdAt", "asc")
              );

              this.unsubChats = onSnapshot(
                chatQ,
                (chatSnap) => {
                  const chats = chatSnap.docs.map((d) => {
                    const data = d.data();
                    const dt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
                    return {
                      id: d.id,
                      senderUid: data.senderUid || "",
                      sender: data.senderName || "",
                      content: data.content || "",
                      major: data.major || userProfile.major,
                      timestamp: dt
                        ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "",
                    };
                  });

                  this.setState({
                    chats,
                    chatsLoading: false,
                  });
                },
                () => {
                  const fallback = INITIAL_CHATS.filter((c) => c.major === userProfile.major);
                  this.setState({
                    chats: fallback,
                    chatsLoading: false,
                  });
                }
              );
            }
          } else {
            if (this.unsubChats) this.unsubChats();
            this.unsubChats = null;
            this.currentChatMajor = null;

            this.setState({
              chats: [],
              chatsLoading: false,
            });
          }
        },
        () => {
          signOut(auth).catch(() => {});
          this.setState({
            currentUser: null,
            chats: [],
            announcements: INITIAL_ANNOUNCEMENTS,
            error: "Could not load your account. Please try again.",
            success: "",
            loading: false,
            chatsLoading: false,
            announcementsLoading: false,
            msgMenuOpen: false,
            msgMenuTarget: null,
          });
        }
      );
    });
  }

  componentWillUnmount() {
    if (this.unsubAuth) this.unsubAuth();
    if (this.unsubProfile) this.unsubProfile();
    this.cleanupRealtime();

    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /**
   * ==================================================================================
   * AUTH (delegates validation rules to UserDomain)
   * ==================================================================================
   */
  handleAuth = async (e) => {
    e.preventDefault();

    const { authMode, email, password, confirmPassword, name, role, major } = this.state;

    const v = UserDomain.validateAuth({ authMode, email, password, confirmPassword });
    if (!v.ok) {
      const message = v.messageKey ? this.t(v.messageKey) : v.message;
      this.setState({ error: message || "Invalid input.", success: "" });
      return;
    }

    try {
      this.setState({ loading: true, error: "", success: "" });

      if (authMode === "signup") {
        const displayName = UserDomain.defaultDisplayName({ role, name });
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(
          doc(db, "users", cred.user.uid),
          UserDomain.toProfileDoc({ email, displayName, role, major })
        );

        this.setState({ success: "Account created successfully. Signing you in…" });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "This email is already registered. Please login."
          : err?.code === "auth/wrong-password"
          ? "Wrong password."
          : err?.code === "auth/user-not-found"
          ? "No account found. Please sign up."
          : err?.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : err?.message || "Authentication failed.";

      this.setState({ error: msg, success: "", loading: false });
    }
  };

  handleLogout = async () => {
    await signOut(auth);
    this.setState({
      currentUser: null,
      email: "",
      password: "",
      confirmPassword: "",
      error: "",
      success: "",
      loading: false,
      chats: [],
      announcements: INITIAL_ANNOUNCEMENTS,
      chatsLoading: false,
      announcementsLoading: false,
      editingNoticeId: null,
      editingMsgId: null,
      msgMenuOpen: false,
      msgMenuTarget: null,
    });
  };

  /**
   * ==================================================================================
   * MESSAGE MENU (long press / right click)
   * ==================================================================================
   */
  clampMenuPos = (pos) => {
    const MENU_W = 220;
    const MENU_H = 120;
    const pad = 8;

    const maxX = Math.max(pad, window.innerWidth - MENU_W - pad);
    const maxY = Math.max(pad, window.innerHeight - MENU_H - pad);

    return {
      x: Math.min(Math.max(pos.x, pad), maxX),
      y: Math.min(Math.max(pos.y, pad), maxY),
    };
  };

  openMsgMenu = (msg, pos) => {
    const safePos = pos ? this.clampMenuPos(pos) : { x: 0, y: 0 };
    this.setState({
      msgMenuOpen: true,
      msgMenuTarget: msg,
      msgMenuPos: safePos,
    });
  };

  closeMsgMenu = () => {
    this.setState({
      msgMenuOpen: false,
      msgMenuTarget: null,
    });
  };

  onMsgPointerDown = (e, msg) => {
    const { currentUser } = this.state;
    if (!StudentDomain.isMine({ currentUser, msg })) return;

    const p = e.touches?.[0] || e;
    this.pressStart = { x: p.clientX, y: p.clientY };

    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.openMsgMenu(msg, { x: p.clientX, y: p.clientY });
    }, 500);
  };

  onMsgPointerMove = (e) => {
    if (!this.pressTimer) return;

    const p = e.touches?.[0] || e;
    const dx = Math.abs(p.clientX - this.pressStart.x);
    const dy = Math.abs(p.clientY - this.pressStart.y);

    // If user starts scrolling/moving, cancel long-press
    if (dx > 10 || dy > 10) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  };

  onMsgPointerUpOrCancel = () => {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  };

  onMsgContextMenu = (e, msg) => {
    e.preventDefault();
    const { currentUser } = this.state;
    if (!StudentDomain.isMine({ currentUser, msg })) return;
    this.openMsgMenu(msg, { x: e.clientX, y: e.clientY });
  };

  /**
   * ==================================================================================
   * CHAT CRUD (delegates payload rules to StudentDomain)
   * ==================================================================================
   */
  handleSendMessage = async (e) => {
    e.preventDefault();

    const { currentUser, msgInput } = this.state;
    if (!StudentDomain.canSend(currentUser)) return;

    const text = msgInput.trim();
    if (!text) return;

    const optimistic = StudentDomain.buildOptimisticMessage({ currentUser, text });

    this.setState((prev) => ({
      chats: [...prev.chats, optimistic],
      msgInput: "",
    }));

    try {
      await addDoc(
        collection(db, "messages", currentUser.major, "items"),
        StudentDomain.toFirestoreMessage({ currentUser, text })
      );
    } catch (err) {
      this.setState((prev) => ({
        chats: prev.chats.filter((m) => m.id !== optimistic.id),
        error: err?.message || "Failed to send message.",
      }));
    }
  };

  startEditMessage = (msg) => {
    const { currentUser } = this.state;
    if (!StudentDomain.isMine({ currentUser, msg })) return;

    this.setState({
      editingMsgId: msg.id,
      editingMsgText: msg.content,
    });
  };

  cancelEditMessage = () => {
    this.setState({ editingMsgId: null, editingMsgText: "" });
  };

  saveEditMessage = async () => {
    const { currentUser, editingMsgId, editingMsgText } = this.state;
    if (!StudentDomain.canSend(currentUser)) return;

    const newText = editingMsgText.trim();
    if (!newText) return;

    if (StudentDomain.isTempId(editingMsgId)) {
      this.setState({ error: "Please wait for the message to sync before editing." });
      return;
    }

    try {
      const ref = doc(db, "messages", currentUser.major, "items", editingMsgId);
      await updateDoc(ref, { content: newText });

      this.setState({
        editingMsgId: null,
        editingMsgText: "",
      });
    } catch (err) {
      this.setState({ error: err?.message || "Failed to edit message." });
    }
  };

  deleteMessage = async (msg) => {
    const { currentUser } = this.state;
    if (!StudentDomain.canSend(currentUser)) return;
    if (!StudentDomain.isMine({ currentUser, msg })) return;

    // If message is still optimistic, remove locally only
    if (StudentDomain.isTempId(msg.id)) {
      this.setState((prev) => ({ chats: prev.chats.filter((m) => m.id !== msg.id) }));
      return;
    }

    try {
      await deleteDoc(doc(db, "messages", currentUser.major, "items", msg.id));
    } catch (err) {
      this.setState({ error: err?.message || "Failed to delete message." });
    }
  };

  /**
   * ==================================================================================
   * ANNOUNCEMENTS CRUD (delegates payload rules to ProfessorDomain)
   * ==================================================================================
   */
  handlePostAnnouncement = async (e) => {
    e.preventDefault();

    const { currentUser, noticeTitle, noticeContent } = this.state;
    if (!ProfessorDomain.canPost(currentUser)) return;

    const title = noticeTitle.trim();
    const content = noticeContent.trim();
    if (!title) return;

    try {
      await addDoc(
        collection(db, "announcements"),
        ProfessorDomain.toFirestoreAnnouncement({ currentUser, title, content })
      );

      this.setState({
        noticeTitle: "",
        noticeContent: "",
      });
    } catch (err) {
      this.setState({ error: err?.message || "Failed to post announcement." });
    }
  };

  handleDeleteNotice = async (id) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
    } catch (err) {
      this.setState({ error: err?.message || "Failed to delete announcement." });
    }
  };

  startEditNotice = (notice) => {
    this.setState({
      editingNoticeId: notice.id,
      editingNoticeTitle: notice.title,
      editingNoticeContent: notice.content,
    });
  };

  cancelEditNotice = () => {
    this.setState({
      editingNoticeId: null,
      editingNoticeTitle: "",
      editingNoticeContent: "",
    });
  };

  saveEditNotice = async () => {
    const { editingNoticeId, editingNoticeTitle, editingNoticeContent } = this.state;

    const title = editingNoticeTitle.trim();
    const content = editingNoticeContent.trim();
    if (!title) return;

    try {
      await updateDoc(doc(db, "announcements", editingNoticeId), { title, content });
      this.cancelEditNotice();
    } catch (err) {
      this.setState({ error: err?.message || "Failed to update announcement." });
    }
  };

  /**
   * ==================================================================================
   * RENDER (UI preserved)
   * ==================================================================================
   */
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
      success,
      loading,
      activeTab,
      chats,
      announcements,
      msgInput,
      noticeTitle,
      noticeContent,
      chatsLoading,
      announcementsLoading,
      editingNoticeId,
      editingNoticeTitle,
      editingNoticeContent,
      editingMsgId,
      editingMsgText,
      msgMenuOpen,
      msgMenuTarget,
      msgMenuPos,
    } = this.state;

    // 1) Auth Screen
    if (!currentUser) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
          <div className="absolute top-5 right-5">
            <button
              onClick={this.toggleLanguage}
              className="flex items-center gap-2 px-3 py-1 bg-gray-200 rounded-full text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              <Globe size={16} /> {lang.toUpperCase()}
            </button>
          </div>

          <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-blue-700 mb-2">{this.t("appTitle")}</h1>
              <p className="text-gray-500 font-medium">
                {authMode === "login" ? this.t("loginHeader") : this.t("signupHeader")}
              </p>
            </div>

            <form onSubmit={this.handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="email"
                  placeholder="id@ue-germany.de"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => this.setState({ email: e.target.value })}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="password"
                  placeholder={this.t("passwordLabel")}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => this.setState({ password: e.target.value })}
                />
              </div>

              {authMode === "signup" && (
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="password"
                    placeholder="Retype password"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={confirmPassword}
                    onChange={(e) => this.setState({ confirmPassword: e.target.value })}
                  />
                </div>
              )}

              {authMode === "signup" && (
                <>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
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
                        onChange={(e) => this.setState({ major: e.target.value })}
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

              {success && (
                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                  ✅ {success}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold shadow-md text-white ${
                  loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : authMode === "login" ? (
                  this.t("loginBtn")
                ) : (
                  this.t("signupBtn")
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() =>
                  this.setState({
                    authMode: authMode === "login" ? "signup" : "login",
                    error: "",
                    success: "",
                    confirmPassword: "",
                  })
                }
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                {authMode === "login" ? this.t("switchSignup") : this.t("switchLogin")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2) Main Dashboard
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
        <aside className="w-full md:w-72 bg-white shadow-lg z-10 flex flex-col">
          <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
            <h1 className="text-xl font-bold">{this.t("appTitle")}</h1>
            <button
              onClick={this.toggleLanguage}
              className="flex items-center gap-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors"
            >
              <Globe size={16} /> {lang.toUpperCase()}
            </button>
          </div>

          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-gray-800 truncate">{currentUser.name}</p>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-600 text-white rounded-full uppercase tracking-wider">
                  {currentUser.role === "student" ? this.t("student") : this.t("professor")}
                </span>
              </div>
            </div>

            {currentUser.role === "student" && (
              <div className="mt-4 text-sm text-gray-600 bg-white p-3 rounded-lg border border-blue-100">
                <p className="font-semibold text-gray-500 text-xs uppercase mb-1">{this.t("myMajor")}</p>
                <p className="leading-tight text-blue-900 font-medium">{currentUser.major}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {currentUser.role === "student" && (
              <button
                onClick={() => this.setState({ activeTab: "chat" })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === "chat" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare size={20} /> {this.t("chatTab")}
              </button>
            )}
            <button
              onClick={() => this.setState({ activeTab: "notice" })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === "notice" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"
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
          {/* ======================
              Chat Tab (Students)
             ====================== */}
          {activeTab === "chat" && currentUser.role === "student" && (
            <div className="flex flex-col h-full bg-gray-50">
              <header className="bg-white p-4 shadow-sm border-b flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{currentUser.major}</h2>
                  <p className="text-xs text-gray-500">Official Group Chat</p>
                </div>
                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  ● {this.t("online")}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">⚠️ {error}</div>
                )}

                {chatsLoading && (
                  <div className="text-sm text-gray-500 bg-white border rounded-lg p-4">Loading messages…</div>
                )}

                {!chatsLoading && chats.length === 0 && (
                  <div className="text-sm text-gray-500 bg-white border rounded-lg p-4">
                    No messages yet. Start the conversation.
                  </div>
                )}

                {chats.map((chat) => {
                  const isMine = chat.senderUid === currentUser.uid || chat.sender === currentUser.name;
                  const isEditing = editingMsgId === chat.id;

                  return (
                    <div key={chat.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm relative select-none ${
                          isMine ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border rounded-bl-sm"
                        }`}
                        onTouchStart={(e) => this.onMsgPointerDown(e, chat)}
                        onTouchMove={this.onMsgPointerMove}
                        onTouchEnd={this.onMsgPointerUpOrCancel}
                        onTouchCancel={this.onMsgPointerUpOrCancel}
                        onContextMenu={(e) => this.onMsgContextMenu(e, chat)}
                        title={isMine ? "Long press (mobile) or right click (desktop) for options" : undefined}
                      >
                        {!isMine && <span className="block text-xs font-bold text-gray-400 mb-1">{chat.sender}</span>}

                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editingMsgText}
                              onChange={(e) => this.setState({ editingMsgText: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg outline-none text-gray-900"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={this.cancelEditMessage}
                                className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={this.saveEditMessage}
                                className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30"
                                title="Save"
                              >
                                <Check size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>{chat.content}</>
                        )}
                      </div>

                      <span className="text-[10px] text-gray-400 mt-1">
                        {chat.timestamp || (chat._optimistic ? "Sending…" : "")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Message options (WhatsApp-like) */}
              {msgMenuOpen && msgMenuTarget && (
                <>
                  <div className="fixed inset-0 bg-black/30 z-50" onClick={this.closeMsgMenu} />

                  {/* Mobile action sheet */}
                  <div className="fixed left-0 right-0 bottom-0 z-50 md:hidden">
                    <div className="bg-white rounded-t-2xl shadow-xl border p-4">
                      <div className="text-sm text-gray-500 mb-3">Message options</div>

                      <button
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          this.closeMsgMenu();
                          this.startEditMessage(msgMenuTarget);
                        }}
                      >
                        <Pencil size={18} /> Edit
                      </button>

                      <button
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2"
                        onClick={() => {
                          const msg = msgMenuTarget;
                          this.closeMsgMenu();
                          this.deleteMessage(msg);
                        }}
                      >
                        <Trash2 size={18} /> Delete
                      </button>

                      <button
                        className="w-full mt-3 px-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200"
                        onClick={this.closeMsgMenu}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Desktop context menu */}
                  <div
                    className="hidden md:block fixed z-50 bg-white border rounded-xl shadow-lg overflow-hidden"
                    style={{ left: msgMenuPos.x, top: msgMenuPos.y }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        this.closeMsgMenu();
                        this.startEditMessage(msgMenuTarget);
                      }}
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 flex items-center gap-2"
                      onClick={() => {
                        const msg = msgMenuTarget;
                        this.closeMsgMenu();
                        this.deleteMessage(msg);
                      }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </>
              )}

              <div className="p-4 bg-white border-t">
                <form onSubmit={this.handleSendMessage} className="flex gap-2 relative">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) => this.setState({ msgInput: e.target.value })}
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

          {/* ======================
              Notice Tab (Everyone)
             ====================== */}
          {activeTab === "notice" && (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-4">
                  {this.t("noticeTitle")}
                </h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">⚠️ {error}</div>
                )}

                {currentUser.role === "professor" && (
                  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
                    <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                      <Plus size={20} /> {this.t("noticeCreate")}
                    </h3>
                    <form onSubmit={this.handlePostAnnouncement} className="space-y-4">
                      <input
                        type="text"
                        placeholder={this.t("titlePlaceholder")}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={noticeTitle}
                        onChange={(e) => this.setState({ noticeTitle: e.target.value })}
                      />
                      <textarea
                        placeholder={this.t("contentPlaceholder")}
                        className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={noticeContent}
                        onChange={(e) => this.setState({ noticeContent: e.target.value })}
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm"
                        >
                          {this.t("postBtn")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {announcementsLoading && (
                  <div className="text-sm text-gray-500 bg-white border rounded-lg p-4 mb-4">Loading announcements…</div>
                )}

                <div className="space-y-4">
                  {announcements.map((notice) => {
                    const isEditing = editingNoticeId === notice.id;

                    return (
                      <div
                        key={notice.id}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-3">
                          {isEditing ? (
                            <input
                              value={editingNoticeTitle}
                              onChange={(e) => this.setState({ editingNoticeTitle: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                            />
                          ) : (
                            <h3 className="text-xl font-bold text-gray-900">{notice.title}</h3>
                          )}

                          {currentUser.role === "professor" && (
                            <div className="flex gap-1">
                              {!isEditing ? (
                                <>
                                  <button
                                    onClick={() => this.startEditNotice(notice)}
                                    className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"
                                    title="Edit"
                                  >
                                    <Pencil size={18} />
                                  </button>
                                  <button
                                    onClick={() => this.handleDeleteNotice(notice.id)}
                                    className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={this.cancelEditNotice}
                                    className="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-50"
                                    title="Cancel"
                                  >
                                    <X size={18} />
                                  </button>
                                  <button
                                    onClick={this.saveEditNotice}
                                    className="text-gray-400 hover:text-green-600 p-2 rounded-full hover:bg-green-50"
                                    title="Save"
                                  >
                                    <Check size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <textarea
                            value={editingNoticeContent}
                            onChange={(e) => this.setState({ editingNoticeContent: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-900"
                          />
                        ) : (
                          <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{notice.content}</p>
                        )}

                        <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-4">
                          <span className="font-medium text-blue-600 flex items-center gap-1">
                            <UserIcon size={14} /> {notice.author}
                          </span>
                          <span>{notice.date}</span>
                        </div>
                      </div>
                    );
                  })}
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
