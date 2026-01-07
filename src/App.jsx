import React, { Component } from 'react';
import { MessageSquare, Bell, LogOut, Send, Plus, Trash2, Globe, User as UserIcon, Lock, Mail } from 'lucide-react';

// [1] Clean Code: Import translation files from external folder
import en from './locales/en.json';
import de from './locales/de.json';

const TRANSLATIONS = { en, de };

/**
 * ==================================================================================
 * [2] CONSTANTS & CONFIGURATION
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
  "Visual & Experience Design MA"
];

// Mock Data for Initial State
const INITIAL_ANNOUNCEMENTS = [
  { id: 1, title: "Semester Break", content: "Campus closed from Dec 24.", author: "Prof. Weber", date: "2024-12-01" },
  { id: 2, title: "Project Deadline", content: "Submit SRS by Friday.", author: "Prof. Schmidt", date: "2024-12-05" }
];

const INITIAL_CHATS = [
  { id: 1, sender: "Hans", content: "Is the library open?", major: "Software Engineering BSc", timestamp: "09:00" },
  { id: 2, sender: "Julia", content: "Yes, until 8 PM.", major: "Software Engineering BSc", timestamp: "09:05" }
];

/**
 * ==================================================================================
 * [3] OBJECT-ORIENTED DOMAIN MODELS (100% OOP)
 * ==================================================================================
 */

// Base Class
class User {
  constructor(name, email, role) {
    this.name = name;
    this.email = email;
    this.role = role;
  }

  login() {
    // Authentication logic would go here
    return true;
  }

  logout() {
    // Cleanup logic would go here
    return true;
  }
}

// Subclass: Student
class Student extends User {
  constructor(name, email, major) {
    super(name, email, 'student');
    this.major = major;
  }

  sendMessage(content) {
    return {
      id: Date.now(),
      sender: this.name,
      content: content,
      major: this.major,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

// Subclass: Professor
class Professor extends User {
  constructor(name, email) {
    super(name, email, 'professor');
  }

  postAnnouncement(title, content) {
    return {
      id: Date.now(),
      title: title,
      content: content,
      author: this.name,
      date: new Date().toISOString().split('T')[0]
    };
  }
}

/**
 * ==================================================================================
 * [4] REACT CONTROLLER (Main App Class)
 * ==================================================================================
 */
class App extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      // System
      lang: 'en',
      authMode: 'login',
      currentUser: null,
      error: '',

      // Data
      chats: INITIAL_CHATS,
      announcements: INITIAL_ANNOUNCEMENTS,

      // Inputs
      email: '', password: '', name: '', role: 'student', major: MAJORS[0],
      msgInput: '', noticeTitle: '', noticeContent: '', activeTab: 'chat'
    };
  }

  // Helper: Get text from JSON files
  t = (key) => TRANSLATIONS[this.state.lang][key] || key;

  // --- Auth Logic ---
  handleAuth = (e) => {
    e.preventDefault();
    const { email, name, role, major } = this.state;

    // 1. Validation
    if (!email.endsWith('@ue-germany.de')) {
      this.setState({ error: this.t('errorEmail') });
      return;
    }

    // 2. Factory Pattern (OOP)
    const displayName = name || (role === 'student' ? "UE Student" : "Prof. Member");
    let userInstance;

    if (role === 'student') {
      userInstance = new Student(displayName, email, major);
    } else {
      userInstance = new Professor(displayName, email);
    }

    // 3. Login
    userInstance.login();

    // 4. Update UI
    this.setState({
      currentUser: userInstance,
      error: '',
      activeTab: role === 'professor' ? 'notice' : 'chat'
    });
  };

  handleLogout = () => {
    const { currentUser } = this.state;
    if (currentUser) {
      currentUser.logout();
      this.setState({ currentUser: null, email: '', password: '' });
    }
  };

  toggleLanguage = () => {
    this.setState(prevState => ({
      lang: prevState.lang === 'en' ? 'de' : 'en'
    }));
  };

  // --- Feature Logic ---
  handleSendMessage = (e) => {
    e.preventDefault();
    const { currentUser, msgInput, chats } = this.state;

    // OOP Check: Only Student Instance can send messages
    if (currentUser instanceof Student && msgInput.trim()) {
      const newMessage = currentUser.sendMessage(msgInput);
      this.setState({
        chats: [...chats, newMessage],
        msgInput: ''
      });
    }
  };

  handlePostAnnouncement = (e) => {
    e.preventDefault();
    const { currentUser, noticeTitle, noticeContent, announcements } = this.state;

    // OOP Check: Only Professor Instance can post
    if (currentUser instanceof Professor && noticeTitle.trim()) {
      const newNotice = currentUser.postAnnouncement(noticeTitle, noticeContent);
      this.setState({
        announcements: [newNotice, ...announcements],
        noticeTitle: '',
        noticeContent: ''
      });
    }
  };

  handleDeleteNotice = (id) => {
    this.setState(prevState => ({
      announcements: prevState.announcements.filter(n => n.id !== id)
    }));
  };

  // --- Render ---
  render() {
    const { currentUser, lang, authMode, email, password, name, role, major, error, 
            activeTab, chats, announcements, msgInput, noticeTitle, noticeContent } = this.state;

    // 1. Auth Screen
    if (!currentUser) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
          <div className="absolute top-5 right-5">
            <button onClick={this.toggleLanguage} className="flex items-center gap-2 px-3 py-1 bg-gray-200 rounded-full text-sm font-medium hover:bg-gray-300 transition-colors">
              <Globe size={16} /> {lang.toUpperCase()}
            </button>
          </div>
          
          <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-blue-700 mb-2">{this.t('appTitle')}</h1>
              <p className="text-gray-500 font-medium">
                {authMode === 'login' ? this.t('loginHeader') : this.t('signupHeader')}
              </p>
            </div>

            <form onSubmit={this.handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="email" placeholder="id@ue-germany.de" className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={email} onChange={e => this.setState({ email: e.target.value })} 
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="password" placeholder={this.t('passwordLabel')} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={password} onChange={e => this.setState({ password: e.target.value })} 
                />
              </div>

              {authMode === 'signup' && (
                <>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" placeholder={this.t('nameLabel')} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      value={name} onChange={e => this.setState({ name: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{this.t('roleLabel')}</label>
                    <select className="w-full px-4 py-2 border rounded-lg bg-white outline-none"
                      value={role} onChange={e => this.setState({ role: e.target.value })}>
                      <option value="student">{this.t('student')}</option>
                      <option value="professor">{this.t('professor')}</option>
                    </select>
                  </div>
                  {role === 'student' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{this.t('majorLabel')}</label>
                      <select className="w-full px-4 py-2 border rounded-lg bg-white text-sm outline-none"
                        value={major} onChange={e => this.setState({ major: e.target.value })}>
                        {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">⚠️ {error}</div>}

              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">
                {authMode === 'login' ? this.t('loginBtn') : this.t('signupBtn')}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button onClick={() => this.setState({ authMode: authMode === 'login' ? 'signup' : 'login', error: '' })} 
                className="text-sm text-blue-600 hover:underline font-medium">
                {authMode === 'login' ? this.t('switchSignup') : this.t('switchLogin')}
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
            <h1 className="text-xl font-bold">{this.t('appTitle')}</h1>
            <button onClick={this.toggleLanguage} className="flex items-center gap-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors">
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
                  {currentUser.role === 'student' ? this.t('student') : this.t('professor')}
                </span>
              </div>
            </div>
            {currentUser instanceof Student && (
              <div className="mt-4 text-sm text-gray-600 bg-white p-3 rounded-lg border border-blue-100">
                <p className="font-semibold text-gray-500 text-xs uppercase mb-1">{this.t('myMajor')}</p>
                <p className="leading-tight text-blue-900 font-medium">{currentUser.major}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {currentUser instanceof Student && (
              <button onClick={() => this.setState({ activeTab: 'chat' })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'chat' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
                <MessageSquare size={20} /> {this.t('chatTab')}
              </button>
            )}
            <button onClick={() => this.setState({ activeTab: 'notice' })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'notice' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Bell size={20} /> {this.t('noticeTab')}
            </button>
          </nav>

          <div className="p-4 border-t mt-auto">
            <button onClick={this.handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg">
              <LogOut size={20} /> {this.t('logout')}
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden">
          {/* Chat Tab */}
          {activeTab === 'chat' && currentUser instanceof Student && (
            <div className="flex flex-col h-full bg-gray-50">
              <header className="bg-white p-4 shadow-sm border-b flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{currentUser.major}</h2>
                  <p className="text-xs text-gray-500">Official Group Chat</p>
                </div>
                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">● {this.t('online')}</div>
              </header>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chats.filter(c => c.major === currentUser.major).map((chat) => (
                  <div key={chat.id} className={`flex flex-col ${chat.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm ${chat.sender === currentUser.name ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'}`}>
                      {chat.sender !== currentUser.name && <span className="block text-xs font-bold text-gray-400 mb-1">{chat.sender}</span>}
                      {chat.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">{chat.timestamp}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white border-t">
                <form onSubmit={this.handleSendMessage} className="flex gap-2 relative">
                  <input type="text" value={msgInput} onChange={e => this.setState({ msgInput: e.target.value })} placeholder={this.t('chatPlaceholder')} className="flex-1 pl-4 pr-12 py-3 border rounded-full focus:outline-none focus:border-blue-500 shadow-inner" />
                  <button type="submit" className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md"><Send size={18} /></button>
                </form>
              </div>
            </div>
          )}

          {/* Notice Tab */}
          {activeTab === 'notice' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-4">{this.t('noticeTitle')}</h2>
                {currentUser instanceof Professor && (
                  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
                    <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2"><Plus size={20} /> {this.t('noticeCreate')}</h3>
                    <form onSubmit={this.handlePostAnnouncement} className="space-y-4">
                      <input type="text" placeholder={this.t('titlePlaceholder')} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={noticeTitle} onChange={e => this.setState({ noticeTitle: e.target.value })} />
                      <textarea placeholder={this.t('contentPlaceholder')} className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={noticeContent} onChange={e => this.setState({ noticeContent: e.target.value })} />
                      <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm">{this.t('postBtn')}</button>
                      </div>
                    </form>
                  </div>
                )}
                <div className="space-y-4">
                  {announcements.map((notice) => (
                    <div key={notice.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold text-gray-900">{notice.title}</h3>
                        {currentUser instanceof Professor && (
                          <button onClick={() => this.handleDeleteNotice(notice.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50"><Trash2 size={18} /></button>
                        )}
                      </div>
                      <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{notice.content}</p>
                      <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-4">
                        <span className="font-medium text-blue-600 flex items-center gap-1"><UserIcon size={14} /> {notice.author}</span>
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