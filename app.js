import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, collection, onSnapshot, query, where, orderBy, limit,
    runTransaction, addDoc, serverTimestamp, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBbwUAVZElx9y7nItyFr791jio-7zd7ask",
  authDomain: "night-hawk-72ae4.firebaseapp.com",
  projectId: "night-hawk-72ae4",
  storageBucket: "night-hawk-72ae4.firebasestorage.app",
  messagingSenderId: "1097199176415",
  appId: "1:1097199176415:web:aba1ebcfbd08baffa2376a",
  measurementId: "G-GD5ZM8QWT1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. GLOBAL STATE, NOTIFICATIONS & UTILS
// ==========================================
let currentUser = null;
let userData = null;
let isAdmin = false;
let isStaff = false;
let unsubUser, unsubMatches, unsubTxs, unsubSettings, unsubGlobalNotifs, unsubUserNotifs = null;
let globalNotifs = [];
let userNotifs = [];

// Audio Object for Notifications
const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');

window.openCreateMatchModal = () => {
    document.getElementById('manage-match-form').reset();
    document.getElementById('match-id').value = '';
    document.getElementById('match-modal-title').innerHTML = '<i class="fa-solid fa-plus-square"></i> Deploy Mission';
    window.openModal('create-match-modal');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    if(id === 'create-match-modal') {
        document.getElementById('manage-match-form').reset();
        document.getElementById('match-id').value = '';
    }
};

window.copyToClipboard = (elementId) => {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'info'));
};

const showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'border-emerald-500 text-emerald-400' 
                     : type === 'error' ? 'border-red-500 text-red-400' 
                     : 'border-cyan-500 text-cyan-400';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-xmark' : 'fa-info-circle';
    
    toast.className = `toast pop-in rounded-xl px-4 py-3 flex items-center gap-3 w-full max-w-sm border-l-4 ${colorClass} shadow-lg`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-lg drop-shadow-md"></i><span class="font-bold text-sm text-white tracking-wide">${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

// ==========================================
// 3. UI NAVIGATION LOGIC
// ==========================================
const dom = {
    auth: document.getElementById('auth-view'),
    main: document.getElementById('main-layout'),
    userNav: document.getElementById('user-nav'),
    adminNav: document.getElementById('admin-nav'),
    staffNav: document.getElementById('staff-nav'),
    balance: document.getElementById('header-balance')
};

const switchRoleView = () => {
    [dom.userNav, dom.adminNav, dom.staffNav].forEach(nav => nav.classList.add('hidden'));

    if (isAdmin) {
        dom.adminNav.classList.remove('hidden');
        activateNavTab('view-manage-dash', dom.adminNav);
        document.getElementById('admin-revenue-card').classList.remove('hidden');
        document.getElementById('admin-settings-card').classList.remove('hidden');
        document.getElementById('admin-notify-btn').classList.remove('hidden');
    } else if (isStaff) {
        dom.staffNav.classList.remove('hidden');
        activateNavTab('view-manage-dash', dom.staffNav);
        document.getElementById('admin-revenue-card').classList.add('hidden');
        document.getElementById('admin-settings-card').classList.add('hidden');
        document.getElementById('admin-notify-btn').classList.add('hidden');
    } else {
        dom.userNav.classList.remove('hidden');
        activateNavTab('view-user-matches', dom.userNav);
    }
};

const activateNavTab = (targetId, navContainer) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    navContainer.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetId);
    });
};

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetNav = isAdmin ? dom.adminNav : isStaff ? dom.staffNav : dom.userNav;
        activateNavTab(e.currentTarget.dataset.target, targetNav);
    });
});

// ==========================================
// 4. AUTHENTICATION & NOTIFICATIONS LOGIC
// ==========================================
let isLoginMode = true;
let isInitialGlobalLoad = true;
let isInitialUserLoad = true;

document.getElementById('toggle-auth').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Initialize Link' : 'Enlist Now';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Engage' : 'Create Profile';
    document.getElementById('register-fields').classList.toggle('hidden', isLoginMode);
    document.getElementById('toggle-auth').innerHTML = isLoginMode 
        ? `New recruit? <span class="text-orange-500 font-bold">Sign Up</span>`
        : `Return to base? <span class="text-orange-500 font-bold">Login</span>`;
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const ign = document.getElementById('auth-ign').value;
    const btn = document.getElementById('auth-btn');
    
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            if(!ign) throw new Error("IGN is required to build your profile.");
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, 'users', cred.user.uid), {
                email, ign, balance: 0, role: 'user', 
                createdAt: serverTimestamp(), uid: cred.user.uid,
                lastReadTimestamp: serverTimestamp() // Notification tracking
            });
        }
    } catch (error) {
        showToast(error.message.replace('Firebase:', ''), 'error');
        btn.disabled = false; btn.innerText = isLoginMode ? 'Engage' : 'Create Profile';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        dom.auth.classList.add('hidden');
        dom.main.classList.remove('hidden');
        
        // Reset flags for new session
        isInitialGlobalLoad = true;
        isInitialUserLoad = true;

        unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                userData = snap.data();
                isAdmin = userData.role === 'admin';
                isStaff = userData.role === 'staff';
                
                dom.balance.innerText = `₹${userData.balance.toFixed(2)}`;
                if(!isAdmin && !isStaff) updateProfileUI();
                
                updateNotifUI(); // Update UI in case read timestamp changed

                if(!window.isLoaded) {
                    window.isLoaded = true;
                    switchRoleView();
                    if(isAdmin || isStaff) loadManagementData();
                    else loadUserData();
                }
            }
        });

        // NOTIFICATIONS LISTENER (GLOBAL)
        unsubGlobalNotifs = onSnapshot(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(20)), (snap) => {
            globalNotifs = snap.docs.map(d => ({id: d.id, ...d.data()}));
            updateNotifUI();

            if(!isInitialGlobalLoad) {
                snap.docChanges().forEach(change => {
                    if(change.type === 'added') triggerSystemNotification(change.doc.data());
                });
            }
            isInitialGlobalLoad = false;
        });

        // NOTIFICATIONS LISTENER (USER SPECIFIC)
        unsubUserNotifs = onSnapshot(query(collection(db, `users/${user.uid}/notifications`), orderBy('timestamp', 'desc'), limit(20)), (snap) => {
            userNotifs = snap.docs.map(d => ({id: d.id, ...d.data()}));
            updateNotifUI();

            if(!isInitialUserLoad) {
                snap.docChanges().forEach(change => {
                    if(change.type === 'added') triggerSystemNotification(change.doc.data());
                });
            }
            isInitialUserLoad = false;
        });

        // PLATFORM SETTINGS
        unsubSettings = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
            if(snap.exists()) {
                const data = snap.data();
                const qrImg = document.getElementById('deposit-qr-display');
                if (data.depositQRUrl) { qrImg.src = data.depositQRUrl; qrImg.classList.remove('hidden'); } 
                else { qrImg.src = ''; qrImg.classList.add('hidden'); }
                
                document.getElementById('deposit-upi-display').innerText = data.depositUPI || 'Not Set';
                
                if (document.getElementById('admin-set-upi')) {
                    document.getElementById('admin-set-upi').value = data.depositUPI || '';
                    document.getElementById('admin-set-qr').value = data.depositQRUrl || '';
                }
            }
        });

    } else {
        currentUser = userData = null; isAdmin = isStaff = false; window.isLoaded = false;
        if(unsubUser) unsubUser(); if(unsubMatches) unsubMatches(); if(unsubTxs) unsubTxs(); if(unsubSettings) unsubSettings();
        if(unsubGlobalNotifs) unsubGlobalNotifs(); if(unsubUserNotifs) unsubUserNotifs();
        dom.auth.classList.remove('hidden'); dom.main.classList.add('hidden');
        document.getElementById('auth-btn').disabled = false;
        document.getElementById('auth-btn').innerText = isLoginMode ? 'Engage' : 'Create Profile';
    }
});

const triggerSystemNotification = (data) => {
    // 1. Play Sound (If user interacted with page, browser allows this)
    notifSound.play().catch(e => console.log('Audio blocked by browser.', e));
    
    // 2. OS Level Push Notification (If Tab is active/backgrounded)
    if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification("NIGHT HAWK ESPORTS", {
            body: data.title + "\n" + data.message,
            icon: "https://api.dicebear.com/7.x/bottts/svg?seed=hawk&backgroundColor=black"
        });
        notif.onclick = () => {
            window.focus();
            window.openNotifModal();
        };
    }
};

window.requestOSNotification = async () => {
    if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            showToast('System OS Notifications enabled.', 'success');
            document.getElementById('enable-os-notif-btn').classList.add('hidden');
        } else {
            showToast('Permission denied. Check browser settings.', 'error');
        }
    } else {
        showToast('Your browser does not support notifications.', 'error');
    }
};

const updateNotifUI = () => {
    if(!userData) return;
    const allNotifs = [...globalNotifs, ...userNotifs].sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
    const lastRead = userData.lastReadTimestamp?.toMillis() || 0;
    const unreadCount = allNotifs.filter(n => (n.timestamp?.toMillis() || 0) > lastRead).length;

    const badge = document.getElementById('notif-badge');
    if(unreadCount > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');

    // Check OS Notification Permission and show/hide the enable button
    if ('Notification' in window && Notification.permission !== 'granted') {
        document.getElementById('enable-os-notif-btn').classList.remove('hidden');
    } else {
        document.getElementById('enable-os-notif-btn').classList.add('hidden');
    }

    const list = document.getElementById('notif-list');
    list.innerHTML = '';
    
    if(allNotifs.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-500 py-10 text-sm border border-dashed border-gray-700/50 rounded-2xl"><i class="fa-solid fa-wind opacity-50 block text-2xl mb-2"></i> No intel detected.</div>';
        return;
    }

    allNotifs.forEach(n => {
        const isUnread = (n.timestamp?.toMillis() || 0) > lastRead;
        const formattedDate = n.timestamp ? new Date(n.timestamp.toDate()).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Just now';
        
        list.innerHTML += `
            <div class="p-3 border border-white/5 rounded-xl ${isUnread ? 'bg-blue-500/10 border-blue-500/30 shadow-inner' : 'bg-black/30 opacity-75 hover:opacity-100'} transition">
                <div class="flex justify-between items-start mb-1">
                    <p class="text-sm font-bold ${isUnread ? 'text-blue-400' : 'text-gray-300'}">${n.title}</p>
                    ${isUnread ? `<span class="w-2 h-2 rounded-full bg-blue-500 mt-1"></span>` : ''}
                </div>
                <p class="text-xs ${isUnread ? 'text-gray-300' : 'text-gray-500'}">${n.message}</p>
                <p class="text-[9px] text-gray-500 mt-2 font-mono"><i class="fa-regular fa-clock mr-1"></i>${formattedDate}</p>
            </div>
        `;
    });
};

window.openNotifModal = async () => {
    openModal('notif-modal');
    if(currentUser && userData) {
        // Mark as read by updating timestamp
        await updateDoc(doc(db, 'users', currentUser.uid), { lastReadTimestamp: serverTimestamp() });
    }
};

window.savePlatformSettings = async () => {
    if (!isAdmin) return;
    try {
        await setDoc(doc(db, 'settings', 'platform'), {
            depositUPI: document.getElementById('admin-set-upi').value,
            depositQRUrl: document.getElementById('admin-set-qr').value
        }, { merge: true });
        showToast('Platform payment configurations updated.', 'success');
    } catch(err) { showToast(err.message || 'Operation failed.', 'error'); }
};

// ==========================================
// 5. USER LOGIC
// ==========================================
let currentFilter = 'Upcoming';
document.querySelectorAll('.match-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.match-filter').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
            b.classList.add('text-gray-400');
        });
        e.target.classList.add('bg-orange-500', 'text-white', 'shadow-md');
        e.target.classList.remove('text-gray-400');
        currentFilter = e.target.dataset.filter;
        renderUserMatches();
    });
});

let allMatches = [];
const loadUserData = () => {
    unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('time', 'asc')), (snap) => {
        allMatches = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderUserMatches();
        updateProfileStats();
    });

    unsubTxs = onSnapshot(query(collection(db, 'transactions'), where('uid', '==', currentUser.uid), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
        const txList = document.getElementById('user-tx-list');
        txList.innerHTML = '';
        let totalWinnings = 0;

        if(snap.empty) { 
            txList.innerHTML = `<div class="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-2xl"><i class="fa-solid fa-wind text-3xl mb-2 opacity-50 block"></i>No log entries.</div>`; 
            return; 
        }
        
        snap.forEach(d => {
            const tx = d.data();
            if(tx.type === 'winning' && tx.status === 'completed') totalWinnings += tx.amount;

            const isPos = tx.type === 'deposit' || tx.type === 'winning';
            const color = tx.status === 'pending' ? 'text-yellow-400' : tx.status === 'rejected' ? 'text-red-400' : (isPos ? 'text-emerald-400' : 'text-gray-300');
            const sign = isPos ? '+' : '-';
            const icon = tx.type === 'deposit' ? 'fa-arrow-down' : tx.type === 'withdrawal' ? 'fa-arrow-up' : tx.type === 'winning' ? 'fa-trophy' : 'fa-ticket';
            
            txList.innerHTML += `
                <div class="glass-panel p-4 rounded-xl border border-white/5 flex justify-between items-center relative overflow-hidden group">
                    <div class="absolute left-0 top-0 h-full w-1 ${tx.status === 'pending' ? 'bg-yellow-500' : tx.status === 'rejected' ? 'bg-red-500' : 'bg-emerald-500'}"></div>
                    <div class="flex items-center gap-4 pl-2">
                        <div class="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/5 text-gray-400 group-hover:text-white transition">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-white capitalize tracking-wide">${tx.type.replace('_', ' ')} 
                                <span class="text-[9px] uppercase bg-black px-1.5 py-0.5 rounded ml-2 border border-white/10 ${color}">${tx.status}</span>
                            </p>
                            <p class="text-xs text-gray-500 font-mono mt-0.5">${tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleString() : 'Processing...'}</p>
                            ${tx.redeemCode && tx.status === 'completed' ? `<p class="text-xs text-cyan-400 mt-2 select-all font-mono bg-cyan-900/20 px-2 py-1 rounded inline-block border border-cyan-500/30">Code: ${tx.redeemCode}</p>` : ''}
                        </div>
                    </div>
                    <div class="font-gaming font-black text-lg ${color}">${sign}₹${tx.amount}</div>
                </div>
            `;
        });
        document.getElementById('profile-winnings').innerText = `₹${totalWinnings}`;
    });
};

const renderUserMatches = () => {
    const list = document.getElementById('user-matches-list');
    list.innerHTML = '';
    const filtered = allMatches.filter(m => m.status === currentFilter);
    
    if(filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-3xl"><i class="fa-solid fa-satellite text-4xl mb-3 block opacity-30"></i>No intel on ${currentFilter} operations.</div>`;
        return;
    }

    filtered.forEach(m => {
        const isJoined = m.participants && m.participants.includes(currentUser.uid);
        const isFull = m.filledSlots >= m.totalSlots;
        
        // Formatted Safe Date
        const dt = new Intl.DateTimeFormat('en-IN', {
            month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
        }).format(new Date(m.time));
        
        let actionBtn = '';
        if(m.status === 'Upcoming') {
            if(isJoined) actionBtn = `<button class="w-full bg-gray-700/50 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed uppercase tracking-widest text-sm border border-gray-600/50 flex items-center justify-center gap-2" disabled><i class="fa-solid fa-check-circle"></i> Deployed</button>`;
            else if(isFull) actionBtn = `<button class="w-full bg-red-900/30 text-red-500 font-bold py-3 rounded-xl cursor-not-allowed uppercase tracking-widest text-sm border border-red-900/50" disabled>Squad Full</button>`;
            else actionBtn = `<button onclick="window.joinMatch('${m.id}', ${m.entryFee})" class="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-gaming font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.3)] transition uppercase tracking-widest text-sm">Join Operation - ₹${m.entryFee}</button>`;
        } else if (isJoined) {
            actionBtn = `<button onclick="window.showRoomDetails('${m.roomId}', '${m.roomPass}')" class="w-full bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 font-gaming font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] transition uppercase tracking-widest text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-unlock-keyhole"></i> Access Codes</button>`;
        }

        list.innerHTML += `
            <div class="match-card border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden ${m.status.toLowerCase()}">
                <div class="absolute top-0 right-0 bg-gradient-to-l from-white/10 px-4 py-1.5 rounded-bl-xl text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-l border-white/5 backdrop-blur-sm shadow-sm flex items-center z-10">
                    <span class="status-indicator"></span> ${m.status}
                </div>
                
                <div class="flex justify-between items-start mb-4 relative z-10 pt-2">
                    <div>
                        <span class="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded shadow-inner">${m.type} • ${m.map}</span>
                        <h3 class="text-xl font-gaming font-bold text-white mt-2 leading-tight">${m.title}</h3>
                        <p class="text-xs text-gray-400 mt-1 font-mono"><i class="fa-regular fa-clock text-orange-500 mr-1"></i>${dt}</p>
                    </div>
                    <div class="text-right pl-4">
                        <p class="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Prize Pool</p>
                        <p class="text-2xl font-gaming font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] mt-0.5">₹${m.prizePool}</p>
                    </div>
                </div>
                
                <div class="bg-black/40 rounded-xl p-3 mb-4 border border-white/5 flex justify-between items-center relative z-10">
                    <div class="flex items-center gap-3 border-r border-white/10 pr-4">
                        <i class="fa-solid fa-coins text-gray-500"></i>
                        <div>
                            <p class="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Entry</p>
                            <p class="font-bold text-sm text-white">₹${m.entryFee}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 pl-2">
                        <div class="text-right">
                            <p class="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Slots</p>
                            <p class="font-bold text-sm ${isFull ? 'text-red-400' : 'text-blue-400'}">${m.filledSlots}/${m.totalSlots}</p>
                        </div>
                        <i class="fa-solid fa-users text-gray-500"></i>
                    </div>
                    <div class="absolute bottom-0 left-0 h-[2px] bg-blue-500/50 rounded-b-xl transition-all" style="width: ${(m.filledSlots/m.totalSlots)*100}%"></div>
                </div>
                
                <div class="relative z-10">${actionBtn}</div>
            </div>
        `;
    });
};

window.joinMatch = async (matchId, fee) => {
    if(userData.balance < fee) {
        showToast('Insufficient funds. Top up required.', 'error');
        activateNavTab('view-user-wallet', dom.userNav);
        return;
    }
    if(!confirm(`Confirm deployment cost: ₹${fee}?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const matchRef = doc(db, 'matches', matchId);
            const userRef = doc(db, 'users', currentUser.uid);
            
            const [matchDoc, userDoc] = await Promise.all([t.get(matchRef), t.get(userRef)]);
            if (!matchDoc.exists() || !userDoc.exists()) throw "Database anomaly detected.";
            
            const matchData = matchDoc.data();
            const uData = userDoc.data();
            
            if(matchData.filledSlots >= matchData.totalSlots) throw "Squad capacity reached.";
            if(matchData.participants && matchData.participants.includes(currentUser.uid)) throw "Already enlisted.";
            if(uData.balance < fee) throw "Insufficient funds.";

            t.update(userRef, { balance: uData.balance - fee });
            t.update(matchRef, { 
                filledSlots: matchData.filledSlots + 1,
                participants: [...(matchData.participants || []), currentUser.uid],
                participantDetails: [...(matchData.participantDetails || []), { uid: currentUser.uid, ign: uData.ign }]
            });
            
            t.set(doc(collection(db, 'transactions')), {
                uid: currentUser.uid, type: 'match_entry', amount: fee,
                matchId: matchId, status: 'completed', timestamp: serverTimestamp()
            });
        });
        showToast('Deployment successful!', 'success');
    } catch(err) { showToast(err, 'error'); }
};

window.showRoomDetails = (id, pass) => {
    document.getElementById('r-id-display').innerText = id || 'PENDING';
    document.getElementById('r-pass-display').innerText = pass || 'PENDING';
    openModal('room-modal');
};

const updateProfileUI = () => {
    document.getElementById('wallet-balance-display').innerText = `₹${userData.balance.toFixed(2)}`;
    document.getElementById('profile-ign').innerText = userData.ign;
    document.getElementById('profile-uid').innerText = `UID: ${userData.uid}`;
};

const updateProfileStats = () => {
    if(isAdmin || isStaff) return;
    const joined = allMatches.filter(m => m.participants && m.participants.includes(currentUser.uid)).length;
    document.getElementById('profile-matches-count').innerText = joined;
};

// Wallet Forms
document.getElementById('deposit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('dep-amount').value);
    const method = document.getElementById('dep-method').value;
    const utr = document.getElementById('dep-utr').value;
    if(amount < 10) return showToast('Minimum deposit is ₹10', 'error');

    try {
        await addDoc(collection(db, 'transactions'), {
            uid: currentUser.uid, ign: userData.ign, type: 'deposit', amount, method, utr,
            status: 'pending', timestamp: serverTimestamp()
        });
        showToast('Transfer submitted. Awaiting clearance.', 'success');
        closeModal('deposit-modal');
        e.target.reset();
    } catch(e) { showToast('Transmission failed.', 'error'); }
});

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('with-amount').value);
    const method = document.getElementById('with-method').value;
    const dest = document.getElementById('with-dest').value;

    if(amount < 15) return showToast('Minimum withdrawal is ₹15', 'error');
    if(userData.balance < amount) return showToast('Insufficient funds.', 'error');

    try {
        await runTransaction(db, async (t) => {
            const userRef = doc(db, 'users', currentUser.uid);
            const userDoc = await t.get(userRef);
            if(userDoc.data().balance < amount) throw "Insufficient funds.";
            
            t.update(userRef, { balance: userDoc.data().balance - amount });
            t.set(doc(collection(db, 'transactions')), {
                uid: currentUser.uid, ign: userData.ign, type: 'withdrawal', amount, method, destination: dest,
                status: 'pending', timestamp: serverTimestamp()
            });
        });
        showToast('Extraction request logged.', 'success');
        closeModal('withdraw-modal');
        e.target.reset();
    } catch(e) { showToast(e, 'error'); }
});

// ==========================================
// 6. ADMIN & STAFF LOGIC
// ==========================================
const loadManagementData = () => {
    onSnapshot(collection(db, 'matches'), (snap) => {
        allMatches = snap.docs.map(d => ({id: d.id, ...d.data()}));
        document.getElementById('stat-matches').innerText = allMatches.filter(m => m.status !== 'Completed').length;
        renderManageMatches();
    });

    onSnapshot(collection(db, 'users'), (snap) => {
        document.getElementById('stat-users').innerText = snap.size;
        
        // Populate the Admin Broadcast dropdown with User IGNs
        if (isAdmin) {
            const notifSelect = document.getElementById('notif-target-uid');
            if (notifSelect) {
                notifSelect.innerHTML = '<option value="ALL">-- ALL OPERATIVES (GLOBAL) --</option>';
                const usersList = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.ign || '').localeCompare(b.ign || ''));
                
                usersList.forEach(u => {
                    notifSelect.innerHTML += `<option value="${u.uid}">${u.ign} (UID: ${u.uid.substring(0,5)}...)</option>`;
                });
            }
        }
    }, () => document.getElementById('stat-users').innerText = 'N/A');

    if (isAdmin) {
        onSnapshot(query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
            let rev = 0;
            const list = document.getElementById('admin-finance-list');
            list.innerHTML = '';
            
            snap.docs.forEach(d => {
                const tx = {id: d.id, ...d.data()};
                if(tx.type === 'deposit' && tx.status === 'completed') rev += tx.amount;
                
                if(tx.status === 'pending') {
                    const isDep = tx.type === 'deposit';
                    list.innerHTML += `
                        <div class="glass-panel p-5 rounded-2xl border border-white/10 mb-4 relative overflow-hidden group">
                            <div class="absolute left-0 top-0 w-1 h-full ${isDep ? 'bg-emerald-500' : 'bg-orange-500'}"></div>
                            <div class="flex justify-between items-start mb-3 pl-2">
                                <div>
                                    <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black border ${isDep ? 'text-emerald-400 border-emerald-500/30' : 'text-orange-400 border-orange-500/30'}">${tx.type}</span>
                                    <p class="font-bold text-white mt-2">${tx.ign || 'Unknown Operative'}</p>
                                    <p class="text-[10px] text-gray-500 font-mono">UID: ${tx.uid}</p>
                                </div>
                                <p class="text-2xl font-gaming font-black text-white drop-shadow-md">₹${tx.amount}</p>
                            </div>
                            <div class="bg-black/40 p-3 rounded-lg text-xs text-gray-300 mb-4 font-mono border border-white/5 pl-2 ml-2">
                                ${isDep ? `<span class="text-gray-500">Method:</span> ${tx.method} <br> <span class="text-gray-500">UTR:</span> <span class="text-white">${tx.utr}</span>` 
                                        : `<span class="text-gray-500">Method:</span> ${tx.method} <br> <span class="text-gray-500">Dest:</span> <span class="text-white">${tx.destination}</span>`}
                            </div>
                            <div class="flex gap-3 pl-2">
                                <button onclick="window.adminProcessTx('${tx.id}', '${tx.uid}', '${tx.type}', ${tx.amount}, true, '${tx.method}')" class="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/50 font-bold py-2 rounded-xl transition uppercase text-xs tracking-wider">Approve</button>
                                <button onclick="window.adminProcessTx('${tx.id}', '${tx.uid}', '${tx.type}', ${tx.amount}, false)" class="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 font-bold py-2 rounded-xl transition uppercase text-xs tracking-wider">Reject</button>
                            </div>
                        </div>
                    `;
                }
            });
            if(list.innerHTML === '') list.innerHTML = '<p class="text-center text-gray-500 py-8 border border-dashed border-gray-700 rounded-3xl">No pending requests in queue.</p>';
            document.getElementById('stat-revenue').innerText = `₹${rev.toFixed(2)}`;
        });
    }
};

const renderManageMatches = () => {
    const list = document.getElementById('manage-matches-list');
    list.innerHTML = '';
    
    allMatches.sort((a,b) => new Date(b.time) - new Date(a.time)).forEach(m => {
        let rosterHtml = '';
        if (m.participantDetails && m.participantDetails.length > 0) {
            rosterHtml = m.participantDetails.map((p, i) => `
                <div class="py-1.5 px-2 border-b border-white/5 last:border-0 flex justify-between items-center hover:bg-white/5 rounded transition">
                    <span class="text-white font-bold">${i+1}. ${p.ign}</span>
                    <span class="text-[9px] text-gray-500 bg-black px-1.5 py-0.5 rounded border border-white/10">UID: ${p.uid?.substring(0,5) || 'N/A'}</span>
                </div>`).join('');
        } else if (m.participants && m.participants.length > 0) {
            rosterHtml = m.participants.map((uid, i) => `
                <div class="py-1.5 px-2 border-b border-white/5 last:border-0 text-gray-400">
                    ${i+1}. UID: ${uid?.substring(0,8) || 'Unknown'}... (Legacy)
                </div>`).join('');
        } else {
            rosterHtml = '<div class="text-gray-500 text-center py-3 text-[10px] uppercase tracking-widest"><i class="fa-solid fa-ghost text-lg block mb-1 opacity-50"></i> No operatives deployed</div>';
        }

        const dt = new Intl.DateTimeFormat('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(m.time));

        list.innerHTML += `
            <div class="glass-panel border border-white/10 rounded-2xl p-5 shadow-lg mb-4 hover:border-white/20 transition group relative overflow-hidden">
                <div class="absolute top-0 right-0 h-full w-1 ${m.status==='Live'?'bg-emerald-500':m.status==='Completed'?'bg-gray-500':'bg-orange-500'}"></div>
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-gaming font-bold text-white text-lg">${m.title}</h3>
                        <p class="text-[10px] text-gray-400 font-mono mt-1"><i class="fa-solid fa-calendar-day text-blue-400 mr-1"></i>${dt}</p>
                    </div>
                    <span class="text-[9px] px-2 py-1 rounded bg-black uppercase font-bold tracking-widest border border-white/10 ${m.status==='Live'?'text-emerald-400':m.status==='Completed'?'text-gray-400':'text-orange-400'}">${m.status}</span>
                </div>
                
                <div class="flex gap-4 mb-4 bg-black/30 p-2 rounded-lg border border-white/5">
                    <div class="text-center flex-1 border-r border-white/10">
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Prize</p>
                        <p class="text-sm font-bold text-white">₹${m.prizePool}</p>
                    </div>
                    <div class="text-center flex-1">
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Filled</p>
                        <p class="text-sm font-bold text-blue-400">${m.filledSlots}/${m.totalSlots}</p>
                    </div>
                </div>

                <div class="mt-2 mb-4 border border-white/5 rounded-xl bg-black/30 overflow-hidden">
                    <details class="group/roster">
                        <summary class="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer flex justify-between items-center p-3 outline-none hover:bg-white/5 transition">
                            <span class="flex items-center gap-2"><i class="fa-solid fa-clipboard-user text-cyan-400 text-sm"></i> Operative Roster (${m.filledSlots})</span>
                            <i class="fa-solid fa-chevron-down transition group-open/roster:rotate-180"></i>
                        </summary>
                        <div class="max-h-40 overflow-y-auto custom-scrollbar bg-black/60 p-2 border-t border-white/5 text-xs font-mono">
                            ${rosterHtml}
                        </div>
                    </details>
                </div>

                <div class="flex gap-3">
                    <button onclick='window.editMatch(${JSON.stringify(m).replace(/'/g, "\\'")})' class="flex-1 glass-panel hover:bg-white/10 text-white text-xs font-bold py-2.5 rounded-xl border border-white/10 transition uppercase tracking-wider"><i class="fa-solid fa-pen-to-square mr-1"></i> Config</button>
                    <button onclick="window.deleteMatch('${m.id}')" class="flex-none w-12 glass-panel hover:bg-red-500/20 text-red-400 border border-white/10 hover:border-red-500/30 transition rounded-xl flex justify-center items-center"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    });
};

document.getElementById('manage-match-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('match-id').value;
    const data = {
        title: document.getElementById('m-title').value,
        map: document.getElementById('m-map').value,
        type: document.getElementById('m-type').value,
        entryFee: Number(document.getElementById('m-fee').value),
        prizePool: Number(document.getElementById('m-prize').value),
        totalSlots: Number(document.getElementById('m-slots').value),
        status: document.getElementById('m-status').value,
        time: document.getElementById('m-time').value,
        roomId: document.getElementById('m-roomid').value || '',
        roomPass: document.getElementById('m-roompass').value || '',
        createdBy: currentUser.uid 
    };

    try {
        if(id) {
            await updateDoc(doc(db, 'matches', id), data);
            showToast('Mission parameters updated.', 'success');
        } else {
            data.filledSlots = 0;
            data.participants = [];
            data.participantDetails = []; 
            await addDoc(collection(db, 'matches'), data);
            
            await addDoc(collection(db, 'notifications'), {
                title: 'New Mission Deployed!',
                message: `${data.title} (${data.type}) is now available for deployment.`,
                timestamp: serverTimestamp()
            });

            showToast('New mission deployed & Operatives Notified.', 'success');
        }
        closeModal('create-match-modal');
    } catch(err) { showToast(err.message || err, 'error'); }
});

window.editMatch = (m) => {
    document.getElementById('match-id').value = m.id;
    document.getElementById('m-title').value = m.title;
    document.getElementById('m-map').value = m.map;
    document.getElementById('m-type').value = m.type;
    document.getElementById('m-fee').value = m.entryFee;
    document.getElementById('m-prize').value = m.prizePool;
    document.getElementById('m-slots').value = m.totalSlots;
    document.getElementById('m-status').value = m.status;
    document.getElementById('m-time').value = m.time;
    document.getElementById('m-roomid').value = m.roomId || '';
    document.getElementById('m-roompass').value = m.roomPass || '';
    document.getElementById('match-modal-title').innerHTML = '<i class="fa-solid fa-wrench"></i> Modify Mission';
    openModal('create-match-modal');
};

window.deleteMatch = async (id) => {
    if(confirm("AUTHORIZATION REQUIRED: Permanently erase this mission?")) {
        await deleteDoc(doc(db, 'matches', id));
        showToast('Mission wiped from logs.', 'success');
    }
};

window.adminProcessTx = async (txId, uid, type, amount, isApprove, method) => {
    if (!isAdmin) return;
    try {
        let redeemCode = null;
        if(isApprove && type === 'withdrawal' && method === 'PlayCode') {
            redeemCode = prompt("Enter the Google Play Redeem Code to dispatch:");
            if(!redeemCode) return showToast("Code required for PlayCode execution.", "error");
        }

        await runTransaction(db, async (t) => {
            const userRef = doc(db, 'users', uid);
            const txRef = doc(db, 'transactions', txId);
            
            const uDoc = await t.get(userRef);
            if(!uDoc.exists()) throw "Operative profile missing.";
            
            let newBalance = uDoc.data().balance;
            if(type === 'deposit' && isApprove) newBalance += amount;
            if(type === 'withdrawal' && !isApprove) newBalance += amount; 

            t.update(userRef, { balance: newBalance });
            t.update(txRef, { status: isApprove ? 'completed' : 'rejected', ...(redeemCode && { redeemCode }) });
        });
        
        await addDoc(collection(db, `users/${uid}/notifications`), {
            title: `Request ${isApprove ? 'Authorized' : 'Denied'}`,
            message: `Your ${type} request for ₹${amount} was ${isApprove ? 'approved' : 'rejected'}.`,
            timestamp: serverTimestamp()
        });

        showToast(`Transaction ${isApprove ? 'Authorized' : 'Denied'}`, 'success');
    } catch (e) { showToast(e, 'error'); }
};

document.getElementById('admin-notif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!isAdmin) return;

    const targetUid = document.getElementById('notif-target-uid').value.trim();
    const title = document.getElementById('notif-title').value.trim();
    const message = document.getElementById('notif-message').value.trim();
    const btn = e.target.querySelector('button');

    btn.disabled = true;
    btn.innerHTML = 'Sending...';

    try {
        if(targetUid === 'ALL' || targetUid === '') {
            await addDoc(collection(db, 'notifications'), { title, message, timestamp: serverTimestamp() });
            showToast('Global Broadcast Sent.', 'success');
        } else {
            await addDoc(collection(db, `users/${targetUid}/notifications`), { title, message, timestamp: serverTimestamp() });
            showToast('Transmission Sent to Operative.', 'success');
        }
        closeModal('admin-notif-modal');
        e.target.reset();
    } catch(err) { 
        showToast(err.message, 'error'); 
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send Transmission';
    }
});