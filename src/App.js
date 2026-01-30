import { useState, useEffect } from 'react';
import { db, auth } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, query, where, setDoc, getDoc, arrayUnion } from 'firebase/firestore'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import './index.css';

function App() {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [userMode, setUserMode] = useState("student"); 
  
  const [canteens, setCanteens] = useState([]); 
  const [selectedCanteen, setSelectedCanteen] = useState(null); 
  
  const [cart, setCart] = useState([]); 
  const [orders, setOrders] = useState([]); 
  const [currentView, setCurrentView] = useState("home"); 

  const [isRegistering, setIsRegistering] = useState(false); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemImage, setNewItemImage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const DEFAULT_IMG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60";
  const CANTEEN_IMG = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=80"; // High res for cover

  // --- AUTH ---
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        if (u.email === "admin@canteen.com") {
          setUserMode("shopkeeper");
        } else {
          setUserMode("student");
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) setUserData(userDoc.data());
        }
      } else {
        setUser(null); setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- DATA ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "canteens"), (snapshot) => {
        setCanteens(snapshot.docs.map(d => ({ 
          id: d.id, 
          isOpen: true, 
          ...d.data() 
        })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    let q = userMode === "shopkeeper" ? collection(db, "orders") : query(collection(db, "orders"), where("studentId", "==", user.email));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedOrders.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setOrders(fetchedOrders);
    });
    return () => unsub();
  }, [user, userMode]);

  // --- ACTIONS ---
  const handleLogin = (e) => { 
    e.preventDefault(); 
    signInWithEmailAndPassword(auth, email, password).catch(err => alert(err.message)); 
  };
  
  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPass) return alert("Passwords do not match!");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), { fullName, collegeId, email, role: "student" });
      alert("Account Created!");
    } catch (err) { alert(err.message); }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return alert("Cart empty!");
    const studentLabel = userData ? `${userData.fullName} (${userData.collegeId})` : user.email;
    await addDoc(collection(db, "orders"), {
      items: cart, 
      total: cart.reduce((a, b) => a + b.price, 0), 
      status: "pending", 
      studentId: user.email, 
      studentName: studentLabel, 
      canteenName: selectedCanteen?.name || "Main Canteen",
      timestamp: new Date()
    });
    alert("Order Sent."); 
    setCart([]); setCurrentView("account"); 
    setSelectedCanteen(null); 
  };

  const addNewItem = async (e) => {
    e.preventDefault();
    try {
      const canteenRef = doc(db, "canteens", canteens[0].id);
      await updateDoc(canteenRef, {
        menu: arrayUnion({ name: newItemName, price: Number(newItemPrice), image: newItemImage || DEFAULT_IMG })
      });
      alert("Item Added.");
      setNewItemName(""); setNewItemPrice(""); setShowAddForm(false);
    } catch (error) { alert(error.message); }
  };

  const updateStatus = async (id, st) => updateDoc(doc(db, "orders", id), { status: st });
  const handleLogout = () => { signOut(auth); setCart([]); setSelectedCanteen(null); };

  const goHome = () => {
    setCurrentView("home");
    setSelectedCanteen(null); 
  };

  // --- VIEWS ---
  const AccountView = () => (
    <div className="container fade-in">
      <div className="hero"><h1>History</h1></div>
      {orders.length === 0 ? <p style={{color: "#888"}}>No past orders.</p> : (
        <div style={{display: "grid", gap: "20px"}}>
          {orders.map(o => (
            <div key={o.id} style={{background: "var(--bg-card)", padding: "25px", border: "1px solid var(--border)", borderRadius: "12px"}}>
              <div style={{display: "flex", justifyContent: "space-between", marginBottom: "15px"}}>
                <div>
                  <strong style={{color: "white", display:"block"}}>{o.canteenName || "Canteen"}</strong>
                  <span style={{color: "#666", fontSize: "12px"}}>{o.timestamp?.toDate().toLocaleDateString()}</span>
                </div>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
              <ul style={{margin: "0 0 15px 0", paddingLeft: "20px", color: "#aaa"}}>
                {o.items.map((i,x) => <li key={x}>{i.name}</li>)}
              </ul>
              <div style={{fontWeight: "800", textAlign: "right", fontSize: "18px", color: "white"}}>₹{o.total}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const StatsView = () => (
    <div className="container fade-in">
      <div className="hero"><h1>Analytics</h1></div>
      <div style={{background: "var(--bg-card)", padding: "60px", border: "1px solid var(--border)", borderRadius: "16px", textAlign: "center"}}>
        <h3 style={{color: "#888", textTransform: "uppercase", fontSize: "12px", letterSpacing: "2px"}}>Total Revenue</h3>
        <h1 style={{fontSize: "60px", margin: "20px 0", color: "white"}}>₹{orders.reduce((s, o) => s + o.total, 0)}</h1>
        <p style={{color: "#666"}}>Orders Processed: {orders.length}</p>
      </div>
    </div>
  );

  // --- LOGIN ---
  if (!user) {
    return (
      <div style={{minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "var(--bg-body)"}}>
        <div style={{background: "var(--bg-card)", padding: "40px", width: "100%", maxWidth: "350px", border: "1px solid var(--border)", borderRadius: "16px"}}>
          <h2 style={{marginTop: 0, marginBottom: "20px", color: "white"}}>{isRegistering ? "Create Account" : "Sign In"}</h2>
          <form onSubmit={isRegistering ? handleSignup : handleLogin}>
            {isRegistering && <><input type="text" placeholder="Full Name" onChange={e=>setFullName(e.target.value)} required /><input type="text" placeholder="College ID" onChange={e=>setCollegeId(e.target.value)} required /></>}
            <input type="email" placeholder="Email" onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} required />
            {isRegistering && <input type="password" placeholder="Confirm Password" onChange={e=>setConfirmPass(e.target.value)} required />}
            <button type="submit" className="btn btn-primary" style={{width: "100%", marginTop: "10px"}}>{isRegistering ? "Join" : "Enter"}</button>
          </form>
          <button onClick={()=>setIsRegistering(!isRegistering)} className="btn btn-secondary" style={{width: "100%", marginTop: "10px"}}>
            {isRegistering ? "Back to Login" : "No account? Register"}
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div style={{minHeight: "100vh", paddingBottom: "100px"}}> 
      <div className="navbar">
        <div className="logo" onClick={goHome} style={{cursor:"pointer"}}>CAMTEEN.</div>
        <div style={{display: "flex", gap: "10px"}}>
          <button onClick={goHome} className={`btn ${currentView==="home"?"btn-primary":"btn-secondary"}`}>Menu</button>
          {userMode === "student" && <button onClick={()=>setCurrentView("account")} className={`btn ${currentView==="account"?"btn-primary":"btn-secondary"}`}>History</button>}
          <button onClick={()=>setCurrentView("stats")} className={`btn ${currentView==="stats"?"btn-primary":"btn-secondary"}`}>Stats</button>
          <button onClick={handleLogout} className="btn btn-danger" style={{border: "none"}}>Exit</button>
        </div>
      </div>

      {currentView === "stats" && <StatsView />}
      {currentView === "account" && <AccountView />}
      
      {currentView === "home" && (
        <div className="container fade-in">
          
          {/* ---------------- STUDENT VIEW ---------------- */}
          {userMode === "student" && (
            <>
              {/* PAGE 1: CANTEEN SELECTION */}
              {!selectedCanteen ? (
                <>
                  <div className="hero"><h1>Select Canteen</h1><p>Where are you eating today?</p></div>
                  
                  <div className="menu-grid">
                    {canteens.map(c => (
                      <div 
                        key={c.id} 
                        className="food-card" 
                        onClick={() => setSelectedCanteen(c)}
                        style={{cursor: "pointer", alignItems: "flex-start", textAlign: "left", backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${CANTEEN_IMG})`, backgroundSize: "cover", border: "1px solid #333"}}
                      >
                        <div style={{marginTop: "auto"}}>
                          <span style={{
                            background: c.isOpen ? "#10b981" : "#ef4444", 
                            color: "white", padding: "5px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", marginBottom: "10px", display: "inline-block"
                          }}>
                            {c.isOpen ? "● OPEN" : "● CLOSED"}
                          </span>
                          <h2 style={{margin: "5px 0", color: "white", fontSize: "24px"}}>{c.name}</h2>
                          <p style={{color: "#ccc", margin: 0, fontSize: "14px"}}>Click to view menu →</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* PAGE 2: MENU VIEW */
                <>
                  {/* --- NEW HERO HEADER (Cover Photo) --- */}
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: "300px",
                    backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url(${CANTEEN_IMG})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    borderRadius: "16px",
                    marginBottom: "40px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "40px"
                  }}>
                    <button 
                      onClick={() => setSelectedCanteen(null)} 
                      style={{position: "absolute", top: "20px", left: "20px", background: "rgba(0,0,0,0.5)", color: "white", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: "30px", cursor: "pointer", backdropFilter: "blur(5px)"}}
                    >
                      ← Back
                    </button>
                    <h1 style={{fontSize: "48px", margin: 0, color: "white"}}>{selectedCanteen.name}</h1>
                    <p style={{color: "#ccc", fontSize: "18px", marginTop: "5px"}}>Full Menu & Beverages</p>
                  </div>

                  {/* --- CONTENT GRID --- */}
                  <div className="main-grid">
                    
                    {/* LEFT COLUMN: Search & Menu */}
                    <div>
                      <input 
                        type="text" 
                        placeholder="Search for food..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginBottom: "30px", background: "transparent", border: "none", borderBottom: "1px solid #333", borderRadius: 0, paddingLeft: 0, fontSize: "20px" }}
                      />

                      <div className="menu-grid">
                        {selectedCanteen.menu && selectedCanteen.menu
                          .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((item, idx) => (
                            <div key={idx} className="food-card">
                              <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center"}}>
                                 <h3>{item.name}</h3>
                              </div>
                              <div style={{width: "100%"}}>
                                 <span className="price-tag">₹{item.price}</span>
                                 <button 
                                   onClick={() => setCart([...cart, item])} 
                                   className="btn btn-primary"
                                   style={{width: "100%"}}
                                 >
                                   Add
                                 </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Your Order (Now sits below the Hero Name) */}
                    <div className="cart-panel">
                      <h3 style={{marginTop: 0, color: "white"}}>Your Order</h3>
                      {cart.length === 0 ? <p style={{color: "#555"}}>Cart is empty</p> : (
                        <>
                          <ul style={{paddingLeft: "20px", marginBottom: "20px", color: "#ccc"}}>
                            {cart.map((i, idx) => <li key={idx} style={{marginBottom: "5px"}}>{i.name} <span style={{color:"#555"}}>- ₹{i.price}</span></li>)}
                          </ul>
                          <div style={{borderTop: "1px solid #333", paddingTop: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}>
                            <strong style={{color: "white"}}>Total</strong>
                            <strong style={{fontSize: "24px", color: "var(--accent)"}}>₹{cart.reduce((a,b)=>a+b.price,0)}</strong>
                          </div>
                          <button onClick={placeOrder} className="btn btn-primary" style={{width: "100%"}}>Confirm Order</button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ---------------- SHOPKEEPER VIEW (UNCHANGED) ---------------- */}
          {userMode === "shopkeeper" && (
            <>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: "1px solid #333", paddingBottom: "20px"}}>
                <h1 style={{margin:0, color: "white"}}>Live Orders</h1>
                <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
                  {showAddForm ? "Close" : "+ Add Item"}
                </button>
              </div>

              {showAddForm && (
                <div style={{background: "var(--bg-card)", padding: "30px", border: "1px solid var(--border)", marginBottom: "40px", borderRadius: "12px"}}>
                  <h3 style={{color: "white"}}>New Menu Item</h3>
                  <form onSubmit={addNewItem} style={{display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "15px", alignItems: "end"}}>
                    <input placeholder="Item Name" value={newItemName} onChange={e=>setNewItemName(e.target.value)} style={{marginBottom:0}} />
                    <input placeholder="Price" type="number" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} style={{marginBottom:0}} />
                    <button type="submit" className="btn btn-primary">Save Item</button>
                  </form>
                </div>
              )}

              <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px"}}>
                {orders.map(o => (
                  <div key={o.id} style={{background: "var(--bg-card)", padding: "25px", border: "1px solid var(--border)", borderRadius: "12px"}}>
                    <div style={{display: "flex", justifyContent: "space-between", marginBottom: "15px"}}>
                       <strong style={{color: "white"}}>{o.studentName}</strong>
                       <span className={`status-badge status-${o.status}`}>{o.status}</span>
                    </div>
                    <ul style={{color: "#aaa"}}>{o.items.map((i,x)=><li key={x}>{i.name}</li>)}</ul>
                    <div style={{marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                      {o.status === "pending" && <><button onClick={() => updateStatus(o.id, "preparing")} className="btn btn-primary">Accept</button><button onClick={() => updateStatus(o.id, "rejected")} className="btn btn-danger">Reject</button></>}
                      {o.status === "preparing" && <button onClick={() => updateStatus(o.id, "ready")} className="btn btn-primary" style={{gridColumn: "span 2"}}>Mark Ready</button>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Mobile Floating Cart (Student Only) */}
          {userMode === "student" && cart.length > 0 && selectedCanteen && (
            <div style={{position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", width: "90%", maxWidth: "400px", background: "var(--primary)", color: "white", borderRadius: "50px", padding: "15px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 40px rgba(59, 130, 246, 0.5)", zIndex: 1000}}>
              <span style={{fontWeight: "600"}}>{cart.length} Items • ₹{cart.reduce((a, b) => a + b.price, 0)}</span>
              <button onClick={placeOrder} style={{background: "white", color: "var(--primary)", border: "none", padding: "8px 20px", borderRadius: "30px", fontWeight: "bold", cursor: "pointer"}}>Pay</button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default App;