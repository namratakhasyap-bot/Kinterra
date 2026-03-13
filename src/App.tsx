import React, { useState, useEffect, Component } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, limit, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Leaf, Search, MessageCircle, User, LogOut, Send, Plus, X, Check, ArrowRight, ChevronLeft, ChevronRight, Camera, UserPlus, UserCheck, UserX, MoreVertical, Moon, Sun, Settings, Bell, Shield } from 'lucide-react';
import { User as UserType, Post, Chat, Message, OnboardingData, FriendRequest } from './types';
import { moderateText, moderateImage, generateBotProfiles } from './services/geminiService';
import { filterText } from './utils/filter';

// --- Components ---

const Logo = ({ size = 40, className = "" }: { size?: number, className?: string }) => (
  <div className={`flex items-center justify-center ${className}`} style={{ width: size * 1.5, height: size }}>
    <div className="relative flex items-center">
      <Heart className="text-pink-600 fill-pink-600" size={size} />
      <Leaf className="text-pink-400 fill-pink-400 -ml-3 mt-3 -rotate-12" size={size * 0.8} />
    </div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false }: any) => {
  const variants: any = {
    primary: "bg-pink-600 text-white hover:bg-pink-700",
    secondary: "bg-pink-100 text-pink-700 hover:bg-pink-200",
    outline: "border-2 border-pink-600 text-pink-600 hover:bg-pink-50",
    ghost: "text-gray-500 hover:bg-gray-100"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`px-6 py-3 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="w-full mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1 ml-2">{label}</label>}
    <input 
      {...props} 
      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-pink-300 outline-none transition-all bg-white"
    />
  </div>
);

// --- Screens ---

interface DetailedProfileViewProps {
  user: UserType;
  currentUser: UserType;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const DetailedProfileView = ({ user, currentUser, onBack, theme }: DetailedProfileViewProps) => {
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'accepted' | 'declined' | 'received'>('none');
  const [receivedRequestId, setReceivedRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    const checkRequest = async () => {
      // Check if I sent a request
      const sentId = `${currentUser.uid}_${user.uid}`;
      const sentSnap = await getDoc(doc(db, 'friendRequests', sentId));
      
      if (sentSnap.exists()) {
        setRequestStatus(sentSnap.data().status);
      } else {
        // Check if I received a request
        const receivedId = `${user.uid}_${currentUser.uid}`;
        const receivedSnap = await getDoc(doc(db, 'friendRequests', receivedId));
        if (receivedSnap.exists()) {
          if (receivedSnap.data().status === 'pending') {
            setRequestStatus('received');
            setReceivedRequestId(receivedId);
          } else {
            setRequestStatus(receivedSnap.data().status);
          }
        }
      }
      setLoading(false);
    };
    checkRequest();
  }, [currentUser.uid, user.uid]);

  const sendRequest = async () => {
    const requestId = `${currentUser.uid}_${user.uid}`;
    try {
      await setDoc(doc(db, 'friendRequests', requestId), {
        id: requestId,
        fromUid: currentUser.uid,
        toUid: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRequestStatus('pending');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `friendRequests/${requestId}`);
    }
  };

  const handleAccept = async () => {
    if (!receivedRequestId) return;
    try {
      await setDoc(doc(db, 'friendRequests', receivedRequestId), { status: 'accepted' }, { merge: true });
      
      const chatId = [currentUser.uid, user.uid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId), {
        id: chatId,
        participants: [currentUser.uid, user.uid],
        lastTimestamp: serverTimestamp(),
        lastMessage: 'You are now connected!'
      }, { merge: true });
      
      setRequestStatus('accepted');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `friendRequests/${receivedRequestId}`);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setIsReporting(true);
    const reportId = `${currentUser.uid}_${user.uid}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        reporterUid: currentUser.uid,
        reportedUid: user.uid,
        reason: reportReason,
        createdAt: serverTimestamp()
      });
      setShowReportModal(false);
      setReportReason('');
      setShowMenu(false);
      // We could add a toast here, but for now a simple alert or just closing is fine
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}`);
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      drag="y"
      dragConstraints={{ top: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.y > 150 || velocity.y > 500) {
          onBack();
        }
      }}
      className={`absolute inset-0 z-[100] flex flex-col overflow-y-auto ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
    >
      <div className="relative h-[70vh] flex-shrink-0">
        <img src={user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-3 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-all"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-all"
          >
            <MoreVertical size={24} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className={`absolute right-0 mt-2 w-48 rounded-2xl shadow-2xl border p-2 z-[110] ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
              >
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Shield size={18} /> Report User
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-8 flex-1">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-1">@{user.username}</h2>
            {user.isBot && <span className="text-xs font-bold text-pink-600 uppercase tracking-widest">Community Member</span>}
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Bio</h4>
            <p className={`leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              {user.bio || "This user hasn't written a bio yet."}
            </p>
          </section>

          <section>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Interests</h4>
            <div className="flex flex-wrap gap-2">
              {user.interests?.map(i => (
                <span key={i} className={`px-4 py-1.5 rounded-full text-sm font-medium ${theme === 'dark' ? 'bg-gray-800 text-pink-400' : 'bg-pink-50 text-pink-600'}`}>
                  #{i.replace(/\s+/g, '')}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-12 mb-8">
          {requestStatus === 'none' ? (
            <Button className="w-full py-4 text-lg shadow-xl shadow-pink-200" onClick={sendRequest}>
              Send Connection Request
            </Button>
          ) : requestStatus === 'received' ? (
            <Button className="w-full py-4 text-lg shadow-xl shadow-green-200 bg-green-600 hover:bg-green-700" onClick={handleAccept}>
              Accept Connection Request
            </Button>
          ) : (
            <div className={`w-full py-4 rounded-full text-center font-bold text-lg border-2 ${
              requestStatus === 'pending' ? 'border-pink-200 text-pink-400 bg-pink-50/30' : 
              requestStatus === 'accepted' ? 'border-green-200 text-green-500 bg-green-50/30' : 
              'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {requestStatus === 'pending' ? 'Request Sent' : 
               requestStatus === 'accepted' ? 'Connected' : 
               'Request Declined'}
            </div>
          )}
          {requestStatus === 'accepted' && (
            <p className="text-center text-sm text-gray-400 mt-4">You can now message each other in the Chats tab.</p>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-sm p-8 rounded-[32px] shadow-2xl ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4">Report User</h3>
              <p className="text-sm text-gray-400 mb-6">Please tell us why you are reporting @{user.username}. Our team will review it shortly.</p>
              
              <textarea 
                placeholder="Reason for reporting..."
                className={`w-full p-4 rounded-2xl border-2 outline-none h-32 mb-6 transition-all ${theme === 'dark' ? 'bg-gray-900 border-gray-700 focus:border-red-500' : 'bg-gray-50 border-gray-100 focus:border-red-300'}`}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setShowReportModal(false)}>Cancel</Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20" 
                  onClick={handleReport}
                  disabled={isReporting || !reportReason.trim()}
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const IntroScreen = ({ onNext }: { onNext: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white"
  >
    <Logo size={100} className="mb-8" />
    <h1 className="text-4xl font-bold text-gray-900 mb-4">Kinterra</h1>
    <p className="text-lg text-gray-600 max-w-md mb-8 leading-relaxed">
      Kinterra is a place to build real human connections. Share your thoughts, reduce loneliness, and find meaningful conversations.
    </p>
    <p className="text-md text-gray-500 max-w-sm mb-12">
      Whether you want to talk about ideas, life, stress, or creativity — Kinterra connects you with people around the world.
    </p>
    <Button onClick={onNext}>Get Started</Button>
  </motion.div>
);

const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-8 bg-white"
    >
      <Logo size={60} className="mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 mb-8">{isLogin ? 'Welcome Back' : 'Join Kinterra'}</h2>
      
      <form onSubmit={handleEmailAuth} className="w-full max-w-sm">
        <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <Button className="w-full mb-4" disabled={loading}>
          {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
        </Button>
      </form>

      <div className="flex items-center w-full max-w-sm mb-6">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="px-4 text-gray-400 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      <Button variant="outline" className="w-full max-w-sm mb-8" onClick={handleGoogleSignIn}>
        Continue with Google
      </Button>

      <button onClick={() => setIsLogin(!isLogin)} className="text-pink-600 font-medium">
        {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
      </button>
    </motion.div>
  );
};

const OnboardingScreen = ({ user, onComplete }: { user: any, onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    username: '',
    bio: '',
    interests: [],
    photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
  });
  const [interestInput, setInterestInput] = useState('');

  const handleComplete = async () => {
    const newUser: UserType = {
      uid: user.uid,
      username: data.username,
      searchUsername: data.username.toLowerCase(),
      bio: data.bio,
      interests: data.interests,
      photoURL: data.photoURL,
      isBot: false,
      createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newUser);
      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen p-8 bg-white"
    >
      <div className="flex justify-between items-center mb-12">
        <Logo size={40} />
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 w-8 rounded-full ${s <= step ? 'bg-pink-600' : 'bg-gray-100'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
            <h2 className="text-3xl font-bold mb-4">Choose your username</h2>
            <p className="text-gray-500 mb-8">This is how people will find you.</p>
            <Input 
              placeholder="@username" 
              value={data.username} 
              onChange={(e: any) => setData({ ...data, username: e.target.value })} 
            />
            <Button className="mt-8" onClick={() => setStep(2)} disabled={!data.username}>Next</Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
            <h2 className="text-3xl font-bold mb-4">Tell us about yourself</h2>
            <p className="text-gray-500 mb-8">Write a short bio and upload a photo.</p>
            <div className="flex items-center gap-6 mb-8">
              <img src={data.photoURL} className="w-24 h-24 rounded-full border-4 border-pink-100 object-cover" referrerPolicy="no-referrer" />
              <Button 
                variant="secondary" 
                className="flex items-center gap-2"
                onClick={() => {
                  const seed = Math.random().toString(36).substring(7);
                  setData({ ...data, photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` });
                }}
              >
                <Camera size={20} /> Randomize
              </Button>
            </div>
            <textarea 
              placeholder="Write your bio..." 
              className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-pink-300 outline-none h-32 mb-8"
              value={data.bio}
              onChange={(e) => setData({ ...data, bio: e.target.value })}
            />
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
            <h2 className="text-3xl font-bold mb-4">What are you into?</h2>
            <p className="text-gray-500 mb-8">Select interests to find like-minded people.</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {data.interests.map(interest => (
                <div key={interest} className="bg-pink-100 text-pink-700 px-4 py-2 rounded-full flex items-center gap-2">
                  {interest}
                  <X size={16} className="cursor-pointer" onClick={() => setData({ ...data, interests: data.interests.filter(i => i !== interest) })} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-12">
              <Input 
                placeholder="Add interest (e.g. Art, Tech, Life)" 
                value={interestInput}
                onChange={(e: any) => setInterestInput(e.target.value)}
                onKeyPress={(e: any) => {
                  if (e.key === 'Enter' && interestInput) {
                    setData({ ...data, interests: [...data.interests, interestInput] });
                    setInterestInput('');
                  }
                }}
              />
              <Button variant="secondary" onClick={() => {
                if (interestInput) {
                  setData({ ...data, interests: [...data.interests, interestInput] });
                  setInterestInput('');
                }
              }}>+</Button>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleComplete}>Finish Setup</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const DiscoveryScreen = ({ currentUser, theme, pendingCount }: { currentUser: UserType, theme: 'light' | 'dark', pendingCount: number }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'accepted'>('none');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('uid', '!=', currentUser.uid), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserType);
      setUsers(usersData);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (currentIndex < users.length) {
      const checkRequest = async () => {
        const user = users[currentIndex];
        const requestId = `${currentUser.uid}_${user.uid}`;
        const snap = await getDoc(doc(db, 'friendRequests', requestId));
        if (snap.exists()) {
          setRequestStatus(snap.data().status);
        } else {
          setRequestStatus('none');
        }
      };
      checkRequest();
    }
  }, [currentIndex, users, currentUser.uid]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const fetchResults = async () => {
        setIsSearching(true);
        try {
          const q = query(
            collection(db, 'users'),
            where('searchUsername', '>=', searchQuery.toLowerCase()),
            where('searchUsername', '<=', searchQuery.toLowerCase() + '\uf8ff'),
            limit(10)
          );
          const snap = await getDocs(q);
          const results = snap.docs
            .map(doc => doc.data() as UserType)
            .filter(u => u.uid !== currentUser.uid);
          setSearchResults(results);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } finally {
          setIsSearching(false);
        }
      };
      const timer = setTimeout(fetchResults, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, currentUser.uid]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex(prev => prev + 1);
  };

  const sendRequest = async () => {
    const user = users[currentIndex];
    const requestId = `${currentUser.uid}_${user.uid}`;
    try {
      await setDoc(doc(db, 'friendRequests', requestId), {
        id: requestId,
        fromUid: currentUser.uid,
        toUid: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRequestStatus('pending');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `friendRequests/${requestId}`);
    }
  };

  const variants = {
    enter: { scale: 0.9, opacity: 0, y: 100 },
    center: { scale: 1, opacity: 1, y: 0, x: 0, rotate: 0 },
    exit: { y: -800, opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }
  };

  if (currentIndex >= users.length) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 h-full ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        <Logo size={60} className="mb-4 opacity-20" />
        <p className="text-gray-400">No more people to discover right now.</p>
        <Button variant="secondary" className="mt-4" onClick={() => setCurrentIndex(0)}>Refresh</Button>
      </div>
    );
  }

  const user = users[currentIndex];

  return (
    <div className={`flex flex-col h-full p-4 transition-colors ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
          <Search size={24} className="text-gray-400" />
        </button>
        <div className="w-10" />
        <div className="relative p-2">
          <Bell size={24} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-400'} />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 bg-pink-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
              {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md p-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  autoFocus
                  placeholder="Search usernames..."
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl outline-none border-2 transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white focus:border-pink-500' : 'bg-white border-gray-100 text-gray-900 focus:border-pink-300'}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-white font-medium">Cancel</button>
            </div>

            <div className="space-y-3">
              {isSearching ? (
                <div className="text-center text-white/60 py-8 italic">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(result => (
                  <button 
                    key={result.uid}
                    onClick={() => {
                      const index = users.findIndex(u => u.uid === result.uid);
                      if (index !== -1) setCurrentIndex(index);
                      else { setUsers([result, ...users]); setCurrentIndex(0); }
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-pink-50 text-gray-900 shadow-sm'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <img 
                        src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-pink-100" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-lg leading-tight">@{result.username}</div>
                      <div className="text-sm opacity-70 line-clamp-1">{result.bio || 'No bio available'}</div>
                    </div>
                    <ChevronRight size={20} className="opacity-30 flex-shrink-0" />
                  </button>
                ))
              ) : searchQuery && (
                <div className="text-center text-white/60 py-8">No users found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={user.uid}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y < -100 || velocity.y < -500) {
                handleNext();
              }
            }}
            className={`absolute inset-0 rounded-[40px] shadow-2xl overflow-hidden border cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
          >
            <img src={user.photoURL} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
            
            <div className="absolute top-8 left-8 z-10">
              <button 
                onClick={sendRequest}
                disabled={requestStatus !== 'none'}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
                  requestStatus === 'none' ? 'bg-pink-600 hover:bg-pink-700 text-white' : 
                  requestStatus === 'pending' ? 'bg-pink-100 text-pink-400' : 'bg-green-500 text-white'
                }`}
              >
                {requestStatus === 'none' ? <Plus size={32} /> : requestStatus === 'pending' ? <UserPlus size={32} /> : <UserCheck size={32} />}
              </button>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <div className="flex justify-between items-end">
                <div className="flex-1 pr-4">
                  <h3 className="text-4xl font-bold mb-2">@{user.username}</h3>
                  <p className="text-white/80 text-lg line-clamp-2 mb-4">{user.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {user.interests?.slice(0, 3).map(i => (
                      <span key={i} className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium">#{i}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/40">
                <ChevronRight className="-rotate-90" size={16} />
                Swipe up for next profile
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const ChatScreen = ({ currentUser, chatId, onBack, theme }: { currentUser: UserType, chatId: string, onBack: () => void, theme: 'light' | 'dark' }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<UserType | null>(null);

  useEffect(() => {
    const fetchOtherUser = async () => {
      const otherUid = chatId.split('_').find(uid => uid !== currentUser.uid);
      if (otherUid) {
        const userSnap = await getDoc(doc(db, 'users', otherUid));
        if (userSnap.exists()) setOtherUser(userSnap.data() as UserType);
      }
    };
    fetchOtherUser();

    const q = query(collection(db, 'chats', chatId, 'messages'), where('chatId', '==', chatId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(msgs.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds));
    });
    return unsubscribe;
  }, [chatId, currentUser.uid]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const { cleanText, hasBadWords } = filterText(inputText);
    if (hasBadWords) {
      alert("Please keep the conversation positive and respectful.");
      return;
    }

    const msg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      chatId,
      senderUid: currentUser.uid,
      text: cleanText,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), msg);
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: cleanText,
        lastTimestamp: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}`);
    }

    setInputText('');
  };

  return (
    <div className={`flex flex-col h-full transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className={`flex items-center gap-4 p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
        <button onClick={onBack} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}><ChevronLeft /></button>
        {otherUser && (
          <div className="flex items-center gap-3">
            <img src={otherUser.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            <div>
              <h4 className="font-bold">@{otherUser.username}</h4>
              <p className="text-xs text-green-500">Online</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderUid === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-4 rounded-3xl ${
              msg.senderUid === currentUser.uid 
                ? 'bg-pink-600 text-white rounded-tr-none' 
                : theme === 'dark' ? 'bg-gray-800 text-gray-200 rounded-tl-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className={`p-4 border-t flex gap-2 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
        <input 
          placeholder="Type a message..." 
          className={`flex-1 rounded-full px-6 py-3 outline-none focus:ring-2 ring-pink-200 transition-all ${
            theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900'
          }`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} className="bg-pink-600 text-white p-3 rounded-full hover:bg-pink-700 transition-all shadow-lg shadow-pink-600/20">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

const ChatList = ({ currentUser, onSelectChat, theme }: { currentUser: UserType, onSelectChat: (id: string) => void, theme: 'light' | 'dark' }) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');
  const [chats, setChats] = useState<(Chat & { otherUser?: UserType })[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { fromUser?: UserType })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      const chatsWithUsers = await Promise.all(chatsData.map(async (chat) => {
        const otherUid = chat.participants.find(uid => uid !== currentUser.uid);
        if (otherUid) {
          const userSnap = await getDoc(doc(db, 'users', otherUid));
          return { ...chat, otherUser: userSnap.data() as UserType };
        }
        return chat;
      }));
      setChats(chatsWithUsers.sort((a, b) => (b.lastTimestamp?.seconds || 0) - (a.lastTimestamp?.seconds || 0)));
      setLoading(false);
    });
    return unsubscribe;
  }, [currentUser.uid]);

  useEffect(() => {
    const q = query(collection(db, 'friendRequests'), where('toUid', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
      const reqsWithUsers = await Promise.all(reqs.map(async (r) => {
        const userSnap = await getDoc(doc(db, 'users', r.fromUid));
        return { ...r, fromUser: userSnap.data() as UserType };
      }));
      setRequests(reqsWithUsers);
    });
    return unsubscribe;
  }, [currentUser.uid]);

  const handleRequest = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;

      await setDoc(doc(db, 'friendRequests', requestId), { status }, { merge: true });
      
      if (status === 'accepted') {
        const chatId = [currentUser.uid, req.fromUid].sort().join('_');
        await setDoc(doc(db, 'chats', chatId), {
          id: chatId,
          participants: [currentUser.uid, req.fromUid],
          lastTimestamp: serverTimestamp(),
          lastMessage: 'You are now connected!'
        }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `friendRequests/${requestId}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400 italic">Loading...</div>;

  return (
    <div className={`flex flex-col h-full transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="p-6 pb-2">
        <h2 className="text-3xl font-bold mb-6">Inbox</h2>
        <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800">
          <button 
            onClick={() => setActiveTab('messages')}
            className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'messages' ? 'text-pink-600' : 'text-gray-400'}`}
          >
            Messages
            {activeTab === 'messages' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-pink-600 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'requests' ? 'text-pink-600' : 'text-gray-400'}`}
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-2 bg-pink-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.length}</span>
            )}
            {activeTab === 'requests' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-pink-600 rounded-full" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'messages' ? (
            <motion.div key="messages" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {chats.length === 0 ? (
                <div className="text-center mt-20">
                  <MessageCircle size={60} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-gray-400">No conversations yet.</p>
                </div>
              ) : (
                chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <img src={chat.otherUser?.photoURL} className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1 text-left">
                      <div className="font-bold">@{chat.otherUser?.username}</div>
                      <div className="text-sm text-gray-500 truncate">{chat.lastMessage || 'Start a conversation...'}</div>
                    </div>
                    {chat.lastTimestamp && (
                      <div className="text-xs text-gray-400">
                        {new Date(chat.lastTimestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="requests" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              {requests.length === 0 ? (
                <div className="text-center mt-20">
                  <UserPlus size={60} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-gray-400">No pending requests.</p>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className={`p-4 rounded-3xl flex items-center justify-between ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <img src={req.fromUser?.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                      <div>
                        <div className="font-bold">@{req.fromUser?.username}</div>
                        <div className="text-xs text-gray-400">wants to connect</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRequest(req.id, 'declined')}
                        className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                      >
                        <UserX size={20} />
                      </button>
                      <button 
                        onClick={() => handleRequest(req.id, 'accepted')}
                        className="p-2 bg-pink-600 text-white rounded-full hover:bg-pink-700 transition-colors shadow-lg shadow-pink-600/20"
                      >
                        <UserCheck size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Profile Screen ---

const ProfileScreen = ({ profile, onUpdate, theme, onToggleTheme }: { profile: UserType, onUpdate: (newProfile: UserType) => void, theme: 'light' | 'dark', onToggleTheme: () => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editData, setEditData] = useState<OnboardingData>({
    username: profile.username,
    bio: profile.bio || '',
    interests: profile.interests || [],
    photoURL: profile.photoURL
  });
  const [interestInput, setInterestInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!editData.username.trim()) return;
    setLoading(true);
    const updatedProfile = {
      ...profile,
      username: editData.username,
      searchUsername: editData.username.toLowerCase(),
      bio: editData.bio,
      interests: editData.interests,
      photoURL: editData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`
    };

    try {
      await setDoc(doc(db, 'users', profile.uid), updatedProfile, { merge: true });
      onUpdate(updatedProfile);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className={`p-8 overflow-y-auto h-full transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
        
        <div className="flex items-center gap-6 mb-8">
          <img src={editData.photoURL} className="w-20 h-20 rounded-full border-4 border-pink-100 object-cover" referrerPolicy="no-referrer" />
          <Button variant="secondary" className="flex items-center gap-2 text-sm py-2" onClick={() => {
            const seed = Math.random().toString(36).substring(7);
            setEditData({ ...editData, photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` });
          }}>
            <Camera size={16} /> Randomize
          </Button>
        </div>

        <Input 
          label="Username" 
          value={editData.username} 
          onChange={(e: any) => setEditData({ ...editData, username: e.target.value })} 
          className={theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : ''}
        />

        <div className="w-full mb-4">
          <label className="block text-sm font-medium mb-1 ml-2">Bio</label>
          <textarea 
            placeholder="Write your bio..." 
            className={`w-full p-4 rounded-2xl border-2 outline-none h-32 transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 focus:border-pink-500' : 'bg-white border-gray-100 focus:border-pink-300'}`}
            value={editData.bio}
            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 ml-2">Interests & Hashtags</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {editData.interests.map(interest => (
              <div key={interest} className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm">
                #{interest.replace(/\s+/g, '')}
                <X size={14} className="cursor-pointer" onClick={() => setEditData({ ...editData, interests: editData.interests.filter(i => i !== interest) })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              placeholder="Add interest" 
              className={`flex-1 px-4 py-2 rounded-xl border-2 outline-none text-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 focus:border-pink-500' : 'bg-white border-gray-100 focus:border-pink-300'}`}
              value={interestInput}
              onChange={(e: any) => setInterestInput(e.target.value)}
              onKeyPress={(e: any) => {
                if (e.key === 'Enter' && interestInput) {
                  setEditData({ ...editData, interests: [...editData.interests, interestInput] });
                  setInterestInput('');
                }
              }}
            />
            <Button variant="secondary" className="py-2 px-4" onClick={() => {
              if (interestInput) {
                setEditData({ ...editData, interests: [...editData.interests, interestInput] });
                setInterestInput('');
              }
            }}>+</Button>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-8 text-center h-full overflow-y-auto transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex justify-end items-center gap-4 mb-2">
        <button onClick={() => setIsEditing(true)} className="text-pink-600 flex items-center gap-1 font-medium hover:underline">
          Edit Profile
        </button>
        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
          <MoreVertical size={20} />
        </button>
      </div>
      
      <img src={profile.photoURL} className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-pink-100 object-cover" referrerPolicy="no-referrer" />
      <h2 className="text-2xl font-bold mb-2">@{profile.username}</h2>
      <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{profile.bio || 'No bio yet.'}</p>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {profile.interests?.map(i => (
          <span key={i} className={`px-4 py-1 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800 text-pink-400' : 'bg-pink-50 text-pink-600'}`}>
            #{i.replace(/\s+/g, '')}
          </span>
        ))}
        {(!profile.interests || profile.interests.length === 0) && (
          <p className="text-gray-400 italic text-sm">No interests added.</p>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => signOut(auth)}>Log Out</Button>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`w-full max-w-md p-8 rounded-t-[40px] shadow-2xl ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Settings className="text-pink-600" /> Settings
              </h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    {theme === 'light' ? <Sun className="text-orange-400" /> : <Moon className="text-indigo-400" />}
                    <div>
                      <div className="font-bold">Theme</div>
                      <div className="text-xs text-gray-400">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</div>
                    </div>
                  </div>
                  <button 
                    onClick={onToggleTheme}
                    className={`w-14 h-8 rounded-full p-1 transition-all ${theme === 'dark' ? 'bg-pink-600' : 'bg-gray-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <Bell className="text-blue-400" />
                    <div>
                      <div className="font-bold">Notifications</div>
                      <div className="text-xs text-gray-400">Push & In-app</div>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const newPrefs = { ...profile.preferences, notifications: !profile.preferences?.notifications };
                      const updated = { ...profile, preferences: newPrefs };
                      await setDoc(doc(db, 'users', profile.uid), updated, { merge: true });
                      onUpdate(updated);
                    }}
                    className={`w-14 h-8 rounded-full p-1 transition-all ${profile.preferences?.notifications ? 'bg-pink-600' : 'bg-gray-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${profile.preferences?.notifications ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <Shield className="text-emerald-400" />
                    <div>
                      <div className="font-bold">Privacy Mode</div>
                      <div className="text-xs text-gray-400">Hide profile from search</div>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const newPrefs = { ...profile.preferences, privacyMode: !profile.preferences?.privacyMode };
                      const updated = { ...profile, preferences: newPrefs };
                      await setDoc(doc(db, 'users', profile.uid), updated, { merge: true });
                      onUpdate(updated);
                    }}
                    className={`w-14 h-8 rounded-full p-1 transition-all ${profile.preferences?.privacyMode ? 'bg-pink-600' : 'bg-gray-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${profile.preferences?.privacyMode ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <Button className="w-full mt-12 py-4" onClick={() => setShowSettings(false)}>Done</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white">
          <Logo size={60} className="mb-6" />
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-8">We encountered an error. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh App</Button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-gray-100 rounded-lg text-left text-xs overflow-auto max-w-full">
              {JSON.stringify(this.state.error, null, 2)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'intro' | 'auth' | 'onboarding' | 'main'>('intro');
  const [activeTab, setActiveTab] = useState<'discovery' | 'chats' | 'profile'>('discovery');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileSnap = await getDoc(doc(db, 'users', u.uid));
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserType);
          setScreen('main');
        } else {
          setScreen('onboarding');
        }
      } else {
        setScreen('intro');
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingCount(snapshot.size);
      });
      return unsubscribe;
    }
  }, [user]);

  // Bot Generation Logic (Simulated for prototype)
  useEffect(() => {
    const checkBots = async () => {
      const q = query(collection(db, 'users'), where('isBot', '==', true), limit(1));
      try {
        const snap = await getDocs(q);
        if (snap.empty) {
          console.log("Generating initial bots...");
          const bots = await generateBotProfiles(10); // Start with 10 for performance
          for (const bot of bots) {
            const botUid = `bot_${Math.random().toString(36).substr(2, 9)}`;
            await setDoc(doc(db, 'users', botUid), {
              uid: botUid,
              username: bot.username,
              searchUsername: bot.username.toLowerCase(),
              bio: bot.bio,
              interests: bot.interests,
              photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botUid}`,
              isBot: true,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    };
    if (screen === 'main') checkBots();
  }, [screen]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <Logo size={60} className="animate-pulse" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 shadow-2xl relative overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {screen === 'intro' && <IntroScreen onNext={() => setScreen('auth')} />}
        {screen === 'auth' && <AuthScreen onAuthSuccess={() => {}} />}
        {screen === 'onboarding' && <OnboardingScreen user={user} onComplete={() => setScreen('main')} />}
        
        {screen === 'main' && profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex flex-col h-screen ${profile.theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex-1 overflow-hidden">
              {activeChatId ? (
                <ChatScreen currentUser={profile} chatId={activeChatId} onBack={() => setActiveChatId(null)} theme={profile.theme || 'light'} />
              ) : (
                <>
                  {activeTab === 'discovery' && <DiscoveryScreen currentUser={profile} theme={profile.theme || 'light'} pendingCount={pendingCount} />}
                  {activeTab === 'chats' && (
                    <ChatList currentUser={profile} onSelectChat={setActiveChatId} theme={profile.theme || 'light'} />
                  )}
                  {activeTab === 'profile' && (
                    <ProfileScreen 
                      profile={profile} 
                      onUpdate={setProfile} 
                      theme={profile.theme || 'light'} 
                      onToggleTheme={async () => {
                        const newTheme = profile.theme === 'dark' ? 'light' : 'dark';
                        const updated = { ...profile, theme: newTheme };
                        await setDoc(doc(db, 'users', profile.uid), updated, { merge: true });
                        setProfile(updated);
                      }} 
                    />
                  )}
                </>
              )}
            </div>

            {!activeChatId && (
              <div className={`h-20 border-t flex items-center justify-around px-6 transition-colors ${profile.theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
                <button onClick={() => setActiveTab('discovery')} className={`p-2 transition-all ${activeTab === 'discovery' ? 'text-pink-600 scale-110' : 'text-gray-300'}`}>
                  <Search size={28} />
                </button>
                <button onClick={() => setActiveTab('chats')} className={`p-2 transition-all relative ${activeTab === 'chats' ? 'text-pink-600 scale-110' : 'text-gray-300'}`}>
                  <MessageCircle size={28} />
                  {pendingCount > 0 && (
                    <span className="absolute top-0 right-0 bg-pink-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button onClick={() => setActiveTab('profile')} className={`p-2 transition-all ${activeTab === 'profile' ? 'text-pink-600 scale-110' : 'text-gray-300'}`}>
                  <User size={28} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
