import React, { useState } from 'react';
import { MessageSquare, Bell, LogOut, Send, Plus, Trash2, Globe, User, Lock, Mail } from 'lucide-react';


import en from './locales/en.json';
import de from './locales/de.json';

const TRANSLATIONS = { en, de };

/**
 * ==================================================================================
 * CONFIGURATION & CONSTANTS
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
 * SHARED COMPONENTS
 * ==================================================================================
 */

/**
 * LanguageSwitcher Component
 * Defined globally to prevent re-declaration issues during re-renders.
 */
const LanguageSwitcher = ({ currentLang, onToggle }) => (
  <button 
    onClick={() => onToggle(currentLang === 'en' ? 'de' : 'en')}
    className="flex items-center gap-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium transition-colors text-gray-700"
  >
    <Globe size={16} />
    {currentLang === 'en' ? 'DE' : 'EN'}
  </button>
);

/**
 * ==================================================================================
 * MAIN APPLICATION COMPONENT
 * ==================================================================================
 */
export default function App() {
  // --- Global State ---
  const [lang, setLang] = useState('en'); 
  const [user, setUser] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  
  // --- Data State ---
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [chats, setChats] = useState(INITIAL_CHATS);
  
  // --- Input State (Auth) ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [major, setMajor] = useState(MAJORS[0]);
  const [error, setError] = useState('');

  // --- Input State (Features) ---
  const [msgInput, setMsgInput] = useState('');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [activeTab, setActiveTab] = useState('chat');

  // Translation helper function fetching data from external JSON object
  const t = (key) => TRANSLATIONS[lang][key];

  /**
   * Handle Login Process
   * Checks domain @ue-germany.de as per SRS FR-01
   */
  const handleLogin = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('errorEmpty'));
      return;
    }
    if (!email.endsWith('@ue-germany.de')) {
      setError(t('errorEmail'));
      return;
    }
    
    // MOCK LOGIN: Role determination logic
    const isProfessor = email.includes('prof');
    const mockUser = { 
      name: isProfessor ? "Prof. Dr. Member" : "UE Student", 
      email, 
      role: isProfessor ? 'professor' : 'student',
      major: isProfessor ? null : MAJORS[0] 
    };
    
    setUser(mockUser);
    setError('');
    setActiveTab(mockUser.role === 'professor' ? 'notice' : 'chat');
  };

  /**
   * Handle Sign Up Process
   */
  const handleSignup = (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setError(t('errorEmpty'));
      return;
    }
    if (!email.endsWith('@ue-germany.de')) {
      setError(t('errorEmail'));
      return;
    }

    const newUser = { 
      name, 
      email, 
      role, 
      major: role === 'student' ? major : null 
    };
    setUser(newUser);
    setError('');
    setActiveTab(role === 'professor' ? 'notice' : 'chat');
  };

  /**
   * Handle Sending Message (Student Only - SRS FR-02)
   */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;

    const newMessage = {
      id: Date.now(),
      sender: user.name,
      content: msgInput,
      major: user.major,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats([...chats, newMessage]);
    setMsgInput('');
  };

  /**
   * Handle Posting Announcement (Professor Only - SRS FR-03)
   */
  const handlePostNotice = (e) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    const newNotice = {
      id: Date.now(),
      title: noticeTitle,
      content: noticeContent,
      author: user.name,
      date: new Date().toISOString().split('T')[0]
    };

    setAnnouncements([newNotice, ...announcements]);
    setNoticeTitle('');
    setNoticeContent('');
  };

  const handleDeleteNotice = (id) => {
    setAnnouncements(announcements.filter(n => n.id !== id));
  };

  /**
   * VIEW: Authentication Screen
   */
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="absolute top-5 right-5">
          <LanguageSwitcher currentLang={lang} onToggle={setLang} />
        </div>
        
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-700 mb-2">{t('appTitle')}</h1>
            <p className="text-gray-500 font-medium">
              {authMode === 'login' ? t('loginHeader') : t('signupHeader')}
            </p>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                placeholder="id@ue-germany.de"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                placeholder={t('passwordLabel')}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authMode === 'signup' && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder={t('nameLabel')}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('roleLabel')}</label>
                  <select
                    className="w-full px-4 py-2 border rounded-lg outline-none bg-white"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    <option value="student">{t('student')}</option>
                    <option value="professor">{t('professor')}</option>
                  </select>
                </div>

                {role === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('majorLabel')}</label>
                    <select
                      className="w-full px-4 py-2 border rounded-lg outline-none bg-white text-sm"
                      value={major}
                      onChange={e => setMajor(e.target.value)}
                    >
                      {MAJORS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">⚠️ {error}</div>}

            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">
              {authMode === 'login' ? t('loginBtn') : t('signupBtn')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {authMode === 'login' ? t('switchSignup') : t('switchLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * VIEW: Main Dashboard
   */
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white shadow-lg z-10 flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
          <h1 className="text-xl font-bold">{t('appTitle')}</h1>
          <LanguageSwitcher currentLang={lang} onToggle={setLang} />
        </div>

        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800">{user.name}</p>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-600 text-white rounded-full uppercase">
                {user.role === 'student' ? t('student') : t('professor')}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {user.role === 'student' && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'chat' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare size={20} />
              {t('chatTab')}
            </button>
          )}
          <button
            onClick={() => setActiveTab('notice')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'notice' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Bell size={20} />
            {t('noticeTab')}
          </button>
        </nav>

        <div className="p-4 border-t mt-auto">
          <button onClick={() => setUser(null)} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg">
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden">
        
        {/* Chat Tab (Student Only) */}
        {activeTab === 'chat' && user.role === 'student' && (
          <div className="flex flex-col h-full bg-gray-50">
            <header className="bg-white p-4 shadow-sm border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{user.major}</h2>
                <p className="text-xs text-gray-500">Official Group Chat</p>
              </div>
              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                ● {t('online')}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chats.filter(c => c.major === user.major).map((chat) => (
                <div key={chat.id} className={`flex flex-col ${chat.sender === user.name ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                    chat.sender === user.name ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'
                  }`}>
                    {chat.sender !== user.name && <span className="block text-xs font-bold text-gray-400 mb-1">{chat.sender}</span>}
                    {chat.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1">{chat.timestamp}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                <input
                  type="text"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  placeholder={t('chatPlaceholder')}
                  className="flex-1 pl-4 pr-12 py-3 border rounded-full focus:outline-none focus:border-blue-500 shadow-inner"
                />
                <button type="submit" className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Notice Board Tab (Universal Access) */}
        {activeTab === 'notice' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-4">
                {t('noticeTitle')}
              </h2>

              {/* Professor Create Form (Role Restriction Applied) */}
              {user.role === 'professor' && (
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
                  <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <Plus size={20} /> {t('noticeCreate')}
                  </h3>
                  <form onSubmit={handlePostNotice} className="space-y-4">
                    <input
                      type="text"
                      placeholder={t('titlePlaceholder')}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={noticeTitle}
                      onChange={e => setNoticeTitle(e.target.value)}
                    />
                    <textarea
                      placeholder={t('contentPlaceholder')}
                      className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      value={noticeContent}
                      onChange={e => setNoticeContent(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-all">
                        {t('postBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Announcements Feed */}
              <div className="space-y-4">
                {announcements.map((notice) => (
                  <div key={notice.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{notice.title}</h3>
                      {user.role === 'professor' && (
                        <button onClick={() => handleDeleteNotice(notice.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{notice.content}</p>
                    <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-4">
                      <span className="font-medium text-blue-600 flex items-center gap-1">
                        <User size={14} /> {notice.author}
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